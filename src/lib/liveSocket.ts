import { BACKEND, getToken } from './api';

// ── Shared live-data socket ──────────────────────────────────────────────
// Every place in the app that used to open its own
// `new WebSocket('wss://stream.binance.com/...')` now shares ONE
// connection to our own backend (which relays the Binance streams
// server-side — see binance-relay.service.ts). This means:
//  - one socket per browser tab instead of one per chart component
//  - the backend, not Binance, decides whether the connection can be
//    made at all, so geo-blocking/CORS problems disappear for users
//  - reconnect/backoff logic lives in exactly one place

export interface KlineTick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type KlineListener = (bar: KlineTick) => void;
type TradeListener = (price: number) => void;
type SignalListener = (sig: any) => void;
type TransactionListener = (update: any) => void;
type TradeResultListener = (result: any) => void;

const WS_URL = BACKEND.replace(/^http/, 'ws') + '/ws';

let socket: WebSocket | null = null;
let connecting = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const klineListeners = new Map<string, Set<KlineListener>>(); // key: `${symbol}:${interval}`
const tradeListeners = new Map<string, Set<TradeListener>>(); // key: symbol
const signalListeners = new Set<SignalListener>();
const transactionListeners = new Set<TransactionListener>();
const tradeResultListeners = new Set<TradeResultListener>();

function send(msg: unknown) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

function resubscribeAll() {
  for (const key of klineListeners.keys()) {
    const [symbol, interval] = key.split(':');
    send({ type: 'subscribe_kline', symbol, interval });
  }
  for (const symbol of tradeListeners.keys()) {
    send({ type: 'subscribe_trade', symbol });
  }
}

function connect() {
  if (connecting || (socket && socket.readyState === WebSocket.OPEN)) return;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  connecting = true;

  const ws = new WebSocket(WS_URL);
  socket = ws;

  ws.onopen = () => {
    connecting = false;
    // Identify this socket to the backend (if logged in) so targeted
    // events — e.g. "your deposit was just confirmed" — can reach exactly
    // this user instead of broadcasting to everyone.
    const token = getToken();
    if (token && token !== 'demo') send({ type: 'auth', token });
    resubscribeAll();
  };

  ws.onmessage = (e) => {
    let msg: any;
    try { msg = JSON.parse(e.data); } catch { return; }

    if (msg.type === 'kline_update' && msg.symbol && msg.interval && msg.data) {
      const key = `${msg.symbol}:${msg.interval}`;
      const listeners = klineListeners.get(key);
      if (listeners) for (const l of listeners) l(msg.data);
    } else if (msg.type === 'trade_tick' && msg.symbol && typeof msg.price === 'number') {
      const listeners = tradeListeners.get(msg.symbol);
      if (listeners) for (const l of listeners) l(msg.price);
    } else if (msg.type === 'signal' && msg.data) {
      for (const l of signalListeners) l(msg.data);
    } else if (msg.type === 'transaction_update' && msg.data) {
      for (const l of transactionListeners) l(msg.data);
    } else if (msg.type === 'trade_result' && msg.data) {
      for (const l of tradeResultListeners) l(msg.data);
    }
  };

  ws.onclose = () => {
    connecting = false;
    if (socket === ws) socket = null;
    // Only bother reconnecting if someone's still listening for something.
    if (klineListeners.size > 0 || tradeListeners.size > 0 || signalListeners.size > 0 || transactionListeners.size > 0 || tradeResultListeners.size > 0) {
      reconnectTimer = setTimeout(connect, 1500);
    }
  };

  ws.onerror = () => {
    try { ws.close(); } catch {}
  };
}

function ensureConnected() {
  if (!socket) connect();
}

export function subscribeKline(symbol: string, interval: string, listener: KlineListener): () => void {
  const key = `${symbol}:${interval}`;
  let set = klineListeners.get(key);
  const isNew = !set;
  if (!set) { set = new Set(); klineListeners.set(key, set); }
  set.add(listener);

  ensureConnected();
  if (isNew) send({ type: 'subscribe_kline', symbol, interval });

  return () => {
    const s = klineListeners.get(key);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) {
      klineListeners.delete(key);
      send({ type: 'unsubscribe_kline', symbol, interval });
    }
  };
}

export function subscribeTrade(symbol: string, listener: TradeListener): () => void {
  let set = tradeListeners.get(symbol);
  const isNew = !set;
  if (!set) { set = new Set(); tradeListeners.set(symbol, set); }
  set.add(listener);

  ensureConnected();
  if (isNew) send({ type: 'subscribe_trade', symbol });

  return () => {
    const s = tradeListeners.get(symbol);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) {
      tradeListeners.delete(symbol);
      send({ type: 'unsubscribe_trade', symbol });
    }
  };
}

// Real trade signals generated server-side from live RSI/MACD analysis
// (see signals.service.ts) — broadcast to every connected client as soon
// as they're generated, no polling required for the live feed.
export function subscribeSignals(listener: SignalListener): () => void {
  signalListeners.add(listener);
  ensureConnected();
  return () => { signalListeners.delete(listener); };
}

// Live "your deposit/withdrawal was confirmed/rejected" push — fires the
// instant staff (or the admin) act on a transaction, see admin.routes.ts.
export function subscribeTransactions(listener: TransactionListener): () => void {
  transactionListeners.add(listener);
  ensureConnected();
  return () => { transactionListeners.delete(listener); };
}

// Server-authoritative trade outcomes — used for Challenge-mode trades,
// which are opened for real via POST /api/trade/open (unlike demo/real
// trades in this app, which are still resolved client-side) since a real
// cash reward is on the line and can't be left to client-side trust.
export function subscribeTradeResults(listener: TradeResultListener): () => void {
  tradeResultListeners.add(listener);
  ensureConnected();
  return () => { tradeResultListeners.delete(listener); };
}

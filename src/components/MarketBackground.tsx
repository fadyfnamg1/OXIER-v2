import { useEffect, useRef } from 'react';

type Props = {
  /** CSS selector of the scrollable ancestor to read scroll depth from.
   *  Pass "" for single-view screens (auth/splash) to get a slow
   *  autonomous drift instead of a scroll-linked one. */
  scrollRoot?: string;
  subtle?: boolean;
};

/**
 * The signature "living market" surface behind Splash, Auth and Landing:
 * a tall glowing price-mountain silhouette sweeping across the full width
 * (the dominant visual, orange-lit, constantly reshaping itself) plus a
 * constellation of connected nodes drifting and leaning toward the cursor
 * — read together as "a market that is alive and being watched" rather
 * than decorative noise. On the landing page it visibly accelerates,
 * brightens and pulls into focus as the visitor scrolls; on auth/splash
 * it breathes slowly on its own. Pure canvas, zero dependencies.
 */
export default function MarketBackground({ scrollRoot = '.lp-root', subtle = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0, height = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let scrollT = 0, idleT = 0, raf = 0;
    let mouseX = 0.5, mouseY = 0.5;
    let easedMX = 0.5, easedMY = 0.5;

    function resize() {
      const rect = canvas!.parentElement!.getBoundingClientRect();
      width = rect.width; height = rect.height;
      canvas!.width = width * dpr; canvas!.height = height * dpr;
      canvas!.style.width = width + 'px'; canvas!.style.height = height + 'px';
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildMountain();
      buildNodes();
    }
    function onMove(e: MouseEvent) {
      mouseX = e.clientX / window.innerWidth;
      mouseY = e.clientY / window.innerHeight;
    }
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove, { passive: true });

    /* ── The mountain: a tall, ever-reshaping price silhouette that is the
       dominant shape of the whole background. New points enter from the
       right with random walk + slow sinusoidal drift so it never repeats. */
    let mtnPts: number[] = [];
    const STEP = 5;
    function buildMountain() {
      const n = Math.ceil(width / STEP) + 20;
      const base = height * 0.62;
      const amp = subtle ? height * 0.16 : height * 0.34;
      mtnPts = [];
      let v = base;
      for (let i = 0; i < n; i++) {
        v += (Math.random() - 0.5) * amp * 0.16;
        v = Math.max(base - amp, Math.min(base + amp * 0.35, v));
        mtnPts.push(v);
      }
    }
    let mtnOffset = 0;

    /* ── Constellation nodes ── */
    type Node = { x: number; y: number; vx: number; vy: number; r: number };
    let nodes: Node[] = [];
    function buildNodes() {
      const count = subtle ? 0 : Math.min(46, Math.round((width * height) / 26000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height * 0.7,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: 1 + Math.random() * 1.6,
      }));
    }

    /* ── Floating "+x.x%" profit tags ── */
    type Tag = { x: number; y: number; life: number; max: number; up: boolean; val: string };
    const tags: Tag[] = [];
    function spawnTag() {
      const up = Math.random() > 0.32;
      const val = (up ? '+' : '-') + (Math.random() * 5 + 0.4).toFixed(1) + '%';
      tags.push({ x: Math.random() * width, y: height * (0.15 + Math.random() * 0.5), life: 0, max: 190 + Math.random() * 90, up, val });
    }

    resize();

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      easedMX += (mouseX - easedMX) * 0.04;
      easedMY += (mouseY - easedMY) * 0.04;

      const speedMul = 1 + scrollT * 1.6;
      const glowMul = 0.55 + scrollT * 0.9; // brightens on scroll instead of fading
      const parallax = (easedMX - 0.5) * 26;

      // ── Mountain: glowing fill + crest line ──
      mtnOffset += 0.55 * speedMul;
      ctx!.save();
      ctx!.translate(parallax * 0.4, 0);
      ctx!.beginPath();
      ctx!.moveTo(-STEP * 2, height + 4);
      for (let i = 0; i < mtnPts.length; i++) {
        const x = i * STEP - (mtnOffset % STEP);
        ctx!.lineTo(x, mtnPts[i]);
      }
      ctx!.lineTo(width + STEP * 2, height + 4);
      ctx!.closePath();
      const fill = ctx!.createLinearGradient(0, height * 0.2, 0, height);
      fill.addColorStop(0, `rgba(247,147,26,${0.16 * glowMul})`);
      fill.addColorStop(0.55, `rgba(184,98,10,${0.07 * glowMul})`);
      fill.addColorStop(1, 'rgba(184,98,10,0)');
      ctx!.fillStyle = fill;
      ctx!.fill();

      ctx!.beginPath();
      for (let i = 0; i < mtnPts.length; i++) {
        const x = i * STEP - (mtnOffset % STEP);
        if (i === 0) ctx!.moveTo(x, mtnPts[i]); else ctx!.lineTo(x, mtnPts[i]);
      }
      ctx!.strokeStyle = `rgba(196,108,8,${0.62 * glowMul})`;
      ctx!.lineWidth = 1.8;
      ctx!.shadowColor = 'rgba(217,120,10,.55)';
      ctx!.shadowBlur = 14 * glowMul;
      ctx!.stroke();
      ctx!.shadowBlur = 0;
      ctx!.restore();

      if (mtnOffset > STEP) {
        mtnPts.push(mtnPts[mtnPts.length - 1] + (Math.random() - 0.5) * height * 0.05);
        mtnPts.shift();
      }

      // ── Constellation: drifting nodes leaning toward cursor + links ──
      for (const nd of nodes) {
        nd.x += nd.vx * speedMul + (easedMX - 0.5) * 0.06;
        nd.y += nd.vy * speedMul + (easedMY - 0.5) * 0.06;
        if (nd.x < -10) nd.x = width + 10; if (nd.x > width + 10) nd.x = -10;
        if (nd.y < -10) nd.y = height * 0.7; if (nd.y > height * 0.7 + 10) nd.y = -10;
      }
      ctx!.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) {
            ctx!.strokeStyle = `rgba(196,108,8,${(1 - d / 130) * 0.22 * glowMul})`;
            ctx!.beginPath(); ctx!.moveTo(a.x, a.y); ctx!.lineTo(b.x, b.y); ctx!.stroke();
          }
        }
      }
      for (const nd of nodes) {
        ctx!.beginPath();
        ctx!.arc(nd.x, nd.y, nd.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(196,108,8,${0.65 * glowMul})`;
        ctx!.fill();
      }

      // ── Floating profit tags ──
      if (!reduceMotion && Math.random() < 0.01 && tags.length < (subtle ? 2 : 5)) spawnTag();
      for (let i = tags.length - 1; i >= 0; i--) {
        const tg = tags[i];
        tg.life++;
        const p = tg.life / tg.max;
        if (p >= 1) { tags.splice(i, 1); continue; }
        const alpha = (p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1) * 0.75 * glowMul;
        ctx!.font = '600 12px "IBM Plex Mono", monospace';
        ctx!.fillStyle = tg.up ? `rgba(180,98,8,${alpha})` : `rgba(210,40,55,${alpha})`;
        ctx!.fillText(tg.val, tg.x, tg.y - p * 24);
      }

      idleT++;
      raf = requestAnimationFrame(draw);
    }

    if (!reduceMotion) raf = requestAnimationFrame(draw); else draw();

    const root = scrollRoot ? (document.querySelector(scrollRoot) as HTMLElement | null) : null;
    let idleTimer = 0;
    function onScroll() {
      if (!root) return;
      const max = root.scrollHeight - root.clientHeight;
      scrollT = max > 0 ? Math.min(1, root.scrollTop / Math.min(max, 1200)) : 0;
    }
    if (root) {
      root.addEventListener('scroll', onScroll, { passive: true });
    } else if (!reduceMotion) {
      idleTimer = window.setInterval(() => {
        idleT += 16;
        scrollT = (Math.sin(idleT * 0.00014) + 1) / 2 * 0.55;
      }, 16);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      root?.removeEventListener('scroll', onScroll);
      if (idleTimer) window.clearInterval(idleTimer);
    };
  }, [scrollRoot, subtle]);

  return (
    <div className={`lp-market-bg${subtle ? ' subtle' : ''}`} aria-hidden="true">
      <canvas ref={canvasRef} />
      <div className="lp-market-bg-fade" />
    </div>
  );
}

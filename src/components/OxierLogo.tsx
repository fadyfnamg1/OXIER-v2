/**
 * OXIER wordmark — replaces the old gradient "X" icon mark entirely.
 * Just the name itself, with the X picked out in brand orange, exactly
 * like the reference splash-screen artwork (dark bg / light bg versions).
 * Works automatically in both dark and light theme since the base color
 * comes from currentColor / var(--t1).
 */
export default function OxierLogo({
  size = 20,
  className = '',
  style = {},
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`oxier-wordmark ${className}`}
      style={{ fontSize: size, ...style }}
    >
      O<span className="oxier-wordmark-x">X</span>IER
    </span>
  );
}

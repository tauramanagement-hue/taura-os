// Shared UI primitives for Taura OS

export const GlowDot = ({ color = "bg-taura-accent", size = 6 }: { color?: string; size?: number }) => (
  <div
    className={`rounded-full ${color}`}
    style={{
      width: size,
      height: size,
      boxShadow: `0 0 ${size * 2}px currentColor`,
    }}
  />
);

export const Pill = ({
  children,
  variant = "accent",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "accent" | "green" | "red" | "orange" | "blue" | "purple" | "muted";
  className?: string;
}) => {
  const styles: Record<string, string> = {
    accent: "bg-taura-accent/10 text-taura-accent",
    green: "bg-taura-green/10 text-taura-green",
    red: "bg-taura-red/10 text-taura-red",
    orange: "bg-taura-orange/10 text-taura-orange",
    blue: "bg-taura-blue/10 text-taura-blue",
    purple: "bg-taura-purple/10 text-taura-purple",
    muted: "bg-taura-surface text-taura-text3",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
};

export const SeverityBadge = ({ level }: { level: "ALTO" | "MEDIO" | "BASSO" | "INFO" }) => {
  const map: Record<string, "red" | "orange" | "blue" | "accent"> = {
    ALTO: "red",
    MEDIO: "orange",
    BASSO: "accent",
    INFO: "blue",
  };
  return <Pill variant={map[level] || "accent"}>{level}</Pill>;
};

export const MiniChart = ({
  data,
  color = "hsl(170, 100%, 45%)",
  h = 48,
}: {
  data: number[];
  color?: string;
  h?: number;
}) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const id = `g-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  const points = data
    .map((d, i) => `${(i / (data.length - 1)) * 100},${100 - ((d - min) / range) * 80}`)
    .join(" ");
  const areaPoints = points + ` 100,100 0,100`;

  return (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: h }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export const TauraLogo = ({ size = 32, onClick }: { size?: number; onClick?: () => void }) => (
  <img
    src="/logo-taura.png"
    alt="Taura OS"
    onClick={onClick}
    draggable={false}
    style={{ width: size, height: size, cursor: onClick ? "pointer" : "default", flexShrink: 0 }}
  />
);

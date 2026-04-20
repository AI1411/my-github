export type AvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 16,
  sm: 20,
  md: 28,
  lg: 40,
};

export interface AvatarProps {
  login: string;
  src?: string | null;
  size?: AvatarSize;
  title?: string;
}

function gradientFor(login: string): string {
  let hash = 0;
  for (let i = 0; i < login.length; i++) {
    hash = (hash * 31 + login.charCodeAt(i)) >>> 0;
  }
  const h1 = hash % 360;
  const h2 = (h1 + 60) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 55%), hsl(${h2} 70% 45%))`;
}

export function Avatar({ login, src, size = "md", title }: AvatarProps) {
  const px = SIZE_PX[size];
  const initial = login.slice(0, 1).toUpperCase();
  return (
    <span
      title={title ?? login}
      className="inline-flex items-center justify-center rounded-full overflow-hidden select-none"
      style={{
        width: px,
        height: px,
        fontSize: Math.max(10, Math.floor(px * 0.45)),
        background: src ? "transparent" : gradientFor(login),
        color: "#ffffff",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {src ? (
        <img src={src} alt={login} className="w-full h-full object-cover" />
      ) : (
        <span style={{ fontWeight: 600 }}>{initial}</span>
      )}
    </span>
  );
}

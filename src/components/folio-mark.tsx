import { cn } from "@/lib/utils";

/**
 * Folio mark — soft squircle with a geometric "F".
 */
export function FolioMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{
        width: size,
        height: size,
        background: "var(--gradient-mint)",
        borderRadius: size * 0.32,
        boxShadow: "var(--shadow-mint)",
      }}
    >
      <span
        className="font-display font-bold"
        style={{
          fontSize: size * 0.52,
          color: "oklch(0.18 0.04 160)",
          lineHeight: 1,
          marginTop: -size * 0.02,
        }}
      >
        f
      </span>
    </div>
  );
}

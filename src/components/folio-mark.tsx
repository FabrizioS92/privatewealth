import { cn } from "@/lib/utils";

/**
 * Folio monogram — luxury seal, serif "F" inside a gold ring.
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
      className={cn(
        "relative flex items-center justify-center rounded-full",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: "var(--gradient-gold)",
        boxShadow: "var(--shadow-gold-ring), 0 8px 24px -8px oklch(0.82 0.12 85 / 35%)",
      }}
    >
      <span
        className="font-serif italic font-semibold"
        style={{
          fontSize: size * 0.5,
          color: "oklch(0.13 0.008 60)",
          lineHeight: 1,
          marginTop: -size * 0.02,
        }}
      >
        F
      </span>
    </div>
  );
}

import { useEffect, useState } from "react";
import { animate, useMotionValue } from "framer-motion";

interface CountUpProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

export function CountUp({ value, format, duration = 1.1, className }: CountUpProps) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(format ? format(0) : "0");

  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate(latest) {
        setDisplay(format ? format(latest) : Math.round(latest).toString());
      },
    });
    return () => controls.stop();
  }, [value, duration, format, mv]);

  return <span className={className}>{display}</span>;
}

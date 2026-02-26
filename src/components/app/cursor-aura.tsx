"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export function CursorAura() {
  const [visible, setVisible] = useState(false);

  const x = useMotionValue(-120);
  const y = useMotionValue(-120);

  const softX = useSpring(x, { stiffness: 170, damping: 24, mass: 0.3 });
  const softY = useSpring(y, { stiffness: 170, damping: 24, mass: 0.3 });
  const dotX = useSpring(x, { stiffness: 420, damping: 35, mass: 0.2 });
  const dotY = useSpring(y, { stiffness: 420, damping: 35, mass: 0.2 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (reduced || !finePointer) {
      return;
    }

    const onMove = (event: MouseEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
      setVisible(true);
    };
    const onLeave = () => setVisible(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseenter", onMove as EventListener);
    window.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseenter", onMove as EventListener);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [x, y]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 hidden md:block">
      <motion.div
        className="absolute h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(14,165,233,0.24),_rgba(14,165,233,0.07)_42%,_transparent_72%)] blur-sm dark:bg-[radial-gradient(circle,_rgba(56,189,248,0.26),_rgba(16,185,129,0.10)_42%,_transparent_72%)]"
        style={{
          left: softX,
          top: softY,
          opacity: visible ? 1 : 0,
        }}
        transition={{ duration: 0.18 }}
      />
      <motion.div
        className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-400/70 bg-sky-300/20 shadow-[0_0_26px_rgba(14,165,233,0.45)] dark:border-emerald-300/70 dark:bg-emerald-300/20 dark:shadow-[0_0_30px_rgba(16,185,129,0.45)]"
        style={{
          left: dotX,
          top: dotY,
          opacity: visible ? 0.95 : 0,
        }}
        transition={{ duration: 0.14 }}
      />
    </div>
  );
}

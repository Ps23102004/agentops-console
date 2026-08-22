"use client";
import { useEffect } from "react";

/** The living ground the glass refracts. Without it the panels read as gray boxes. */
export function Aurora() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--scroll-y", String(window.scrollY));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
      <div className="aurora" aria-hidden>
        <span className="b1" /><span className="b2" /><span className="b3" /><span className="b4" />
      </div>
      <div className="grain" aria-hidden />
    </>
  );
}

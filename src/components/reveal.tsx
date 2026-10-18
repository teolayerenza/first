"use client";

import { useEffect } from "react";

/** Activa las entradas escalonadas de cada capítulo al aparecer en pantalla (ver globals.css). */
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.reveal = "in";
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight) {
        el.dataset.reveal = "pending";
        io.observe(el);
      }
    }
    return () => io.disconnect();
  }, []);
  return null;
}

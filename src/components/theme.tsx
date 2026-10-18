"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
const KEY = "pocitos-theme";

/** Corre antes del primer paint: evita el parpadeo de tema (ver guía "preventing flash" de Next). */
export const themeInitScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

function read(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function apply(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  listeners.forEach((l) => l());
  window.dispatchEvent(new Event("pocitos-theme"));
}

const LABEL: Record<Theme, string> = { system: "Tema del sistema", light: "Tema claro", dark: "Tema oscuro" };
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  return (
    <button
      type="button"
      onClick={() => apply(NEXT[theme])}
      className="h-10 px-3 text-small text-asphalt-ink-2 hover:bg-asphalt-3 hover:text-asphalt-ink"
      aria-label={`${LABEL[theme]}. Cambiar tema`}
      title={LABEL[theme]}
    >
      Tema: {theme === "light" ? "claro" : theme === "dark" ? "oscuro" : "auto"}
    </button>
  );
}

/** Tema efectivo (para el mapa y la vista 3D, que no leen CSS). */
export function useResolvedTheme(): "light" | "dark" {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", cb);
      window.addEventListener("pocitos-theme", cb);
      return () => {
        mq.removeEventListener("change", cb);
        window.removeEventListener("pocitos-theme", cb);
      };
    },
    () => {
      const t = document.documentElement.dataset.theme;
      if (t === "light" || t === "dark") return t;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    },
    () => "light",
  );
}

/** Lee un token CSS (por ejemplo `--c-muy`) del tema actual. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

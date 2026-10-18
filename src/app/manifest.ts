import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pocitos LP",
    short_name: "Pocitos LP",
    description: "El estado real de las calles de La Plata, medido por vecinos.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f2",
    theme_color: "#0b0b0b",
    lang: "es-AR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

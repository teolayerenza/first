import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { OgCard } from "@/components/og-card";
import { getDataSource } from "@/lib/data";

export const alt = "Estado de las calles de una zona de La Plata";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const ds = getDataSource();
  const zone = (await ds.getZones()).find((z) => z.slug === slug);
  const d = await ds.getDashboard(zone?.id ?? null);
  return new ImageResponse(<OgCard kpis={d.kpis} scope={zone ? `Zona ${zone.name}` : "Casco urbano"} demo={d.mode === "demo"} />, size);
}

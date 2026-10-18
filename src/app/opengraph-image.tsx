import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { OgCard } from "@/components/og-card";
import { getDataSource } from "@/lib/data";

export const alt = "Porcentaje de calles muy deterioradas del casco urbano de La Plata";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  await connection();
  const ds = getDataSource();
  const d = await ds.getDashboard();
  return new ImageResponse(<OgCard kpis={d.kpis} scope="Casco urbano de La Plata" demo={d.mode === "demo"} />, size);
}

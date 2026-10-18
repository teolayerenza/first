import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/dashboard";
import { DashboardSkeleton } from "@/components/skeleton";
import { getDataSource } from "@/lib/data";

export async function generateMetadata(props: PageProps<"/zona/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const zone = (await getDataSource().getZones()).find((z) => z.slug === slug);
  return zone ? { title: `Zona ${zone.name}`, description: `Estado de las calles entre ${zone.name.replace(" / ", " y ")} (La Plata).` } : {};
}

async function Content({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const ds = getDataSource();
  const zone = (await ds.getZones()).find((z) => z.slug === slug);
  if (!zone) notFound();
  const [data, casco] = await Promise.all([ds.getDashboard(zone.id), ds.getCasco()]);
  return <Dashboard data={data} casco={casco} zone={{ id: zone.id, name: zone.name, ring: zone.ring }} />;
}

export default function ZonaPage(props: PageProps<"/zona/[slug]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Content params={props.params} />
    </Suspense>
  );
}

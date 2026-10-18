import { connection } from "next/server";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/dashboard";
import { DashboardSkeleton } from "@/components/skeleton";
import { getDataSource } from "@/lib/data";

async function Content() {
  await connection(); // los KPIs dependen de "ahora": se calculan en cada pedido
  const ds = getDataSource();
  const [data, casco] = await Promise.all([ds.getDashboard(), ds.getCasco()]);
  return <Dashboard data={data} casco={casco} />;
}

export default function Home() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Content />
    </Suspense>
  );
}

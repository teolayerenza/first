import type { Metadata } from "next";
import { ReportIssueForm } from "@/components/forms/report-issue";

export const metadata: Metadata = { title: "Reportar pozo o parche" };

export default function ReportarPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Reportar un pozo o un parche mal hecho</h1>
      <p className="mb-5 mt-1 text-ink-2">Lo puede reportar cualquiera que pase. Tarda unos 15 segundos.</p>
      <ReportIssueForm />
    </div>
  );
}

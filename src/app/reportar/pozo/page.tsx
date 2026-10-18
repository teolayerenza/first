import type { Metadata } from "next";
import { FormPage } from "@/components/form-page";
import { ReportIssueForm } from "@/components/forms/report-issue";

export const metadata: Metadata = { title: "Reportar un pozo" };

export default function ReportarPozoPage() {
  return (
    <FormPage title="Reportá un pozo" lead="Donde falta asfalto. Lo puede reportar cualquiera que pase, y tarda unos 15 segundos.">
      <ReportIssueForm kind="pozo" />
    </FormPage>
  );
}

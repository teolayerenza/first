import type { Metadata } from "next";
import { FormPage } from "@/components/form-page";
import { ReportIssueForm } from "@/components/forms/report-issue";

export const metadata: Metadata = { title: "Reportar pozo o parche" };

export default function ReportarPage() {
  return (
    <FormPage title="Reportá un pozo" lead="O un parche mal hecho. Lo puede reportar cualquiera que pase, y tarda unos 15 segundos.">
      <ReportIssueForm />
    </FormPage>
  );
}

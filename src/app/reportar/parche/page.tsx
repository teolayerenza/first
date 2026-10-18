import type { Metadata } from "next";
import { FormPage } from "@/components/form-page";
import { ReportIssueForm } from "@/components/forms/report-issue";

export const metadata: Metadata = { title: "Reportar un parche mal hecho" };

export default function ReportarParchePage() {
  return (
    <FormPage title="Reportá un parche" lead="Un bacheo que quedó mal: elevado como lomo de burro, hundido o que ya se desarmó.">
      <ReportIssueForm kind="parche" />
    </FormPage>
  );
}

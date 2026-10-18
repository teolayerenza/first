import type { Metadata } from "next";
import { FormPage } from "@/components/form-page";
import { ReportChoices } from "@/components/report-choices";

export const metadata: Metadata = { title: "Reportar" };

export default function ReportarPage() {
  return (
    <FormPage title="¿Qué querés reportar?" lead="Cada cosa tiene su formulario. Es anónimo y tarda menos de un minuto.">
      <ReportChoices />
    </FormPage>
  );
}

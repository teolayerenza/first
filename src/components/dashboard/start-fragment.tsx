import { ReportChoices } from "../report-choices";

/** El primer paso, ya abierto en la página: las tres acciones separadas. */
export function StartFragment() {
  return (
    <div className="w-full">
      <ReportChoices />
    </div>
  );
}

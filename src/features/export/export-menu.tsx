"use client";

import {
  ChevronDownIcon,
  DownloadIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
} from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ScenarioView } from "@/features/workspace/scenario-view";
import { downloadFile, XLSX_MIME } from "@/lib/download";
import type { ChartExportInput } from "./chart-svg";
import {
  downloadChartPdf,
  downloadChartPng,
  safeFilename,
} from "./chart-export";
import { createExcelExport } from "./excel-export";

/**
 * Export des bearbeiteten Szenarios (F35, F45): Excel im Format der Importvorlage (E19),
 * Diagramm als PNG oder PDF (E18). Ohne `chart` nur Excel, z. B. in der Tabellenansicht.
 */
export function ExportMenu(props: {
  view: ScenarioView;
  scenarioName: string;
  /** Stand für die Zusatzspalte, z. B. „27.10.2026, 08:30 von a@neonex.de“. */
  stand: string;
  chart?: () => ChartExportInput;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const name = safeFilename(props.scenarioName);

  async function run(work: () => Promise<void>) {
    setOpen(false);
    setBusy(true);
    try {
      await work();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Export fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }

  const item =
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary disabled:opacity-50";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={buttonVariants({ variant: "outline", size: "sm" })}
        disabled={busy}
      >
        <DownloadIcon data-icon="inline-start" />
        {busy ? "Exportiert …" : "Export"}
        <ChevronDownIcon data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1">
        <button
          type="button"
          className={item}
          disabled={busy}
          onClick={() =>
            run(async () =>
              downloadFile(
                await createExcelExport(props.view, {
                  scenarioName: props.scenarioName,
                  stand: props.stand,
                }),
                `${name}.xlsx`,
                XLSX_MIME,
              ),
            )
          }
        >
          <FileSpreadsheetIcon className="size-4" />
          Excel (Importvorlage)
        </button>
        {props.chart && (
          <>
            <button
              type="button"
              className={item}
              disabled={busy}
              onClick={() =>
                run(() =>
                  downloadChartPng(props.chart!(), `${name} – Yamazumi.png`),
                )
              }
            >
              <FileImageIcon className="size-4" />
              Diagramm als PNG
            </button>
            <button
              type="button"
              className={item}
              disabled={busy}
              onClick={() =>
                run(() =>
                  downloadChartPdf(props.chart!(), `${name} – Yamazumi.pdf`),
                )
              }
            >
              <FileTextIcon className="size-4" />
              Diagramm als PDF (A4 quer)
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

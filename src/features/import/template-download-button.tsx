"use client";

import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadFile, XLSX_MIME } from "@/lib/download";
import { createTemplate } from "./workbook";

export function TemplateDownloadButton({
  variant = "outline",
}: {
  variant?: "outline" | "ghost";
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      downloadFile(
        await createTemplate(),
        "Importtemplate Line Balancing.xlsx",
        XLSX_MIME,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} onClick={download} disabled={busy}>
      <DownloadIcon data-icon="inline-start" />
      Importtemplate
    </Button>
  );
}

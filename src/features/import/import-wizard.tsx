"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  LockIcon,
  XCircleIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { scenarioRepository } from "@/data/scenarioRepository";
import { buildScenario, nameFromFilename } from "@/domain/import/buildScenario";
import { cellText, parseGermanNumber } from "@/domain/import/cells";
import { defaultCategories } from "@/domain/model/categories";
import { COLUMNS, type ColumnKey } from "@/domain/import/template";
import {
  validateRows,
  type ImportMessage,
  type RawRow,
} from "@/domain/import/validateRows";
import { TemplateDownloadButton } from "./template-download-button";
import { readWorkbook } from "./workbook";

type Stage =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "failed"; filename: string; message: string }
  | { kind: "loaded"; filename: string; rows: RawRow[] };

export function ImportWizard() {
  const router = useRouter();
  const fileInputId = useId();
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [name, setName] = useState("");
  const [takt, setTakt] = useState("");
  const [allowance, setAllowance] = useState("0");
  const [onlyFlagged, setOnlyFlagged] = useState(true);
  const [saving, setSaving] = useState(false);

  const rawRows = stage.kind === "loaded" ? stage.rows : null;
  const validation = useMemo(
    () => (rawRows ? validateRows(rawRows) : null),
    [rawRows],
  );

  const taktValue = positiveNumber(takt);
  const allowanceValue = nonNegativeNumber(allowance);
  const errorCount =
    validation?.messages.filter((m) => m.severity === "error").length ?? 0;
  const warningCount = (validation?.messages.length ?? 0) - errorCount;
  const canImport =
    validation !== null &&
    validation.rows.length > 0 &&
    !validation.hasErrors &&
    taktValue !== null &&
    allowanceValue !== null &&
    name.trim() !== "" &&
    !saving;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setStage({ kind: "reading" });
    const read = await readWorkbook(await file.arrayBuffer());
    if (!read.ok) {
      setStage({ kind: "failed", filename: file.name, message: read.message });
      return;
    }
    setStage({ kind: "loaded", filename: file.name, rows: read.rows });
    setName(nameFromFilename(file.name));
  }

  function updateCell(rowNumber: number, key: ColumnKey, text: string) {
    if (stage.kind !== "loaded") return;
    setStage({
      ...stage,
      rows: stage.rows.map((row) =>
        row.rowNumber === rowNumber
          ? { ...row, values: { ...row.values, [key]: text.trim() || null } }
          : row,
      ),
    });
  }

  async function importScenario() {
    if (
      !canImport ||
      stage.kind !== "loaded" ||
      validation === null ||
      taktValue === null ||
      allowanceValue === null
    ) {
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await scenarioRepository().save({
      id,
      name: name.trim(),
      variantName: name.trim(),
      sourceFilename: stage.filename,
      importedAt: now,
      updatedAt: now,
      input: buildScenario(validation.rows, {
        taktMin: taktValue,
        allowancePct: allowanceValue,
      }),
      categories: defaultCategories(),
    });
    router.push(`/szenario?id=${id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Excel importieren</h1>
          <p className="text-muted-foreground">
            Eine Datei je Produktvariante. Jeder Import erzeugt ein neues
            Szenario.
          </p>
        </div>
        <TemplateDownloadButton />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <FileSpreadsheetIcon className="size-8 text-nx-steel-dark" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fileInputId}>Excel-Datei (.xlsx)</Label>
            <div className="flex items-center gap-3">
              {/* Natives Dateifeld verborgen, damit die Beschriftung deutsch ist. */}
              <input
                id={fileInputId}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="peer sr-only"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <label
                htmlFor={fileInputId}
                className={buttonVariants({
                  className:
                    "cursor-pointer peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                })}
              >
                Datei auswählen
              </label>
              <span className="text-sm text-muted-foreground">
                {"filename" in stage
                  ? stage.filename
                  : "Keine Datei ausgewählt"}
              </span>
            </div>
          </div>
          {stage.kind === "reading" && (
            <span className="text-muted-foreground">Lese Datei …</span>
          )}
        </CardContent>
      </Card>

      {stage.kind === "failed" && (
        <Alert variant="destructive">
          <XCircleIcon />
          <AlertTitle>{stage.filename} kann nicht importiert werden</AlertTitle>
          <AlertDescription>{stage.message}</AlertDescription>
        </Alert>
      )}

      {validation && stage.kind === "loaded" && (
        <>
          <ValidationSummary
            rowCount={validation.rows.length}
            errorCount={errorCount}
            warningCount={warningCount}
          />

          <Card>
            <CardHeader>
              <CardTitle>Vorschau: {stage.filename}</CardTitle>
              <CardDescription>
                Fehlerhafte Zeilen lassen sich direkt korrigieren. Zeiten sind
                hier gesperrt: Zeitfehler bitte in Excel beheben und die Datei
                neu hochladen.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={onlyFlagged}
                  onCheckedChange={(checked) => setOnlyFlagged(checked)}
                />
                Nur Zeilen mit Hinweisen anzeigen
              </label>
              <PreviewTable
                rows={rawRows!}
                messages={validation.messages}
                onlyFlagged={onlyFlagged}
                onEdit={updateCell}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Szenario anlegen</CardTitle>
              <CardDescription>
                Taktzeit und Zuschlag stehen nicht in der Excel-Datei und gelten
                nur für dieses Szenario.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
              <Field label="Name (Variante und Szenario)">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field
                label="Taktzeit [min]"
                invalid={takt !== "" && taktValue === null}
              >
                <Input
                  inputMode="decimal"
                  placeholder="z. B. 4,00"
                  value={takt}
                  onChange={(e) => setTakt(e.target.value)}
                />
              </Field>
              <Field label="Zuschlag [%]" invalid={allowanceValue === null}>
                <Input
                  inputMode="decimal"
                  value={allowance}
                  onChange={(e) => setAllowance(e.target.value)}
                />
              </Field>
              <Button size="lg" onClick={importScenario} disabled={!canImport}>
                Szenario anlegen
              </Button>
              <p className="text-xs text-muted-foreground sm:col-span-4">
                Der Zuschlag wird nur auf die produktive Zeit je Mitarbeiter
                angewendet. Enthalten die importierten Zeiten bereits
                Verteilzeit („Zeit T mit Vt“), den Zuschlag auf 0 % lassen.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ValidationSummary(props: {
  rowCount: number;
  errorCount: number;
  warningCount: number;
}) {
  if (props.rowCount === 0) {
    return (
      <Alert variant="destructive">
        <XCircleIcon />
        <AlertTitle>Keine Arbeitsgänge gefunden</AlertTitle>
        <AlertDescription>
          Das Blatt „Arbeitsgänge“ enthält keine ausgefüllten Zeilen.
        </AlertDescription>
      </Alert>
    );
  }
  if (props.errorCount > 0) {
    return (
      <Alert variant="destructive">
        <XCircleIcon />
        <AlertTitle>{props.errorCount} Fehler verhindern den Import</AlertTitle>
        <AlertDescription>
          {props.rowCount} Arbeitsgänge gelesen, {props.warningCount} Warnungen.
          Erst nach Behebung aller Fehler kann das Szenario angelegt werden.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert>
      <CheckCircle2Icon />
      <AlertTitle>{props.rowCount} Arbeitsgänge ohne Fehler</AlertTitle>
      <AlertDescription>
        {props.warningCount > 0
          ? `${props.warningCount} Warnungen blockieren den Import nicht.`
          : "Keine Warnungen."}
      </AlertDescription>
    </Alert>
  );
}

function PreviewTable(props: {
  rows: readonly RawRow[];
  messages: readonly ImportMessage[];
  onlyFlagged: boolean;
  onEdit: (rowNumber: number, key: ColumnKey, text: string) => void;
}) {
  const byRow = new Map<number, ImportMessage[]>();
  for (const m of props.messages) {
    byRow.set(m.rowNumber, [...(byRow.get(m.rowNumber) ?? []), m]);
  }
  const visible = props.rows.filter(
    (row) =>
      !COLUMNS.every((c) => cellText(row.values[c.key]) === "") &&
      (!props.onlyFlagged || byRow.has(row.rowNumber)),
  );

  if (visible.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine Zeilen mit Hinweisen.
      </p>
    );
  }

  return (
    <div className="max-h-[60vh] overflow-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-secondary text-left">
          <tr>
            <th className="px-2 py-2 font-medium">Zeile</th>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className="px-2 py-2 font-medium whitespace-nowrap"
              >
                {c.header}
              </th>
            ))}
            <th className="px-2 py-2 font-medium">Hinweise</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const messages = byRow.get(row.rowNumber) ?? [];
            const editable = messages.some((m) => m.severity === "error");
            return (
              <tr key={row.rowNumber} className="border-t align-top">
                <td className="px-2 py-1.5 text-muted-foreground tabular-nums">
                  {row.rowNumber}
                </td>
                {COLUMNS.map((c) => {
                  const cellMessages = messages.filter(
                    (m) => m.column === c.key,
                  );
                  const severity = cellMessages.some(
                    (m) => m.severity === "error",
                  )
                    ? "error"
                    : cellMessages.length
                      ? "warning"
                      : null;
                  const text = cellText(row.values[c.key]);
                  return (
                    <td
                      key={c.key}
                      className={
                        severity === "error"
                          ? "bg-destructive/10 px-1 py-1"
                          : severity === "warning"
                            ? "bg-warning/10 px-1 py-1"
                            : "px-1 py-1"
                      }
                    >
                      {editable && c.key !== "time" ? (
                        <Input
                          key={`${row.rowNumber}-${c.key}-${text}`}
                          defaultValue={text}
                          aria-label={`Zeile ${row.rowNumber}, ${c.header}`}
                          aria-invalid={severity === "error"}
                          className="h-7 min-w-24"
                          onBlur={(e) => {
                            if (e.target.value.trim() !== text) {
                              props.onEdit(
                                row.rowNumber,
                                c.key,
                                e.target.value,
                              );
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                        />
                      ) : (
                        <span className="flex items-center gap-1 px-1 py-0.5">
                          {c.key === "time" && editable && (
                            <LockIcon
                              className="size-3 shrink-0 text-muted-foreground"
                              aria-label="In Excel korrigieren"
                            />
                          )}
                          {text || (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="min-w-64 px-2 py-1.5">
                  <ul className="flex flex-col gap-1">
                    {messages.map((m, i) => (
                      <li key={i} className="flex gap-1.5">
                        {m.severity === "error" ? (
                          <XCircleIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                        ) : (
                          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
                        )}
                        <span>{m.message}</span>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Beschriftung umschließt das Eingabefeld und ist damit ihm zugeordnet. */
function Field(props: {
  label: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Label className="flex flex-col items-stretch gap-1.5">
      <span className={props.invalid ? "text-destructive" : undefined}>
        {props.label}
      </span>
      {props.children}
    </Label>
  );
}

function positiveNumber(text: string): number | null {
  const parsed = parseGermanNumber(text);
  return parsed.ok && parsed.value > 0 ? parsed.value : null;
}

function nonNegativeNumber(text: string): number | null {
  const parsed = parseGermanNumber(text);
  return parsed.ok && parsed.value >= 0 ? parsed.value : null;
}

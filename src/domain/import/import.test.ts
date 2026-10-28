import { describe, expect, it } from "vitest";
import { evaluateScenario } from "../calc/evaluate";
import { buildScenario, nameFromFilename } from "./buildScenario";
import {
  normalizeEmployee,
  parseGermanNumber,
  parseTime,
  splitPredecessors,
} from "./cells";
import { mapHeaders } from "./template";
import { validateRows, type RawRow } from "./validateRows";

type Values = RawRow["values"];
const base: Values = {
  id: "A",
  station: "T17",
  description: "Montage",
  time: 1.25,
  employee: "Mitarbeiter 1",
  sequence: 1,
  predecessors: null,
  timeKind: null,
  holdsStation: null,
};
const rows = (...values: Partial<Values>[]): RawRow[] =>
  values.map((v, i) => ({ rowNumber: i + 2, values: { ...base, ...v } }));
const errorsOf = (raw: RawRow[]) =>
  validateRows(raw).messages.filter((m) => m.severity === "error");

describe("Kopfzeile", () => {
  it("erkennt Spalten unabhängig von Schreibweise, Leerzeichen und Reihenfolge", () => {
    const mapping = mapHeaders([
      "  zeit_MIN ",
      "Extra",
      "Station",
      "arbeitsgang-id",
      "Arbeitsgang/Beschreibung",
      "Mitarbeiter",
      "Vorgänger-IDs",
      "REIHENFOLGE",
    ]);
    expect(mapping.ok && mapping.indexByKey).toMatchObject({
      time: 0,
      station: 2,
      id: 3,
    });
  });

  it("meldet fehlende und doppelte Spalten", () => {
    expect(mapHeaders(["Arbeitsgang-ID", "Station", "Station"])).toEqual({
      ok: false,
      missing: [
        "Arbeitsgang/Beschreibung",
        "Zeit_min",
        "Mitarbeiter",
        "Reihenfolge",
        "Vorgänger-IDs",
      ],
      duplicate: ["Station"],
    });
  });
});

describe("Zellwerte", () => {
  it("liest deutsche Dezimalzahlen und Zahlzellen (F80)", () => {
    expect(parseGermanNumber("1,25")).toEqual({ ok: true, value: 1.25 });
    expect(parseGermanNumber(" 3 ")).toEqual({ ok: true, value: 3 });
    expect(parseGermanNumber(2.5)).toEqual({ ok: true, value: 2.5 });
    expect(parseGermanNumber("1.25")).toEqual({ ok: false, reason: "format" });
    expect(parseGermanNumber("1.250,5")).toEqual({
      ok: false,
      reason: "format",
    });
    expect(parseGermanNumber("")).toEqual({ ok: false, reason: "missing" });
  });

  it("rundet Zeiten mit mehr als zwei Nachkommastellen kaufmännisch (E21)", () => {
    expect(parseTime(1.2533)).toEqual({
      ok: true,
      value: 1.25,
      original: 1.2533,
      rounded: true,
    });
    expect(parseTime("1,005")).toMatchObject({ value: 1.01, rounded: true });
    expect(parseTime(1.1)).toMatchObject({ value: 1.1, rounded: false });
  });

  it("lehnt Zeiten ≤ 0 ab, auch wenn sie erst durch Rundung 0 werden (F85)", () => {
    expect(parseTime(0)).toEqual({ ok: false, reason: "not_positive" });
    expect(parseTime("-1,5")).toEqual({ ok: false, reason: "not_positive" });
    expect(parseTime(0.004)).toEqual({ ok: false, reason: "not_positive" });
  });

  it("normiert Mitarbeiterbezeichnungen (F75)", () => {
    expect(normalizeEmployee("  mitarbeiter   02 ")).toBe("Mitarbeiter 2");
    expect(normalizeEmployee("Mitarbeiter3")).toBe("Mitarbeiter 3");
    expect(normalizeEmployee("Mitarbeiter 0")).toBeNull();
    expect(normalizeEmployee("MA links")).toBeNull();
  });

  it("trennt Vorgänger am Semikolon (F74)", () => {
    expect(splitPredecessors(" A ; B;;C ")).toEqual(["A", "B", "C"]);
    expect(splitPredecessors(10)).toEqual(["10"]);
    expect(splitPredecessors(null)).toEqual([]);
  });
});

describe("validateRows", () => {
  it("akzeptiert eine gültige Datei und überspringt leere Zeilen", () => {
    const result = validateRows([
      ...rows({ id: "A" }, { id: "B", predecessors: "A" }),
      {
        rowNumber: 4,
        values: {
          id: null,
          station: " ",
          description: null,
          time: null,
          employee: null,
          sequence: null,
          predecessors: null,
          timeKind: null,
          holdsStation: null,
        },
      },
    ]);
    expect(result.hasErrors).toBe(false);
    expect(result.rows).toHaveLength(2);
  });

  it("blockiert fehlende Pflichtfelder mit Zeile und Spalte (F81, F86)", () => {
    expect(errorsOf(rows({ station: null, time: null, sequence: "" }))).toEqual(
      [
        {
          severity: "error",
          rowNumber: 2,
          column: "station",
          message: "Station fehlt.",
        },
        {
          severity: "error",
          rowNumber: 2,
          column: "time",
          message: "Zeit fehlt.",
        },
        {
          severity: "error",
          rowNumber: 2,
          column: "sequence",
          message: "Reihenfolge fehlt.",
        },
      ],
    );
  });

  it("warnt bei fehlendem Mitarbeiter und gerundeter Zeit, ohne zu blockieren (F78, E21)", () => {
    const result = validateRows(rows({ employee: null, time: "2,345" }));
    expect(result.hasErrors).toBe(false);
    expect(result.messages.map((m) => [m.column, m.severity])).toEqual([
      ["time", "warning"],
      ["employee", "warning"],
    ]);
    expect(result.rows[0]).toMatchObject({ timeMin: 2.35, employee: null });
  });

  it("nimmt Reihenfolgen mit Dezimalkomma an und blockiert negative (F30)", () => {
    const result = validateRows(rows({ sequence: "2,5" }));
    expect(result.hasErrors).toBe(false);
    expect(result.rows[0].sequence).toBe(2.5);
    expect(errorsOf(rows({ sequence: "-1" }))).toEqual([
      {
        severity: "error",
        rowNumber: 2,
        column: "sequence",
        message: "Reihenfolge darf nicht negativ sein.",
      },
    ]);
  });

  it("warnt einmal je Mitarbeiter, der an mehreren Stationen arbeitet (E40)", () => {
    const result = validateRows(
      rows(
        { id: "A", station: "T18" },
        { id: "B", station: "T17" },
        { id: "C", station: "T18", employee: "Mitarbeiter 2" },
        { id: "D", station: "T18" },
      ),
    );
    expect(result.hasErrors).toBe(false);
    expect(result.messages).toEqual([
      {
        severity: "warning",
        rowNumber: 2,
        column: "employee",
        message:
          "„Mitarbeiter 1“ hat Arbeitsgänge an 2 Stationen (T17, T18) und wird als eine Person nacheinander eingeplant. Ist das nicht gewollt, je Person eine eigene Nummer vergeben.",
      },
    ]);
  });

  it("blockiert ungültige Mitarbeiterbezeichnungen", () => {
    expect(errorsOf(rows({ employee: "MA links" }))[0].column).toBe("employee");
  });

  it("blockiert doppelte Arbeitsgang-IDs in allen betroffenen Zeilen (F69)", () => {
    expect(
      errorsOf(rows({ id: "A" }, { id: "B" }, { id: "A" })).map(
        (m) => m.rowNumber,
      ),
    ).toEqual([2, 4]);
  });

  it("blockiert unbekannte, doppelte und selbstbezogene Vorgänger (F79)", () => {
    const messages = errorsOf(
      rows({ id: "A", predecessors: "X;A" }, { id: "B", predecessors: "A;A" }),
    );
    expect(messages.map((m) => m.message)).toEqual([
      "Vorgänger „X“ existiert nicht.",
      "Ein Arbeitsgang kann nicht sein eigener Vorgänger sein.",
      "Vorgänger „A“ ist doppelt angegeben.",
    ]);
  });

  it("blockiert Vorgängerkreise in jeder beteiligten Zeile (F87)", () => {
    const messages = errorsOf(
      rows(
        { id: "A", predecessors: "C" },
        { id: "B", predecessors: "A" },
        { id: "C", predecessors: "B" },
        { id: "D" },
      ),
    );
    expect(messages.map((m) => [m.rowNumber, m.message])).toEqual([
      [2, "Vorgängerkreis zwischen A, B, C."],
      [3, "Vorgängerkreis zwischen A, B, C."],
      [4, "Vorgängerkreis zwischen A, B, C."],
    ]);
  });
});

describe("buildScenario", () => {
  it("leitet Stationen und Mitarbeiter ab und ist direkt berechenbar (F82, F83)", () => {
    const { rows: parsed } = validateRows(
      rows(
        { id: "A", station: "T17", employee: "Mitarbeiter 1" },
        {
          id: "B",
          station: "T17",
          employee: "mitarbeiter 2",
          predecessors: "A",
        },
        { id: "C", station: "T18", employee: null },
      ),
    );
    const scenario = buildScenario(parsed, { taktMin: 4, allowancePct: 0 });
    expect(scenario.stations.map((s) => s.label)).toEqual(["T17", "T18"]);
    expect(scenario.employees.map((e) => e.label)).toEqual([
      "Mitarbeiter 1",
      "Mitarbeiter 2",
    ]);
    expect(scenario.steps.find((s) => s.id === "C")!.employeeId).toBeNull();

    const result = evaluateScenario(scenario);
    expect(result.stations[0].employeeCount).toBe(2);
    expect(result.kpis.unassignedStepCount).toBe(1);
  });

  it("verweigert fehlerhafte Zeilen", () => {
    const { rows: parsed } = validateRows(rows({ time: null }));
    expect(() =>
      buildScenario(parsed, { taktMin: 4, allowancePct: 0 }),
    ).toThrow(/nicht fehlerfrei/);
  });
});

describe("nameFromFilename (F88)", () => {
  it("entfernt Pfad und Endung", () => {
    expect(nameFromFilename("C:\\Daten\\XT 686 EF.xlsx")).toBe("XT 686 EF");
    expect(nameFromFilename("Variante.B.XLSM")).toBe("Variante.B");
  });
});

describe("Zeitart (E44)", () => {
  it("lässt die optionalen Spalten fehlen", () => {
    const mapping = mapHeaders([
      "Arbeitsgang-ID",
      "Station",
      "Arbeitsgang/Beschreibung",
      "Zeit_min",
      "Mitarbeiter",
      "Reihenfolge",
      "Vorgänger-IDs",
    ]);
    expect(mapping.ok && mapping.indexByKey).toMatchObject({
      timeKind: null,
      holdsStation: null,
    });
  });

  it("übernimmt Prozesszeiten ohne Mitarbeiter und ohne Warnung", () => {
    const raw = rows(
      { id: "P" },
      {
        id: "L",
        employee: null,
        timeKind: "Prozess",
        holdsStation: "ja",
        predecessors: "P",
        sequence: 2,
      },
      { id: "K", timeKind: "hand", holdsStation: "nein", predecessors: "L" },
    );
    const result = validateRows(raw);
    expect(result.messages).toEqual([]);
    const input = buildScenario(result.rows, { taktMin: 10, allowancePct: 0 });
    expect(input.steps.find((s) => s.id === "L")).toMatchObject({
      employeeId: null,
      timeKind: "process",
      holdsStation: true,
    });
    expect(input.steps.find((s) => s.id === "K")).not.toHaveProperty(
      "timeKind",
    );
    expect(evaluateScenario(input).kpis.incomplete).toBe(false);
  });

  it("meldet unbekannte Werte und Widersprüche als Fehler", () => {
    const errors = errorsOf(
      rows(
        { id: "A", timeKind: "Maschine" },
        { id: "B", holdsStation: "vielleicht" },
        { id: "C", holdsStation: "ja" },
        { id: "D", timeKind: "Prozess" },
      ),
    );
    expect(errors.map((e) => [e.rowNumber, e.column])).toEqual([
      [2, "timeKind"],
      [3, "holdsStation"],
      [4, "holdsStation"],
      [5, "employee"],
    ]);
  });
});

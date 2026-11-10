// Automatischer Lauf des Skills ui-review. Start über ui-review.config.ts (siehe dort).
// Je Datensatz, Auflösung und Ansicht: Bildschirmfotos und Messungen, die Hinweise für
// die Sichtprüfung liefern. Messwerte sind keine Befunde – jeder Wert wird im Bild geprüft.
import ExcelJS from "exceljs";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createTemplate } from "@/features/import/workbook";
import {
  exampleWorkbook,
  importExample,
  XLSX_MIME,
} from "../../../../tests/e2e/fixtures";
import { staffingWorkbook } from "../../../../tests/e2e/staffing-fixture";

// Außerhalb des Repos: npm run e2e leert test-results/ bei jedem Lauf.
const OUT =
  process.env.UI_REVIEW_OUT ?? resolve(tmpdir(), "linebalancing-ui-review");
const IMG = resolve(OUT, "bilder");
mkdirSync(IMG, { recursive: true });

const VIEWPORTS = [
  { name: "Laptop", width: 1366, height: 768 },
  { name: "Desktop", width: 1920, height: 1080 },
  { name: "Workshop", width: 2560, height: 1440 },
] as const;
// Tastaturdurchlauf nur bei einer Auflösung, sonst wiederholen sich die Ergebnisse.
const TAB_VIEWPORT = "Desktop";
// Ansichten mit Yamazumi: Ladezeit wird bis zum sichtbaren Diagramm gemessen.
const CHART_VIEWS = [
  "stationen",
  "mitarbeiter",
  "details",
  "vergleich",
  "vollbild",
];
const CHART = '[aria-label^="Station "], [aria-label^="Balken "]';

type Measure = Awaited<ReturnType<typeof measure>>;
interface Row {
  setup: string;
  view: string;
  viewport: string;
  ok: boolean;
  error?: string;
  loadMs?: number;
  images: string[];
  errors: string[];
  measure?: Measure;
  tab?: Awaited<ReturnType<typeof tabWalk>>;
}
const rows: Row[] = [];

// ---------------------------------------------------------------- Testdaten

const STEPS = [
  "Kabelbaum verlegen",
  "Dachhaube montieren",
  "Verschrauben",
  "Stecker prüfen",
  "Dichtung einlegen",
  "Halter anbringen",
  "Etikett kleben",
  "Sichtprüfung",
];

/** Realistische Linie: 20 Stationen, 60 Mitarbeiter, 160 Arbeitsgänge, IDs im Konverterformat. */
async function lineWorkbook(): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await createTemplate());
  const sheet = book.getWorksheet("Arbeitsgänge")!;
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, col) => (headers[col] = String(cell.value)));
  const col = (name: string) => headers.indexOf(name);
  let sequence = 0;
  for (let s = 0; s < 20; s++) {
    const station = `T${17 + s}`;
    for (let k = 0; k < 8; k++) {
      const id = `${station}-AA${String((k + 1) * 10).padStart(3, "0")}`;
      // Gemischte Linie: die meisten Stationen unter Takt, einige knapp darüber.
      let time = 10 + ((s * 7 + k * 13) % 13) + 0.25 * ((k * s) % 4);
      if (s === 5) time += 14; // eine deutlich überlastete Station
      const values: Record<string, unknown> = {
        "Arbeitsgang-ID": id,
        Station: station,
        "Arbeitsgang/Beschreibung": `${STEPS[k]} ${station}`,
        Zeit_min: time,
        // Station 10: ein Arbeitsgang ohne Mitarbeiter
        Mitarbeiter:
          s === 10 && k === 7 ? null : `Mitarbeiter ${s * 3 + (k % 3) + 1}`,
        Reihenfolge: ++sequence,
        "Vorgänger-IDs":
          k > 0 && k % 3 === 0
            ? `${station}-AA${String(k * 10).padStart(3, "0")}`
            : null,
      };
      const row: unknown[] = [];
      for (const [name, value] of Object.entries(values))
        if (col(name) > 0) row[col(name)] = value;
      sheet.addRow(row);
    }
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function importLine(page: Page) {
  await page.goto("/import");
  const file = page.getByLabel("Excel-Datei (.xlsx)");
  await expect(file).toBeEnabled();
  await file.setInputFiles({
    name: "Linie realistisch.xlsx",
    mimeType: XLSX_MIME,
    buffer: await lineWorkbook(),
  });
  await expect(page.getByText("160 Arbeitsgänge ohne Fehler")).toBeVisible({
    timeout: 30_000,
  });
  const variant = page.getByLabel("Variantenname");
  if (await variant.isVisible()) await variant.fill("Linie realistisch");
  await page.getByLabel("Taktzeit [min]").fill("70,00");
  await page.getByLabel("Zuschlag [%]").fill("10");
  await page.getByRole("button", { name: "Szenario anlegen" }).click();
  await expect(page).toHaveURL(/\/szenario\?ist=/, { timeout: 30_000 });
}

/** Kopie als Ziel anlegen, damit Vergleich und Ist/Ziel geprüft werden können. */
async function duplicate(page: Page) {
  await page.getByRole("button", { name: "Duplizieren" }).click();
  await expect(page.getByLabel("Szenario für Ziel")).toHaveValue(/.+/);
}

async function importStaffing(page: Page) {
  await page
    .getByRole("main")
    .getByRole("link", { name: "Personalplanung", exact: true })
    .click();
  await page.getByLabel("Personalplanung (.xlsx)").setInputFiles({
    name: "Personalplanung Test.xlsx",
    mimeType: XLSX_MIME,
    buffer: await staffingWorkbook(),
  });
  await page
    .getByRole("button", { name: "Personalplanung im Projekt speichern" })
    .click();
  await page.waitForLoadState("networkidle");
}

// ---------------------------------------------------------------- Ansichten

type View = {
  name: string;
  open: (page: Page, scenarioUrl: string) => Promise<void>;
  after?: (page: Page) => Promise<void>;
  setups?: string[];
};

async function setViewMode(page: Page, mode: "Stationen" | "Mitarbeiter") {
  const button = page
    .getByRole("group", { name: "Ansicht" })
    .getByRole("button", { name: mode, exact: true });
  // Erst nach dem Hydrieren klicken, sonst geht der Klick ins Leere.
  await page.locator(CHART).first().waitFor({ state: "visible" });
  await expect(async () => {
    if ((await button.getAttribute("aria-pressed")) !== "true")
      await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true", {
      timeout: 1_000,
    });
  }).toPass({ timeout: 10_000 });
}

const VIEWS: View[] = [
  { name: "start", open: (p) => p.goto("/").then(() => undefined) },
  { name: "import-leer", open: (p) => p.goto("/import").then(() => undefined) },
  {
    name: "import-korrektur",
    setups: ["beispiel"],
    open: async (p) => {
      await p.goto("/import");
      await p.getByLabel("Excel-Datei (.xlsx)").setInputFiles({
        name: "Beispiel XT.xlsx",
        mimeType: XLSX_MIME,
        buffer: await exampleWorkbook(),
      });
      await expect(p.getByLabel("Zeile 6, Station")).toBeVisible();
    },
  },
  {
    name: "stationen",
    open: async (p, url) => {
      await p.goto(url);
      await setViewMode(p, "Stationen");
    },
  },
  {
    name: "mitarbeiter",
    open: async (p, url) => {
      await p.goto(url);
      await setViewMode(p, "Mitarbeiter");
    },
    after: (p) => setViewMode(p, "Stationen"),
  },
  {
    name: "details",
    open: async (p, url) => {
      await p.goto(url);
      await setViewMode(p, "Stationen");
      await p
        .getByRole("button", { name: /^Arbeitsgang / })
        .first()
        .click();
      await expect(p.getByRole("complementary").first()).toBeVisible();
    },
    after: (p) => p.keyboard.press("Escape"),
  },
  {
    // F142: Panel öffnen, Berechnung nicht starten (Ergebnis wäre ein neues Szenario).
    name: "vorschlag",
    open: async (p, url) => {
      await p.goto(url);
      await setViewMode(p, "Stationen");
      await p.getByRole("button", { name: "Verteilung vorschlagen" }).click();
      await expect(
        p.getByRole("dialog", { name: "Verteilung vorschlagen" }),
      ).toBeVisible();
    },
    after: (p) => p.keyboard.press("Escape"),
  },
  {
    name: "tabelle",
    open: async (p, url) => {
      await p.goto(url);
      await p.getByRole("link", { name: "Tabelle" }).click();
      await p.waitForURL(/tabelle/);
    },
  },
  {
    name: "vergleich",
    open: async (p, url) => {
      await p.goto(url);
      await p.getByRole("button", { name: "Vergleich" }).click();
      await expect(
        p.getByRole("region", { name: "Ist", exact: true }),
      ).toBeVisible();
    },
    after: async (p) => {
      // Vergleich wieder ausschalten, falls die Einstellung gespeichert wird.
      const b = p.getByRole("button", { name: "Vergleich" });
      if (await b.count()) await b.click();
    },
  },
  {
    name: "vollbild",
    open: async (p, url) => {
      await p.goto(url);
      await p.getByRole("button", { name: "Vollbild", exact: true }).click();
      await expect(p.getByText("Vollbild beenden")).toBeVisible();
    },
    after: async (p) => {
      const b = p.getByText("Vollbild beenden");
      if (await b.count()) await b.click();
    },
  },
  {
    name: "personalplanung",
    open: async (p, url) => {
      await p.goto(url);
      await p
        .getByRole("main")
        .getByRole("link", { name: "Personalplanung", exact: true })
        .click();
      await expect(
        p.getByRole("heading", { name: "Personalplanung", exact: true }),
      ).toBeVisible();
    },
  },
  {
    name: "login",
    setups: ["beispiel"],
    open: (p) => p.goto("/login").then(() => undefined),
  },
];

// ---------------------------------------------------------------- Messungen

function measure(page: Page) {
  return page.evaluate((chartSelector) => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return (
        r.width > 0 &&
        r.height > 0 &&
        s.visibility !== "hidden" &&
        s.display !== "none" &&
        Number(s.opacity) > 0
      );
    };
    const describe = (el: Element) =>
      el.outerHTML.replace(/\s+/g, " ").slice(0, 140);
    const nameOf = (el: Element) => {
      const aria = el.getAttribute("aria-label");
      if (aria?.trim()) return aria.trim();
      const by = el.getAttribute("aria-labelledby");
      if (by)
        return by
          .split(" ")
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
      const id = el.getAttribute("id");
      const label =
        (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
        el.closest("label");
      if (label?.textContent?.trim()) return label.textContent.trim();
      const text = (el as HTMLElement).innerText?.trim();
      if (text) return text;
      const alt = el.querySelector("img[alt]")?.getAttribute("alt");
      if (alt) return alt;
      return el.getAttribute("title")?.trim() ?? "";
    };

    const interactive = [
      ...document.querySelectorAll(
        'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="slider"], [role="checkbox"], [role="switch"], [role="tab"], [role="menuitem"], [tabindex]:not([tabindex="-1"])',
      ),
    ].filter(visible);
    const unnamed = interactive.filter((el) => !nameOf(el)).map(describe);
    const smallTargets = interactive
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 24 || r.height < 24)
      .map(
        ({ el, r }) =>
          `${Math.round(r.width)}×${Math.round(r.height)} ${nameOf(el).slice(0, 60) || describe(el)}`,
      );
    const imgNoAlt = [...document.querySelectorAll("img")]
      .filter((i) => visible(i) && !i.hasAttribute("alt"))
      .map(describe);

    const smallFonts: string[] = [];
    const upper: string[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const seen = new Set<Element>();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      const text = node.textContent?.trim();
      if (!el || !text || seen.has(el) || !visible(el)) continue;
      if (el.closest("nextjs-portal, script, style")) continue;
      seen.add(el);
      const s = getComputedStyle(el);
      const size = parseFloat(s.fontSize);
      if (size < 12) smallFonts.push(`${size}px „${text.slice(0, 50)}“`);
      if (s.textTransform === "uppercase" && text.length > 2)
        upper.push(text.slice(0, 50));
    }

    const body = document.body.innerText;
    const find = (re: RegExp) =>
      [...new Set(body.match(re) ?? [])].slice(0, 15);
    const decimalPoint = find(/(?<![\d.\w-])\d+\.\d{1,2}(?![\d.])/g);
    const english = find(
      /\b(Loading|Submit|Cancel|Save|Delete|Error|Search|Close|Next|Previous|No results|Choose File|No file chosen|Browse|undefined|NaN|null|\[object Object\]|Invalid|Required)\b/g,
    );
    const broken = find(/Ã.|â€.|�|&[a-z]+;/g);

    // Gestaltungsqualität: Browser-Standardelemente und Vielfalt der Stilwerte.
    // Diagramm-Inhalte bleiben außen vor, sie haben eigene Regeln.
    const inChart = (el: Element) =>
      !!el.closest(`${chartSelector}, svg, nextjs-portal`);
    const native: string[] = [];
    const radii = new Set<string>();
    const shadows = new Set<string>();
    const fontSizes = new Set<number>();
    const fontFamilies = new Set<string>();
    const textColors = new Set<string>();
    const buttonStyles = new Map<string, string[]>();
    for (const el of document.body.querySelectorAll("*")) {
      if (!visible(el) || inChart(el)) continue;
      const s = getComputedStyle(el);
      const tag = el.tagName;
      const type = el.getAttribute("type");
      // Gestaltete Auswahllisten (appearance: none, eigener Pfeil) zählen nicht.
      if (tag === "SELECT" && s.appearance !== "none")
        native.push(`Auswahlliste „${nameOf(el).slice(0, 40)}“`);
      else if (
        tag === "INPUT" &&
        (type === "radio" || type === "checkbox") &&
        s.appearance !== "none" &&
        // verborgene Eingaben hinter gestalteten Schaltern nicht zählen
        el.getBoundingClientRect().width > 2 &&
        s.opacity !== "0"
      )
        native.push(
          `${type === "radio" ? "Optionsfeld" : "Kästchen"} „${nameOf(el).slice(0, 40)}“`,
        );
      else if (
        tag === "INPUT" &&
        type === "file" &&
        el.getBoundingClientRect().width > 2
      )
        native.push(`Datei-Auswahl „${nameOf(el).slice(0, 40)}“`);
      else if (tag === "SUMMARY" && s.display === "list-item")
        native.push(
          `Aufklapper mit Browser-Dreieck „${nameOf(el).slice(0, 40)}“`,
        );
      if (s.borderRadius !== "0px") radii.add(s.borderRadius);
      if (s.boxShadow !== "none") shadows.add(s.boxShadow);
      if (
        [...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent?.trim(),
        )
      ) {
        fontSizes.add(parseFloat(s.fontSize));
        fontFamilies.add(
          s.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
        );
        textColors.add(s.color);
      }
      const forFile =
        tag === "LABEL" &&
        (el.querySelector('input[type="file"]') ||
          document
            .getElementById(el.getAttribute("for") ?? "")
            ?.matches('input[type="file"]'));
      // Umschalter (gewählt/nicht gewählt) und Spaltenköpfe sehen bewusst anders aus.
      const stateful =
        el.hasAttribute("aria-pressed") ||
        el.getAttribute("aria-expanded") === "true" ||
        el.getAttribute("role") === "tab" ||
        !!el.closest("th");
      if (
        !stateful &&
        (tag === "BUTTON" || el.getAttribute("role") === "button" || forFile)
      ) {
        const r = el.getBoundingClientRect();
        const sig = `Hintergrund ${s.backgroundColor}, Text ${s.color}, Rand ${s.borderTopWidth} ${s.borderTopColor}, Höhe ${Math.round(r.height)}, Radius ${s.borderRadius}`;
        const name = nameOf(el).replace(/\s+/g, " ").slice(0, 40);
        buttonStyles.set(sig, [...(buttonStyles.get(sig) ?? []), name]);
      }
    }

    const chart = [...document.querySelectorAll(chartSelector)].find(visible);
    const doc = document.documentElement;
    return {
      overflowX: doc.scrollWidth > window.innerWidth + 1,
      scrollWidth: doc.scrollWidth,
      pageHeight: doc.scrollHeight,
      chartTop: chart
        ? Math.round(chart.getBoundingClientRect().top + window.scrollY)
        : null,
      interactive: interactive.length,
      unnamed: unnamed.slice(0, 15),
      unnamedCount: unnamed.length,
      smallTargets: smallTargets.slice(0, 15),
      smallTargetCount: smallTargets.length,
      imgNoAlt,
      smallFonts: smallFonts.slice(0, 15),
      smallFontCount: smallFonts.length,
      upper: upper.slice(0, 10),
      decimalPoint,
      english,
      broken,
      design: {
        native: [...new Set(native)].slice(0, 15),
        fontSizes: [...fontSizes].sort((a, b) => a - b),
        fontFamilies: [...fontFamilies],
        textColorCount: textColors.size,
        radii: [...radii],
        shadowCount: shadows.size,
        buttonStyles: [...buttonStyles].map(([sig, names]) => ({
          sig,
          names: [...new Set(names)],
        })),
      },
    };
  }, CHART);
}

/** Tab-Durchlauf: wie viele Elemente erreichbar, welche ohne sichtbaren Fokus. */
async function tabWalk(page: Page) {
  await page
    .locator("body")
    .click({ position: { x: 1, y: 1 } })
    .catch(() => {});
  const reached: string[] = [];
  const invisible: string[] = [];
  for (let i = 0; i < 150; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      // Entwicklungswerkzeug von Next.js gehört nicht zur App.
      if (el.tagName === "NEXTJS-PORTAL")
        return { key: "dev", name: "", shown: true, skip: true };
      const marks = (s: CSSStyleDeclaration) =>
        (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
        (s.boxShadow !== "none" && s.boxShadow !== "") ||
        false;
      const shown =
        marks(getComputedStyle(el)) ||
        marks(getComputedStyle(el, "::before")) ||
        marks(getComputedStyle(el, "::after"));
      const name = (
        el.getAttribute("aria-label") ||
        el.innerText ||
        el.getAttribute("title") ||
        el.tagName
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60);
      return {
        key: `${el.tagName}|${name}|${el.getBoundingClientRect().top}`,
        name,
        shown,
        skip: false,
      };
    });
    if (!info || info.skip) break;
    if (reached.includes(info.key)) break; // einmal herum
    reached.push(info.key);
    if (!info.shown) invisible.push(info.name);
  }
  return {
    reached: reached.length,
    invisibleCount: invisible.length,
    invisible: [...new Set(invisible)].slice(0, 15),
  };
}

// ---------------------------------------------------------------- Ablauf

async function runViews(page: Page, setup: string, scenarioUrl: string) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const view of VIEWS) {
      if (view.setups && !view.setups.includes(setup)) continue;
      const row: Row = {
        setup,
        view: view.name,
        viewport: `${vp.name} ${vp.width}×${vp.height}`,
        ok: false,
        images: [],
        errors: [],
      };
      const onConsole = (m: { type(): string; text(): string }) => {
        if (m.type() === "error")
          row.errors.push(`Konsole: ${m.text().slice(0, 200)}`);
      };
      const onPageError = (e: Error) =>
        row.errors.push(`Seite: ${e.message.slice(0, 200)}`);
      const onFailed = (r: {
        url(): string;
        failure(): { errorText: string } | null;
      }) => {
        // Abgebrochene Seitenwechsel-Anfragen von Next.js (_rsc) sind normal.
        const text = r.failure()?.errorText ?? "";
        const aborted =
          text.includes("ERR_ABORTED") && r.url().includes("_rsc=");
        if (!aborted && !/_next\/webpack-hmr|__nextjs/.test(r.url()))
          row.errors.push(
            `Anfrage: ${r.url()} ${r.failure()?.errorText ?? ""}`,
          );
      };
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("requestfailed", onFailed);
      try {
        const started = Date.now();
        await view.open(page, scenarioUrl);
        await page.waitForLoadState("networkidle").catch(() => {});
        if (CHART_VIEWS.includes(view.name))
          await page
            .locator(CHART)
            .first()
            .waitFor({ state: "visible", timeout: 15_000 });
        row.loadMs = Date.now() - started;
        await page.waitForTimeout(300); // Übergänge abklingen lassen
        const base = `${setup}-${view.name}-${vp.width}x${vp.height}`;
        await page.screenshot({ path: resolve(IMG, `${base}.png`) });
        await page.screenshot({
          path: resolve(IMG, `${base}-ganz.png`),
          fullPage: true,
        });
        row.images.push(`${base}.png`, `${base}-ganz.png`);
        row.measure = await measure(page);
        if (vp.name === TAB_VIEWPORT) row.tab = await tabWalk(page);
        row.ok = true;
        await view.after?.(page);
      } catch (e) {
        row.error = (e as Error).message.split("\n")[0].slice(0, 300);
        await page
          .screenshot({
            path: resolve(
              IMG,
              `${setup}-${view.name}-${vp.width}x${vp.height}-abbruch.png`,
            ),
          })
          .catch(() => {});
      } finally {
        page.off("console", onConsole);
        page.off("pageerror", onPageError);
        page.off("requestfailed", onFailed);
        rows.push(row);
      }
    }
  }
}

test("Beispiel E7 (2 Stationen, mit Personalplanung)", async ({ page }) => {
  await importExample(page, { allowance: "10" });
  await duplicate(page);
  const scenarioUrl = page.url();
  await importStaffing(page);
  await runViews(page, "beispiel", scenarioUrl);
});

test("Realistische Linie (20 Stationen, 160 Arbeitsgänge)", async ({
  page,
}) => {
  await importLine(page);
  await duplicate(page);
  await runViews(page, "linie", page.url());
});

test.afterAll(() => {
  writeFileSync(resolve(OUT, "ergebnis.json"), JSON.stringify(rows, null, 2));
  const yes = (n: number | undefined) => (n ? String(n) : "–");
  const lines = [
    `# Automatischer Lauf ui-review – ${new Date().toLocaleString("de-DE")}`,
    "",
    `Bilder: ${IMG}`,
    "",
    "Messwerte sind Hinweise. Jeden Wert im Bild prüfen.",
    "",
    "| Daten | Ansicht | Auflösung | Laden ms | Diagramm px | Überlauf | Fehler | ohne Namen | Schrift <12 | Klickfl. <24 | Text | Fokus unsichtbar | Browser-Elemente | Schriftgrößen | Radien | Knopfstile |",
    "| --- | --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: |",
  ];
  for (const r of rows) {
    const m = r.measure;
    const text = m
      ? [
          m.decimalPoint.length && "Punkt",
          m.english.length && "Englisch",
          m.broken.length && "Zeichen",
          m.upper.length && "Großbuchst.",
        ]
          .filter(Boolean)
          .join(", ") || "–"
      : "–";
    lines.push(
      r.ok
        ? `| ${r.setup} | ${r.view} | ${r.viewport} | ${r.loadMs} | ${m?.chartTop ?? "–"} | ${m?.overflowX ? `ja (${m.scrollWidth})` : "–"} | ${yes(r.errors.length)} | ${yes(m?.unnamedCount)} | ${yes(m?.smallFontCount)} | ${yes(m?.smallTargetCount)} | ${text} | ${r.tab ? `${r.tab.invisibleCount}/${r.tab.reached}` : ""} | ${yes(m?.design.native.length)} | ${m?.design.fontSizes.length ?? "–"} | ${m?.design.radii.length ?? "–"} | ${m?.design.buttonStyles.length ?? "–"} |`
        : `| ${r.setup} | ${r.view} | ${r.viewport} | **Abbruch:** ${r.error?.replace(/\|/g, "/")} |||||||||||||`,
    );
  }
  lines.push("", "## Einzelheiten", "");
  for (const r of rows) {
    const m = r.measure;
    const parts: string[] = [];
    const list = (title: string, items?: string[]) => {
      if (items?.length)
        parts.push(
          `- **${title}:** ${items.map((i) => `\`${i.replace(/`/g, "'")}\``).join(", ")}`,
        );
    };
    list("Fehler", r.errors);
    list("Ohne zugänglichen Namen", m?.unnamed);
    list("Bilder ohne Alternativtext", m?.imgNoAlt);
    list("Kleine Schrift", m?.smallFonts);
    list("Kleine Klickflächen", m?.smallTargets);
    list("Dezimalpunkt", m?.decimalPoint);
    list("Englisch/technisch", m?.english);
    list("Kaputte Zeichen", m?.broken);
    list("Großbuchstaben", m?.upper);
    list("Fokus nicht sichtbar", r.tab?.invisible);
    list("Browser-Standardelemente", m?.design.native);
    // Stilvielfalt nur bei Desktop ausführlich, sonst wiederholt sie sich.
    if (m && r.viewport.startsWith(TAB_VIEWPORT)) {
      list("Schriftgrößen (px)", m.design.fontSizes.map(String));
      list("Schriftfamilien", m.design.fontFamilies);
      list("Eckenradien", m.design.radii);
      parts.push(
        `- **Textfarben / Schatten:** ${m.design.textColorCount} / ${m.design.shadowCount}`,
      );
      list(
        "Knopfstile",
        m.design.buttonStyles.map(
          (b) => `${b.sig} → ${b.names.slice(0, 4).join(" · ")}`,
        ),
      );
    }
    if (parts.length)
      lines.push(
        `### ${r.setup} · ${r.view} · ${r.viewport}`,
        "",
        ...parts,
        "",
      );
  }
  // Seitenübergreifend: gleich beschriftete Knöpfe in verschiedenen Stilen.
  const byName = new Map<string, Map<string, Set<string>>>();
  for (const r of rows) {
    if (!r.measure || !r.viewport.startsWith(TAB_VIEWPORT)) continue;
    for (const b of r.measure.design.buttonStyles)
      for (const name of b.names) {
        if (!name) continue;
        const sigs = byName.get(name) ?? new Map<string, Set<string>>();
        sigs.set(b.sig, (sigs.get(b.sig) ?? new Set()).add(r.view));
        byName.set(name, sigs);
      }
  }
  const mixed = [...byName].filter(([, sigs]) => sigs.size > 1);
  lines.push("## Gleicher Knopf, verschiedene Stile (Desktop)", "");
  if (!mixed.length) lines.push("Keine.", "");
  for (const [name, sigs] of mixed) {
    lines.push(`- **${name}**`);
    for (const [sig, views] of sigs)
      lines.push(`  - ${[...views].join(", ")}: ${sig}`);
  }
  lines.push(
    "",
    "Hinweis: Ein Knopf kann je Zustand (gewählt/nicht gewählt) bewusst anders aussehen – im Bild prüfen.",
  );
  writeFileSync(resolve(OUT, "ergebnis.md"), lines.join("\n"));
});

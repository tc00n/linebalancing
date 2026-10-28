import { readFileSync, readdirSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
import pg from "pg";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const localDb = ["localhost", "127.0.0.1"].includes(
  new URL(process.env.SUPABASE_DB_URL).hostname,
);
const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: localDb
    ? false
    : {
        rejectUnauthorized: true,
        ca: readFileSync("supabase/certs/prod-ca-2021.crt", "utf8"),
      },
  connectionTimeoutMillis: 15000,
});
const owner = "10000000-0000-4000-8000-000000000001",
  editor = "10000000-0000-4000-8000-000000000002",
  outsider = "10000000-0000-4000-8000-000000000003",
  staffEditor = "10000000-0000-4000-8000-000000000004";
const sid = "20000000-0000-4000-8000-000000000001",
  otherSid = "20000000-0000-4000-8000-000000000002";
// Sperrkennungen je Browser-Tab (E27).
const editorTab = "50000000-0000-4000-8000-000000000001",
  editorTab2 = "50000000-0000-4000-8000-000000000002",
  ownerTab = "50000000-0000-4000-8000-000000000003";
let count = 0;
const q = (sql, args = []) => client.query(sql, args);
async function as(user, session = sid) {
  await q("reset role");
  await q("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: user, role: "authenticated", session_id: session }),
  ]);
  await q("set local role authenticated");
}
async function test(name, fn) {
  await fn();
  count++;
  console.log("OK " + name);
}
async function denied(sql, args = [], code = "42501") {
  await q("savepoint denied");
  try {
    await q(sql, args);
    assert.fail("Zugriff unerwartet erlaubt");
  } catch (e) {
    await q("rollback to savepoint denied");
    assert.equal(e.code, code);
  } finally {
    await q("release savepoint denied");
  }
}
try {
  await client.connect();
  await q("begin");
  // Ausstehende Migrationen in der Testtransaktion einspielen, damit sie vor `db:migrate` geprueft sind.
  const tracked = (
    await q(
      "select to_regclass('supabase_migrations.schema_migrations') is not null t",
    )
  ).rows[0].t;
  const applied = new Set(
    tracked
      ? (
          await q("select version from supabase_migrations.schema_migrations")
        ).rows.map((r) => r.version)
      : [],
  );
  for (const file of readdirSync("supabase/migrations").sort())
    if (file.endsWith(".sql") && !applied.has(file.split("_")[0]))
      await q(readFileSync("supabase/migrations/" + file, "utf8"));
  await q(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'phase2-owner@neonex.de',now()),($2,'phase2-editor@example.org',now()),($3,'phase2-outsider@example.org',now()),($4,'phase2-staff-editor@neonex.de',now())",
    [owner, editor, outsider, staffEditor],
  );
  await as(owner);
  const p = (await q("select public.create_project('Phase 2 Test') id")).rows[0]
    .id;
  const code = (await q("select public.get_project_code($1) code", [p])).rows[0]
    .code;
  await test("Owner sieht eigenes Projekt", async () =>
    assert.equal(
      (await q("select count(*)::int n from public.projects where id=$1", [p]))
        .rows[0].n,
      1,
    ));
  await test("Projektcode hat vereinbartes Format", async () =>
    assert.match(code, /^[A-F0-9]{5}-[A-F0-9]{5}$/));
  await as(editor);
  await test("Externe duerfen keine Projekte anlegen", () =>
    denied("select public.create_project('Verboten')"));
  await test("Ohne Code keine Projektdaten", async () =>
    assert.equal(
      (await q("select count(*)::int n from public.projects where id=$1", [p]))
        .rows[0].n,
      0,
    ));
  await test("Code- und Sitzungstabellen nicht direkt lesbar", async () => {
    for (const t of [
      "project_codes",
      "member_sessions",
      "code_attempts",
      "staff_domains",
    ])
      await denied("select * from public." + t);
  });
  const redeemed = (
    await q("select public.redeem_project_code($1) result", [code])
  ).rows[0].result;
  assert.equal(redeemed.ok, true);
  await test("Editor mit Code hat Zugriff", async () =>
    assert.equal(
      (await q("select public.can_access_project($1) ok", [p])).rows[0].ok,
      true,
    ));
  await test("Editor sieht keinen Code", () =>
    denied("select public.get_project_code($1)", [p]));
  await test("Direkte Schreibzugriffe gesperrt", async () => {
    await denied("update public.projects set name='Manipuliert' where id=$1", [
      p,
    ]);
    await denied(
      "insert into public.project_members values($1,$2,'owner','owner')",
      [p, outsider],
    );
  });
  const doc = {
    id: "30000000-0000-4000-8000-000000000001",
    variantId: "40000000-0000-4000-8000-000000000001",
    variantName: "Test",
    name: "Ist",
    sourceFilename: "Test.xlsx",
    categories: [
      { id: "value_adding", label: "Wertschoepfend", color: "#7fb3ae" },
    ],
    input: {
      taktMin: 4,
      allowancePct: 0,
      stations: [
        { id: "s1", label: "T1" },
        { id: "s2", label: "T2" },
      ],
      employees: [{ id: "e1", stationId: "s1", label: "Mitarbeiter 1" }],
      steps: [
        {
          id: "A",
          description: "Test A",
          timeMin: 2,
          sequence: 1,
          stationId: "s1",
          employeeId: "e1",
          categoryId: "value_adding",
          predecessorIds: [],
        },
        {
          id: "B",
          description: "Test B",
          timeMin: 1,
          sequence: 2,
          stationId: "s1",
          employeeId: "e1",
          categoryId: "value_adding",
          predecessorIds: ["A"],
        },
      ],
    },
  };
  await test("Import wird serverseitig gespeichert", async () => {
    const result = (
      await q("select public.import_scenario($1,$2) doc", [p, doc])
    ).rows[0].doc;
    assert.equal(result.version, 1);
    assert.equal(result.input.steps.length, 2);
  });
  const lock = async (scenarioId, token, takeover = false) =>
    (
      await q("select public.acquire_scenario_lock($1,$2,$3,$4) lock", [
        p,
        scenarioId,
        token,
        takeover,
      ])
    ).rows[0].lock;
  await test("Editor erhaelt beim Oeffnen die Sperre (E27)", async () =>
    assert.deepEqual(await lock(doc.id, editorTab), { held: true }));
  await test("Editor kann zuweisen und versioniert speichern", async () => {
    doc.input.steps[0].employeeId = null;
    const result = (
      await q(
        "select public.save_scenario($1,$2,1,'50000000-0000-4000-8000-000000000001') doc",
        [p, doc],
      )
    ).rows[0].doc;
    assert.equal(result.version, 2);
  });
  await test("Veraltete Version wird abgelehnt", () =>
    denied(
      "select public.save_scenario($1,$2,1,'50000000-0000-4000-8000-000000000001')",
      [p, doc],
      "40001",
    ));
  await test("Importzeit durch RPC unveraenderlich", async () => {
    const changed = structuredClone(doc);
    changed.input.steps[0].timeMin = 99;
    await denied(
      "select public.save_scenario($1,$2,2,'50000000-0000-4000-8000-000000000001')",
      [p, changed],
      "23514",
    );
  });
  await test("Direkte Aenderung und Loeschung von Schritten verboten", async () => {
    await denied("update public.steps set time_min=99 where scenario_id=$1", [
      doc.id,
    ]);
    await denied("delete from public.steps where scenario_id=$1", [doc.id]);
  });
  await test("Kreise beim Speichern abgelehnt", async () => {
    const changed = structuredClone(doc);
    changed.input.steps[0].predecessorIds = ["B"];
    await denied(
      "select public.save_scenario($1,$2,2,'50000000-0000-4000-8000-000000000001')",
      [p, changed],
      "23514",
    );
  });
  await test("Unbekannte Vorgaenger abgelehnt", async () => {
    const changed = structuredClone(doc);
    changed.input.steps[0].predecessorIds = ["unbekannt"];
    await denied(
      "select public.save_scenario($1,$2,2,'50000000-0000-4000-8000-000000000001')",
      [p, changed],
      "23503",
    );
  });
  await test("Fremder Mitarbeiter an Station abgelehnt", async () => {
    const changed = structuredClone(doc);
    changed.input.steps[0].stationId = "s2";
    changed.input.steps[0].employeeId = "e1";
    await denied(
      "select public.save_scenario($1,$2,2,'50000000-0000-4000-8000-000000000001')",
      [p, changed],
      "23503",
    );
  });
  await test("Vernetzte Vorgaenger werden zuegig geprueft", async () => {
    // Je Schritt zwei Vorgaenger: Die fruehere Pfadsuche brauchte hierfuer exponentiell lange.
    const net = {
      ...structuredClone(doc),
      id: "30000000-0000-4000-8000-000000000002",
      variantId: "40000000-0000-4000-8000-000000000002",
      variantName: "Netz",
    };
    net.input.steps = Array.from({ length: 200 }, (_, i) => ({
      id: "N" + i,
      description: "Netz " + i,
      timeMin: 1,
      sequence: i,
      stationId: "s1",
      employeeId: null,
      categoryId: "value_adding",
      predecessorIds: i < 2 ? [] : ["N" + (i - 1), "N" + (i - 2)],
    }));
    await q("set local statement_timeout='10s'");
    const started = Date.now();
    const saved = (
      await q("select public.import_scenario($1,$2) doc", [p, net])
    ).rows[0].doc;
    await lock(net.id, editorTab);
    const cyclic = structuredClone(net);
    cyclic.input.steps[0].predecessorIds = ["N199"];
    await denied(
      "select public.save_scenario($1,$2,$3,'50000000-0000-4000-8000-000000000001')",
      [p, cyclic, saved.version],
      "23514",
    );
    await q("set local statement_timeout to default");
    assert.ok(Date.now() - started < 5000, "Kreispruefung zu langsam");
  });
  await test("Springer: Spuren derselben Person werden gespeichert und geprueft (E40)", async () => {
    const springer = structuredClone(doc);
    springer.input.employees = [
      { ...doc.input.employees[0], personId: "person:Mitarbeiter 1" },
      {
        id: "e1-s2",
        stationId: "s2",
        label: "Mitarbeiter 1",
        personId: "person:Mitarbeiter 1",
      },
    ];
    const saved = (
      await q(
        "select public.save_scenario($1,$2,2,'50000000-0000-4000-8000-000000000001') doc",
        [p, springer],
      )
    ).rows[0].doc;
    assert.deepEqual(
      saved.input.employees.map((e) => [e.id, e.stationId, e.personId]),
      [
        ["e1", "s1", "person:Mitarbeiter 1"],
        ["e1-s2", "s2", "person:Mitarbeiter 1"],
      ],
    );
    const relabeled = structuredClone(springer);
    relabeled.input.employees[1].label = "Mitarbeiter 2";
    await denied(
      "select public.save_scenario($1,$2,$3,'50000000-0000-4000-8000-000000000001')",
      [p, relabeled, saved.version],
      "23514",
    );
    const twice = structuredClone(springer);
    twice.input.employees[1].stationId = "s1";
    await denied(
      "select public.save_scenario($1,$2,$3,'50000000-0000-4000-8000-000000000001')",
      [p, twice, saved.version],
      "23505",
    );
  });
  await test("Reihenfolge mit Dezimalstellen gespeichert, negative und NaN abgelehnt", async () => {
    const version = (
      await q("select version from public.scenarios where id=$1", [doc.id])
    ).rows[0].version;
    const between = structuredClone(doc);
    between.input.steps[0].sequence = 2.5;
    const saved = (
      await q(
        "select public.save_scenario($1,$2,$3,'50000000-0000-4000-8000-000000000001') doc",
        [p, between, version],
      )
    ).rows[0].doc;
    assert.equal(saved.input.steps[0].sequence, 2.5);
    for (const sequence of [-1, "NaN"]) {
      const invalid = structuredClone(between);
      invalid.input.steps[0].sequence = sequence;
      await denied(
        "select public.save_scenario($1,$2,$3,'50000000-0000-4000-8000-000000000001')",
        [p, invalid, saved.version],
        "23514",
      );
    }
  });
  await test("Prozesszeit gespeichert, mit Mitarbeiter oder als haltende Handzeit abgelehnt (E44)", async () => {
    const version = (
      await q("select version from public.scenarios where id=$1", [doc.id])
    ).rows[0].version;
    const process = structuredClone(doc);
    Object.assign(process.input.steps[1], {
      employeeId: null,
      timeKind: "process",
      holdsStation: true,
    });
    const saved = (
      await q(
        "select public.save_scenario($1,$2,$3,'50000000-0000-4000-8000-000000000001') doc",
        [p, process, version],
      )
    ).rows[0].doc;
    const [manual, flashOff] = saved.input.steps;
    assert.equal(manual.timeKind, undefined);
    assert.deepEqual(
      [flashOff.timeKind, flashOff.holdsStation, flashOff.employeeId],
      ["process", true, null],
    );
    const withEmployee = structuredClone(process);
    withEmployee.input.steps[1].employeeId = "e1";
    const heldManual = structuredClone(process);
    delete heldManual.input.steps[1].timeKind;
    for (const invalid of [withEmployee, heldManual]) {
      await denied(
        "select public.save_scenario($1,$2,$3,'50000000-0000-4000-8000-000000000001')",
        [p, invalid, saved.version],
        "23514",
      );
    }
    // Zurueck zur Handzeit, damit die folgenden Tests den Ausgangsstand sehen.
    await q(
      "select public.save_scenario($1,$2,$3,'50000000-0000-4000-8000-000000000001')",
      [p, doc, saved.version],
    );
  });
  const copy = {
    ...structuredClone(doc),
    id: "30000000-0000-4000-8000-000000000011",
    name: "Kopie",
  };
  const single = {
    ...structuredClone(doc),
    id: "30000000-0000-4000-8000-000000000012",
    variantId: "40000000-0000-4000-8000-000000000012",
    variantName: "Einzeln",
  };
  const countIn = async (table, column, id) =>
    (
      await q(
        "select count(*)::int n from public." +
          table +
          " where " +
          column +
          "=$1",
        [id],
      )
    ).rows[0].n;
  await test("Editor loescht Szenario vollstaendig, Variante bleibt mit weiterem Szenario (E26)", async () => {
    await q("select public.import_scenario($1,$2)", [p, copy]);
    await q("select public.delete_scenario($1,$2)", [p, copy.id]);
    assert.equal(await countIn("scenarios", "id", copy.id), 0);
    for (const table of [
      "stations",
      "employees",
      "categories",
      "steps",
      "step_predecessors",
    ])
      assert.equal(await countIn(table, "scenario_id", copy.id), 0, table);
    assert.equal(await countIn("scenarios", "id", doc.id), 1);
    assert.equal(await countIn("variants", "id", doc.variantId), 1);
  });
  await test("Mit dem letzten Szenario verschwindet die Variante (E26)", async () => {
    await q("select public.import_scenario($1,$2)", [p, single]);
    await q("select public.delete_scenario($1,$2)", [p, single.id]);
    assert.equal(await countIn("variants", "id", single.variantId), 0);
  });
  await test("Geloeschtes Szenario wird weder erneut geloescht noch gespeichert", async () => {
    await denied("select public.delete_scenario($1,$2)", [p, copy.id], "40001");
    await denied(
      "select public.save_scenario($1,$2,1,'50000000-0000-4000-8000-000000000001')",
      [p, copy],
      "40001",
    );
  });
  await test("Speichern ohne eigene Sperre abgelehnt (F51)", async () => {
    const version = (
      await q("select version from public.scenarios where id=$1", [doc.id])
    ).rows[0].version;
    await denied(
      "select public.save_scenario($1,$2,$3,$4)",
      [p, doc, version, editorTab2],
      "55P03",
    );
  });
  await test("Zweiter Tab derselben Person bleibt schreibgeschuetzt", async () =>
    assert.deepEqual(await lock(doc.id, editorTab2), {
      held: false,
      holder: "phase2-editor@example.org",
      sameUser: true,
    }));
  await as(owner);
  await test("Zweiter Nutzer wird gewarnt und blockiert (F51, F58)", async () => {
    assert.deepEqual(await lock(doc.id, ownerTab), {
      held: false,
      holder: "phase2-editor@example.org",
      sameUser: false,
    });
    const version = (
      await q("select version from public.scenarios where id=$1", [doc.id])
    ).rows[0].version;
    await denied(
      "select public.save_scenario($1,$2,$3,$4)",
      [p, doc, version, ownerTab],
      "55P03",
    );
  });
  await test("Gesperrtes Szenario wird nicht geloescht (E26)", () =>
    denied("select public.delete_scenario($1,$2)", [p, doc.id], "55P03"));
  await test("Uebernahme nach Rueckfrage entzieht dem bisherigen Bearbeiter das Speichern", async () => {
    assert.deepEqual(await lock(doc.id, ownerTab, true), { held: true });
    await as(editor);
    assert.equal(
      (await lock(doc.id, editorTab)).holder,
      "phase2-owner@neonex.de",
    );
    const version = (
      await q("select version from public.scenarios where id=$1", [doc.id])
    ).rows[0].version;
    await denied(
      "select public.save_scenario($1,$2,$3,$4)",
      [p, doc, version, editorTab],
      "55P03",
    );
  });
  await test("Freigabe beim Verlassen gibt das Szenario frei (F64)", async () => {
    await as(owner);
    await q("select public.release_scenario_lock($1,$2,$3)", [
      p,
      doc.id,
      ownerTab,
    ]);
    await as(editor);
    assert.deepEqual(await lock(doc.id, editorTab), { held: true });
  });
  await test("Abgelaufene Sperre ist ohne Uebernahme frei (F64)", async () => {
    await q("reset role");
    await q(
      "update public.scenario_locks set expires_at=now()-interval '1 second' where scenario_id=$1",
      [doc.id],
    );
    await as(owner);
    assert.deepEqual(await lock(doc.id, ownerTab), { held: true });
    await as(editor);
    assert.deepEqual(await lock(doc.id, editorTab, true), { held: true });
  });
  await as(editor, otherSid);
  await test("Neue Anmeldung erfordert Code erneut", async () =>
    assert.equal(
      (await q("select public.can_access_project($1) ok", [p])).rows[0].ok,
      false,
    ));
  await test("Neue Sitzung sieht keine Szenarien", () =>
    denied("select public.list_scenario_documents($1)", [p]));
  await test("Neue Sitzung darf keine Szenarien loeschen", () =>
    denied("select public.delete_scenario($1,$2)", [p, doc.id]));
  await test("Neue Sitzung erhaelt keine Sperre", () =>
    denied("select public.acquire_scenario_lock($1,$2,$3)", [
      p,
      doc.id,
      editorTab2,
    ]));
  await as(staffEditor);
  await q("select public.redeem_project_code($1)", [code]);
  await as(staffEditor, otherSid);
  await test("Firmenadresse braucht in fremdem Projekt den Code je Sitzung", async () =>
    assert.equal(
      (await q("select public.can_access_project($1) ok", [p])).rows[0].ok,
      false,
    ));
  await as(outsider);
  await test("Fremdes Projekt bleibt isoliert", async () => {
    assert.equal(
      (
        await q(
          "select count(*)::int n from public.scenarios where project_id=$1",
          [p],
        )
      ).rows[0].n,
      0,
    );
    await denied("select public.import_scenario($1,$2)", [
      p,
      { ...doc, id: "30000000-0000-4000-8000-000000000099" },
    ]);
    await denied("select public.delete_scenario($1,$2)", [p, doc.id]);
  });
  await test("Fuenf Fehlversuche fuehren zu Sperre", async () => {
    for (let i = 0; i < 5; i++)
      await q("select public.redeem_project_code('00000-00000')");
    const result = (
      await q("select public.redeem_project_code($1) result", [code])
    ).rows[0].result;
    assert.equal(result.ok, false);
    assert.match(result.message, /15 Minuten/);
  });

  await as(owner);
  await test("RLS-/Grant-Matrix fuer alle Projekttabellen", async () => {
    const readable = [
      "projects",
      "project_members",
      "variants",
      "scenarios",
      "stations",
      "employees",
      "categories",
      "steps",
      "step_predecessors",
      "staffing_plans",
    ];
    const privateTables = [
      "staff_domains",
      "member_sessions",
      "project_codes",
      "code_attempts",
      "scenario_locks",
    ];
    for (const role of ["owner", "editor", "outsider", "anonymous"]) {
      if (role === "owner") await as(owner);
      if (role === "editor") {
        await as(editor);
        await q("select public.redeem_project_code($1)", [code]);
      }
      if (role === "outsider") await as(outsider);
      if (role === "anonymous") {
        await q("reset role");
        await q("set local role anon");
      }
      for (const table of [...readable, ...privateTables]) {
        const col =
          table === "projects"
            ? "id"
            : table === "staff_domains"
              ? "domain"
              : table === "code_attempts"
                ? "user_id"
                : "project_id";
        await denied("insert into public." + table + " default values");
        await denied(
          "update public." + table + " set " + col + "=" + col + " where false",
        );
        await denied("delete from public." + table + " where false");
        if (role === "anonymous" || privateTables.includes(table))
          await denied("select * from public." + table);
        else if (role === "outsider")
          assert.equal(
            (await q("select count(*)::int n from public." + table)).rows[0].n,
            0,
          );
        else await q("select * from public." + table);
      }
    }
  });
  await as(editor);
  await test("E-Mail-Wechsel erfordert Code erneut", async () => {
    await q("reset role");
    await q(
      "update auth.users set email='phase2-editor-new@example.org' where id=$1",
      [editor],
    );
    await as(editor);
    assert.equal(
      (await q("select public.can_access_project($1) ok", [p])).rows[0].ok,
      false,
    );
    await q("select public.redeem_project_code($1)", [code]);
    assert.equal(
      (await q("select public.can_access_project($1) ok", [p])).rows[0].ok,
      true,
    );
  });
  await as(outsider);
  await test("Unbestaetigte Identitaet und gefaelschte Staff-E-Mail reichen nicht", async () => {
    await q("reset role");
    await q("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({
        sub: outsider,
        role: "authenticated",
        session_id: sid,
        email: "fake@neonex.de",
      }),
    ]);
    await q("set local role authenticated");
    assert.equal((await q("select public.is_staff() ok")).rows[0].ok, false);
    await q("reset role");
    await q("update auth.users set email_confirmed_at=null where id=$1", [
      outsider,
    ]);
    await as(outsider);
    await denied("select public.redeem_project_code($1)", [code]);
  });

  await as(owner);
  await test("Trigger schuetzt Importzeit auch bei privilegiertem SQL", async () => {
    await q("reset role");
    await denied(
      "update public.steps set time_min=99 where scenario_id=$1",
      [doc.id],
      "23514",
    );
    await as(owner);
  });
  await test("Owner muss Projektname zum Loeschen bestaetigen", () =>
    denied("select public.delete_project($1,'falsch')", [p], "P0001"));
  await q("select public.rotate_project_code($1)", [p]);
  await as(editor);
  await test("Code-Rotation entzieht Editor den Zugriff", async () =>
    assert.equal(
      (await q("select public.can_access_project($1) ok", [p])).rows[0].ok,
      false,
    ));
  await as(owner);
  await q("select public.delete_project($1,'Phase 2 Test')", [p]);
  await test("Projektloeschung entfernt Szenarien vollstaendig", async () =>
    assert.equal(
      (
        await q(
          "select count(*)::int n from public.scenarios where project_id=$1",
          [p],
        )
      ).rows[0].n,
      0,
    ));
  await as(owner);
  const staffingProject = (
    await q("select public.create_project('Personalplanung Test') id")
  ).rows[0].id;
  const staffingCode = (
    await q("select public.get_project_code($1) code", [staffingProject])
  ).rows[0].code;
  const staffing = {
    filename: "Test.xlsx",
    taktMin: 70,
    grossFactor: 1.2,
    rows: [
      {
        sourceRow: 3,
        area: "Linie",
        teamSpeaker: "DE",
        costCenter: "353",
        station: "T17",
        support: false,
        productive: 0.5,
        gross: 0.6,
      },
    ],
    actuals: [{ costCenter: "353", actual: 12, sourceGross: 0.6 }],
    warnings: [],
  };
  const sourceHash = "a".repeat(64);
  let staffingId;
  await test("Personalplanung importieren und gleiche Datei idempotent behandeln", async () => {
    staffingId = (
      await q("select public.import_staffing_plan($1,$2,$3) id", [
        staffingProject,
        staffing,
        sourceHash,
      ])
    ).rows[0].id;
    assert.equal(
      (
        await q("select public.import_staffing_plan($1,$2,$3) id", [
          staffingProject,
          staffing,
          sourceHash,
        ])
      ).rows[0].id,
      staffingId,
    );
  });
  await test("Ungueltige Personalplanung serverseitig abweisen", async () => {
    await denied(
      "select public.import_staffing_plan($1,$2,$3)",
      [staffingProject, { ...staffing, taktMin: 90 }, "b".repeat(64)],
      "23514",
    );
    await denied(
      "select public.import_staffing_plan($1,$2,$3)",
      [
        staffingProject,
        { ...staffing, rows: [{ ...staffing.rows[0], productive: -1 }] },
        "b".repeat(64),
      ],
      "23514",
    );
  });
  await as(editor);
  await q("select public.redeem_project_code($1)", [staffingCode]);
  await test("Editor sieht Planung nur in freigegebener Sitzung und kann sie nicht direkt aendern", async () => {
    assert.equal(
      (
        await q(
          "select count(*)::int n from public.staffing_plans where id=$1",
          [staffingId],
        )
      ).rows[0].n,
      1,
    );
    await denied("update public.staffing_plans set document=$1 where id=$2", [
      staffing,
      staffingId,
    ]);
    await denied("delete from public.staffing_plans where id=$1", [staffingId]);
  });
  await as(editor, otherSid);
  await test("Neue Sitzung und fremde Nutzer sehen keine Personalplanung", async () => {
    assert.equal(
      (
        await q(
          "select count(*)::int n from public.staffing_plans where id=$1",
          [staffingId],
        )
      ).rows[0].n,
      0,
    );
    await denied("select public.import_staffing_plan($1,$2,$3)", [
      staffingProject,
      staffing,
      sourceHash,
    ]);
    await as(outsider);
    assert.equal(
      (
        await q(
          "select count(*)::int n from public.staffing_plans where id=$1",
          [staffingId],
        )
      ).rows[0].n,
      0,
    );
  });
  await as(owner);
  await q("select public.delete_project($1,'Personalplanung Test')", [
    staffingProject,
  ]);
  await q("reset role");
  await q("set local role anon");
  await test("Anonyme haben keinen Tabellen-/Funktionszugriff", async () => {
    await denied("select * from public.projects");
    await denied("select public.create_project('Anonym')");
    await denied("select public.delete_scenario($1,$2)", [
      "00000000-0000-4000-8000-000000000000",
      "00000000-0000-4000-8000-000000000000",
    ]);
    await denied("select public.acquire_scenario_lock($1,$2,$3)", [
      "00000000-0000-4000-8000-000000000000",
      "00000000-0000-4000-8000-000000000000",
      "00000000-0000-4000-8000-000000000000",
    ]);
  });
  await q("rollback");
  console.log(
    count +
      " Datenbanktests bestanden; alle Testdaten und ggf. Testschema zurueckgerollt.",
  );
} catch (error) {
  try {
    await q("rollback");
  } catch {}
  console.error(
    "DB-Test fehlgeschlagen: " +
      (error.code ?? error.name) +
      " " +
      (error.message ?? "").replace(
        /postgres(?:ql)?:\/\/\S+/g,
        "[DB-URL ausgeblendet]",
      ),
  );
  process.exitCode = 1;
} finally {
  await client.end();
}

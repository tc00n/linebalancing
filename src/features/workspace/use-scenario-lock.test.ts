// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LockState, ScenarioLockApi } from "@/data/scenarioRepository";
import {
  subscribeScenarioLock,
  takeoverScenarioLock,
  withScenarioLock,
  type ScenarioLock,
} from "./use-scenario-lock";

/** Server-Attrappe: eine Sperre, deren Antwort der Test vorgibt. */
function fakeApi(answer: () => LockState) {
  return {
    acquire: vi.fn(async (_id: string, takeover?: boolean) =>
      takeover ? { held: true } : answer(),
    ),
    release: vi.fn(async () => {}),
    releaseOnExit: vi.fn(),
  } satisfies ScenarioLockApi;
}

let id = 0;
const nextId = () => `szenario-${++id}`;

describe("Szenariosperre im Browser (E27)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sperrt beim Öffnen und erneuert alle 30 s", async () => {
    const api = fakeApi(() => ({ held: true }));
    const states: ScenarioLock[] = [];
    const scenario = nextId();
    const stop = subscribeScenarioLock(api, scenario, (s) => states.push(s));
    await vi.advanceTimersByTimeAsync(0);
    expect(states.at(-1)?.status).toBe("held");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.acquire).toHaveBeenCalledTimes(3);
    stop();
  });

  it("gibt erst frei, wenn keine Ansicht im Tab das Szenario mehr zeigt", async () => {
    const api = fakeApi(() => ({ held: true }));
    const scenario = nextId();
    const diagram = subscribeScenarioLock(api, scenario, () => {});
    await vi.advanceTimersByTimeAsync(0);
    // Wechsel Diagramm → Tabelle: erst abmelden, dann anmelden, ohne Freigabe dazwischen.
    diagram();
    const table = subscribeScenarioLock(api, scenario, () => {});
    await vi.advanceTimersByTimeAsync(1_000);
    expect(api.release).not.toHaveBeenCalled();
    expect(api.acquire).toHaveBeenCalledTimes(1);
    table();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(api.release).toHaveBeenCalledWith(scenario);
  });

  it("meldet Übernahme durch andere als „lost“ und Rückgewinn zum Neuladen", async () => {
    let answer: LockState = { held: true };
    const api = fakeApi(() => answer);
    const states: ScenarioLock[] = [];
    const scenario = nextId();
    const stop = subscribeScenarioLock(api, scenario, (s) => states.push(s));
    await vi.advanceTimersByTimeAsync(0);
    answer = { held: false, holder: "b@example.org", sameUser: false };
    await vi.advanceTimersByTimeAsync(30_000);
    expect(states.at(-1)).toMatchObject({
      status: "lost",
      holder: "b@example.org",
    });
    await takeoverScenarioLock(scenario);
    expect(states.at(-1)).toMatchObject({ status: "held", regained: 1 });
    stop();
  });

  it("bleibt schreibgeschützt, solange jemand anderes bearbeitet, und übernimmt, wenn frei", async () => {
    let answer: LockState = { held: false, holder: "b@example.org" };
    const api = fakeApi(() => answer);
    const states: ScenarioLock[] = [];
    const scenario = nextId();
    const stop = subscribeScenarioLock(api, scenario, (s) => states.push(s));
    await vi.advanceTimersByTimeAsync(0);
    expect(states.at(-1)?.status).toBe("blocked");
    answer = { held: true };
    await vi.advanceTimersByTimeAsync(30_000);
    expect(states.at(-1)).toMatchObject({ status: "held", regained: 1 });
    stop();
    await vi.advanceTimersByTimeAsync(1_000);
  });

  it("gibt beim Schließen des Tabs nur gehaltene Sperren frei (F64)", async () => {
    const held = fakeApi(() => ({ held: true }));
    const blocked = fakeApi(() => ({ held: false, holder: "b@example.org" }));
    const a = nextId();
    const b = nextId();
    const stopA = subscribeScenarioLock(held, a, () => {});
    const stopB = subscribeScenarioLock(blocked, b, () => {});
    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new Event("pagehide"));
    expect(held.releaseOnExit).toHaveBeenCalledWith(a);
    expect(blocked.releaseOnExit).not.toHaveBeenCalled();
    stopA();
    stopB();
    await vi.advanceTimersByTimeAsync(1_000);
  });

  it("lehnt Umbenennen ab, wenn jemand anderes bearbeitet", async () => {
    const api = fakeApi(() => ({ held: false, holder: "b@example.org" }));
    const work = vi.fn(async () => {});
    await expect(withScenarioLock(api, nextId(), work)).rejects.toThrow(
      "Das Szenario wird gerade von b@example.org bearbeitet.",
    );
    expect(work).not.toHaveBeenCalled();
  });
});

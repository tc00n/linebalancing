/// <reference lib="webworker" />
// Rechnet den Verteilungsvorschlag (E43) im Hintergrund, damit die Oberfläche bedienbar bleibt.
import {
  optimizeStation,
  type OptimizeGoal,
  type OptimizeResult,
} from "@/domain/optimize/optimize";
import type { ScenarioInput } from "@/domain/model/types";

export interface OptimizeRequest {
  readonly input: ScenarioInput;
  readonly stationId: string;
  readonly goal: OptimizeGoal;
}

export type OptimizeMessage =
  | { readonly type: "progress"; readonly done: number; readonly total: number }
  | { readonly type: "done"; readonly result: OptimizeResult }
  | { readonly type: "error"; readonly message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<OptimizeRequest>) => {
  const post = (message: OptimizeMessage) => scope.postMessage(message);
  try {
    const result = optimizeStation(event.data.input, {
      stationId: event.data.stationId,
      goal: event.data.goal,
      onProgress: (done, total) => post({ type: "progress", done, total }),
    });
    post({ type: "done", result });
  } catch (error) {
    post({
      type: "error",
      message:
        error instanceof Error ? error.message : "Berechnung fehlgeschlagen.",
    });
  }
};

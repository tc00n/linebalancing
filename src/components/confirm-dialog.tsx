"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { AlertTriangleIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";

/**
 * U5: Rückfragen und Meldungen im NEONEX-Design statt `window.confirm`/`window.alert`.
 * Browser-Dialoge passen nicht zur App, sagen mit „OK“ nicht, was passiert, und lassen sich
 * vom Browser dauerhaft unterdrücken – dann fragt die App vor dem Löschen nicht mehr nach.
 */
export interface ConfirmOptions {
  readonly title: string;
  /** Erklärender Text; Zeilen werden einzeln gesetzt. */
  readonly description?: string;
  /** Aufzählung, z. B. verletzte Vorgängerbeziehungen. */
  readonly items?: readonly string[];
  /** Beschriftung der Hauptaktion, z. B. „Trotzdem verschieben“. */
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  /** Rote Hauptaktion für Löschen und andere unumkehrbare Schritte. */
  readonly destructive?: boolean;
  /** Nur Hinweis mit einem Knopf (statt `window.alert`). */
  readonly notice?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((options) => {
    // Eine offene Rückfrage wird verneint, bevor eine neue erscheint.
    resolver.current?.(false);
    setCurrent(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function close(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setCurrent(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root
        open={current !== null}
        onOpenChange={(open) => {
          if (!open) close(false);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-nx-blue/20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl border bg-white p-5 text-sm shadow-nx transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            {current && (
              <>
                <AlertDialog.Title className="flex items-center gap-2 font-heading text-base font-semibold text-nx-blue">
                  {!current.notice && (
                    <AlertTriangleIcon
                      className={`size-5 shrink-0 ${
                        current.destructive
                          ? "text-destructive"
                          : "text-warning-strong"
                      }`}
                      aria-hidden
                    />
                  )}
                  {current.title}
                </AlertDialog.Title>
                {current.description && (
                  <AlertDialog.Description className="whitespace-pre-line text-muted-foreground">
                    {current.description}
                  </AlertDialog.Description>
                )}
                {current.items && current.items.length > 0 && (
                  <ul className="flex flex-col gap-1 rounded-md bg-secondary px-3 py-2 font-medium text-nx-blue tabular-nums">
                    {current.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-1 flex justify-end gap-2">
                  {!current.notice && (
                    <Button variant="outline" onClick={() => close(false)}>
                      {current.cancelLabel ?? "Abbrechen"}
                    </Button>
                  )}
                  <Button
                    className={
                      current.destructive
                        ? "bg-destructive text-white hover:bg-destructive/90"
                        : undefined
                    }
                    onClick={() => close(true)}
                    autoFocus
                  >
                    {current.confirmLabel}
                  </Button>
                </div>
              </>
            )}
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}

/** Rückfrage im App-Design; ohne Provider (z. B. in Tests) fällt sie auf `window.confirm` zurück. */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  return (
    confirm ??
    ((options) =>
      Promise.resolve(
        options.notice
          ? (window.alert(options.title), true)
          : window.confirm(options.title),
      ))
  );
}

/**
 * Meldung aus dem Rechenkern („…\n\nTrotzdem verschieben?“) in Text, Aufzählung und
 * Knopfbeschriftung zerlegen. Die Texte selbst bleiben im Rechenkern (E50, E51).
 */
export function confirmFromMessage(
  title: string,
  message: string,
): ConfirmOptions {
  const blocks = message.split("\n\n");
  const question = blocks.length > 1 ? blocks.pop()! : "";
  const [first, ...items] = blocks.join("\n\n").split("\n");
  return {
    title,
    description: first,
    items,
    confirmLabel: question.replace(/\?$/, "") || "Bestätigen",
  };
}

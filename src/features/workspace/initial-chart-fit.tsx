"use client";
import { useEffect, useRef, type RefObject } from "react";
/** Einmal beim ersten sichtbaren Layout einpassen; manuelle Anpassungen danach erhalten. */
export function InitialChartFit({
  areaRef,
  onFit,
}: {
  areaRef: RefObject<HTMLDivElement | null>;
  onFit: () => void;
}) {
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(() => {
      if (
        fitted.current ||
        area.clientWidth <= 0 ||
        area.getClientRects().length === 0
      )
        return;
      fitted.current = true;
      observer.disconnect();
      onFit();
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, [areaRef, onFit]);
  return null;
}

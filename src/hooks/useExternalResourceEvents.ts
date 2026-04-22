import { useEffect } from "react";

const ALLOWED_ORIGIN_SUFFIXES = [
  ".wordwall.net",
  ".learningapps.org",
  ".h5p.org",
  ".h5p.com",
];

function isOriginAllowed(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_ORIGIN_SUFFIXES.some(
      (suffix) => host === suffix.slice(1) || host.endsWith(suffix)
    );
  } catch {
    return false;
  }
}

function extractScore(data: any): number | null {
  if (!data || typeof data !== "object") return null;

  // H5P wrapper { action: 'xAPIStatement', statement: {...} }
  const statement =
    data.action === "xAPIStatement" && data.statement ? data.statement : data.statement;

  if (!statement || typeof statement !== "object") return null;

  const verbId: string | undefined = statement.verb?.id;
  if (!verbId || !verbId.toString().toLowerCase().includes("completed")) return null;

  const scaled = statement.result?.score?.scaled;
  if (typeof scaled === "number" && isFinite(scaled)) {
    const pct = Math.max(0, Math.min(1, scaled)) * 100;
    return Math.round(pct * 100) / 100;
  }

  // fallback raw / max
  const raw = statement.result?.score?.raw;
  const max = statement.result?.score?.max;
  if (typeof raw === "number" && typeof max === "number" && max > 0) {
    return Math.round((raw / max) * 10000) / 100;
  }

  return null;
}

export interface UseExternalResourceEventsOptions {
  onScore: (score: number, source: "auto_captured") => void;
  enabled?: boolean;
}

export function useExternalResourceEvents({
  onScore,
  enabled = true,
}: UseExternalResourceEventsOptions) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: MessageEvent) => {
      if (!isOriginAllowed(event.origin)) return;
      const score = extractScore(event.data);
      if (score !== null) {
        onScore(score, "auto_captured");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onScore, enabled]);
}

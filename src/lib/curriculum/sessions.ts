import manifest from "../../../content/curriculum/v2/manifest.json";
import type { SessionManifestEntry } from "./types";

export const CURRICULUM_SESSIONS: SessionManifestEntry[] = [...manifest.entries]
  .sort((a, b) => a.ordre - b.ordre)
  .map((entry) => ({
    session_code: entry.session_code,
    ordre: entry.ordre,
    titre: entry.titre,
    palier: entry.palier,
    kind: entry.kind,
  }));

export const CURRICULUM_PLAN_VERSION_LABEL = manifest.plan_version;

export function sessionByCode(code: string): SessionManifestEntry | undefined {
  return CURRICULUM_SESSIONS.find((s) => s.session_code === code);
}

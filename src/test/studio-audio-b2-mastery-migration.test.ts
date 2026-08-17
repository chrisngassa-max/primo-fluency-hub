import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  STUDIO_AUDIO_B2_MASTERY_POINT_ID,
  STUDIO_AUDIO_B2_MASTERY_POINT_NOM,
} from "../../supabase/functions/_shared/differentiation/publish-mastery-point.ts";

describe("studio audio B2 mastery point migration", () => {
  const sql = readFileSync(
    "supabase/migrations/20260817092335_studio_audio_b2_mastery_point.sql",
    "utf8",
  );

  it("inserts the stable CO/B2 point without touching existing rows", () => {
    expect(sql).toContain(STUDIO_AUDIO_B2_MASTERY_POINT_ID);
    expect(sql).toContain(STUDIO_AUDIO_B2_MASTERY_POINT_NOM);
    expect(sql).toMatch(/niveau_min,\s*\n\s*niveau_max/);
    expect(sql).toContain("'B2'");
    expect(sql).toContain("e.competence = 'CO'");
    expect(sql).toContain("NOT EXISTS");
    expect(sql).not.toMatch(/UPDATE\s+public\.points_a_maitriser/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.points_a_maitriser/i);
  });
});

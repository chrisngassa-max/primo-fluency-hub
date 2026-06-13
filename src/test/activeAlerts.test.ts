import { describe, expect, it } from "vitest";
import { countLearnersWithAlerts, dedupeAlertsByLearner } from "@/lib/activeAlerts";

const alerts = [
  { id: "new", eleve_id: "student-1", created_at: "2026-06-13T10:00:00Z" },
  { id: "old", eleve_id: "student-1", created_at: "2026-06-12T10:00:00Z" },
  { id: "other", eleve_id: "student-2", created_at: "2026-06-11T10:00:00Z" },
];

describe("active alert presentation", () => {
  it("shows only the latest alert for each learner", () => {
    expect(dedupeAlertsByLearner(alerts).map((alert) => alert.id)).toEqual(["new", "other"]);
  });

  it("counts affected learners instead of raw alerts", () => {
    expect(countLearnersWithAlerts(alerts)).toBe(2);
  });
});

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn(), functions: { invoke: vi.fn() } } }));
import { supabase } from "@/integrations/supabase/client";
import { StudioSourceReview } from "@/components/studio-audio/StudioSourceReview";
import { SOURCE_REVIEW_MESSAGES, sourceReviewBlock, sourceReviewError } from "@/lib/sourceUsabilityReview";
import { assertGenerationAllowed } from "@/lib/studioAudioWorkflow";
import type { PedagogicalSource } from "@/lib/pedagogicalSources";

const source = { id: "source", created_by: "owner", source_kind: "audio", review_status: "brouillon", status: "analyzed", rights_status: "internal_pilot", reusable_for_ai: true, content_hash: `sha256:${"a".repeat(64)}`, storage_bucket: "pedagogical-sources", storage_path: "test.mp3", updated_at: "2026-09-29T00:00:00Z" } as PedagogicalSource;
let root: Root;
let container: HTMLDivElement;
const onSaved = vi.fn(async () => {});
async function render(overrides: Partial<React.ComponentProps<typeof StudioSourceReview>> = {}) {
  await act(async () => root.render(<StudioSourceReview source={source} transcriptionStatus="reviewed" userId="owner" role="formateur" onSaved={onSaved} {...overrides} />));
}
async function click(text: string) {
  const button = [...document.querySelectorAll("button")].find(b => b.textContent === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ source_id: source.id, review_status: "utilisable", updated_at: source.updated_at, changed: true }], error: null } as any);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
describe("explicit source review", () => {
  it("separates rights and review, requires confirmation, calls only RPC then refreshes", async () => {
    await render();
    expect(container.textContent).toContain("Pilote interne");
    expect(container.textContent).toContain("Revue de la source : brouillon");
    await click("Marquer la source comme utilisable");
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("Cela ne publie aucun exercice");
    await click("Annuler"); expect(supabase.rpc).not.toHaveBeenCalled();
    await click("Marquer la source comme utilisable"); await click("Confirmer : source utilisable");
    expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith("mark_pedagogical_source_usable", { p_source_id: "source", p_confirmed: true, p_expected_updated_at: source.updated_at });
    expect(onSaved).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Source utilisable");
    expect(supabase.from).not.toHaveBeenCalled(); expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
  it.each([
    [{ transcriptionStatus: null }, "TRANSCRIPTION_NOT_FOUND"],
    [{ transcriptionStatus: "ready" }, "REVIEWED_TRANSCRIPTION_REQUIRED"],
    [{ source: { ...source, status: "imported" } }, "SOURCE_NOT_ANALYZED"],
    [{ source: { ...source, rights_status: "" } }, "SOURCE_RIGHTS_REQUIRED"],
    [{ userId: "other" }, "SOURCE_FORBIDDEN"],
    [{ role: "eleve" }, "STAFF_ROLE_REQUIRED"],
    [{ source: { ...source, content_hash: null } }, "SOURCE_HASH_REQUIRED"],
  ])("hides action for unmet prerequisite %j", async (props, code) => {
    await render(props as any); expect(container.textContent).toContain(SOURCE_REVIEW_MESSAGES[code as string]);
    expect(container.querySelector("button")).toBeNull(); expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it.each(Object.keys(SOURCE_REVIEW_MESSAGES))("displays server refusal %s", async code => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: code } } as any);
    await render(); await click("Marquer la source comme utilisable"); await click("Confirmer : source utilisable");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(SOURCE_REVIEW_MESSAGES[code]);
    expect(onSaved).not.toHaveBeenCalled();
  });
  it("reports network and concurrency errors", () => {
    expect(sourceReviewError(new Error("Failed to fetch"))).toContain("connexion");
    expect(sourceReviewError({ code: "40001" })).toBe(SOURCE_REVIEW_MESSAGES.SOURCE_REVIEW_CONFLICT);
    expect(sourceReviewBlock(source, "reviewed", "admin", "admin")).toBeNull();
    expect(sourceReviewBlock({ ...source, review_status: "a_remplacer" }, "reviewed", "owner", "formateur")).toBe("SOURCE_REVIEW_INVALID_STATE");
  });
  it("unlocks generation only after refreshed usable state, never with unreviewed transcription", () => {
    const input = { source, transcriptionStatus: "reviewed" as const, families: [], selectedLevels: ["A2" as const], confirmation: null };
    expect(assertGenerationAllowed(input).ok).toBe(false);
    expect(assertGenerationAllowed({ ...input, source: { ...source, review_status: "utilisable" } }).ok).toBe(true);
    expect(assertGenerationAllowed({ ...input, source: { ...source, review_status: "utilisable" }, transcriptionStatus: "ready" }).ok).toBe(false);
  });
});

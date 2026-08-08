import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

describe("saveTranscriptionReview", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("delegates transcription validation to the transactional RPC", async () => {
    rpcMock.mockResolvedValue({
      data: { published_family_count: 2 },
      error: null,
    });

    const { saveTranscriptionReview } = await import("@/lib/pedagogicalSourceTranscriptions");
    const result = await saveTranscriptionReview(
      "transcription-1",
      "Texte relu complet",
      [{ id: "segment-1", reviewed_text: "Segment relu" }],
      "trainer-1",
      "source-1",
    );

    expect(rpcMock).toHaveBeenCalledWith("validate_pedagogical_source_transcription_review", {
      p_transcription_id: "transcription-1",
      p_reviewed_text: "Texte relu complet",
      p_segments: [{ id: "segment-1", reviewed_text: "Segment relu" }],
    });
    expect(result).toEqual({ published_family_count: 2 });
  });
});

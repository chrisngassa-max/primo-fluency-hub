import { describe, expect, it } from "vitest";
import { normalizeInvitationCode } from "@/lib/invitationCode";

describe("group invitation helpers", () => {
  it("keeps only six digits", () => {
    expect(normalizeInvitationCode(" 12a-345678 ")).toBe("123456");
  });
});

import { describe, expect, it } from "vitest";
import {
  createSandboxDomain,
  InMemorySandboxRepository,
} from "../_shared/sandbox-domain";

describe("sandbox-invite", () => {
  it("12 - genere un lien magique pour l'eleve B1", async () => {
    const repository = new InMemorySandboxRepository();
    const domain = createSandboxDomain(repository);
    await domain.setup("formateur-a");

    const response = await domain.invite("formateur-a", "B1");

    expect(response.invite_url).toMatch(/^https:\/\/auth\.sandbox\.test\//);
    expect(response.niveau).toBe("B1");
    expect(response.expires_in_seconds).toBe(3600);
  });

  it("13 - refuse un niveau absent ou invalide", async () => {
    const repository = new InMemorySandboxRepository();
    const domain = createSandboxDomain(repository);
    await domain.setup("formateur-a");

    await expect(domain.invite("formateur-a", "C1" as never)).rejects.toMatchObject({ status: 400 });
  });
});

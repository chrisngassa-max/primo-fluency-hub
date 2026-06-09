import { describe, expect, it } from "vitest";
import {
  createSandboxPreviewDomain,
  InMemorySandboxPreviewRepository,
} from "../_shared/sandbox-preview-domain";

describe("sandbox multi-profils", () => {
  it("resout A1 cote serveur pour le formateur proprietaire", () => {
    const repository = new InMemorySandboxPreviewRepository();
    repository.seed();
    const result = createSandboxPreviewDomain(repository).resolve("formateur-a", "A1");
    expect(result.student.user_id).toBe("formateur-a-A1");
  });

  it("refuse un autre formateur", () => {
    const repository = new InMemorySandboxPreviewRepository();
    repository.seed("formateur-a");
    expect(() => createSandboxPreviewDomain(repository).resolve("formateur-b", "A1"))
      .toThrowError(expect.objectContaining({ status: 404 }));
  });

  it("refuse un utilisateur eleve", () => {
    const repository = new InMemorySandboxPreviewRepository();
    repository.seed();
    expect(() => createSandboxPreviewDomain(repository).resolve("eleve-a", "A1"))
      .toThrowError(expect.objectContaining({ status: 403 }));
  });

  it("ignore un eleve_id libre fourni par le client", () => {
    const repository = new InMemorySandboxPreviewRepository();
    repository.seed();
    const result = createSandboxPreviewDomain(repository).resolve("formateur-a", "B2", {
      eleve_id: "vrai-eleve",
    });
    expect(result.student.user_id).toBe("formateur-a-B2");
    expect(result.ignored_client_eleve_id).toBe("vrai-eleve");
  });

  it("refuse une sandbox expiree", () => {
    const repository = new InMemorySandboxPreviewRepository();
    const session = repository.seed();
    session.expires_at = new Date(Date.now() - 1_000).toISOString();
    expect(() => createSandboxPreviewDomain(repository).resolve("formateur-a", "A2"))
      .toThrowError(expect.objectContaining({ status: 409 }));
  });

  it("refuse un profil dont le sandbox_session_id ne correspond pas", () => {
    const repository = new InMemorySandboxPreviewRepository();
    const session = repository.seed();
    session.eleves[0].sandbox_session_id = "autre-sandbox";
    expect(() => createSandboxPreviewDomain(repository).resolve("formateur-a", "A1"))
      .toThrowError(expect.objectContaining({ status: 400 }));
  });

  it("bascule de A1 a B2 sans changer de session formateur", () => {
    const repository = new InMemorySandboxPreviewRepository();
    repository.seed();
    const domain = createSandboxPreviewDomain(repository);
    expect(domain.resolve("formateur-a", "A1").session.id).toBe(
      domain.resolve("formateur-a", "B2").session.id,
    );
  });

  it("retourne quatre profils par un seul appel mosaique", () => {
    const repository = new InMemorySandboxPreviewRepository();
    repository.seed();
    expect(createSandboxPreviewDomain(repository).mosaic("formateur-a").map((item) => item.niveau))
      .toEqual(["A1", "A2", "B1", "B2"]);
  });
});

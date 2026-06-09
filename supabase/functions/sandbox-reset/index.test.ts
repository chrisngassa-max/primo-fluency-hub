import { describe, expect, it } from "vitest";
import {
  createSandboxDomain,
  InMemorySandboxRepository,
} from "../_shared/sandbox-domain";

describe("sandbox-reset", () => {
  it("8 - attempts_only efface resultats et devoirs de la session seulement", async () => {
    const repository = new InMemorySandboxRepository();
    const domain = createSandboxDomain(repository);
    const sandbox = await domain.setup("formateur-a");
    repository.seedCounts(sandbox.sandbox_session_id, { resultats: 10, devoirs: 3, sessions: 2 });

    const response = await domain.reset("formateur-a", "attempts_only");

    expect(response.tables_nettoyees).toEqual({ resultats: 10, devoirs: 3 });
    expect(repository.count("sessions", sandbox.sandbox_session_id)).toBe(2);
    expect(repository.groups.has(sandbox.groupe_id)).toBe(true);
  });

  it("9 - ne touche jamais aux donnees reelles", async () => {
    const repository = new InMemorySandboxRepository();
    const domain = createSandboxDomain(repository);
    const sandbox = await domain.setup("formateur-a");
    repository.seedCounts(null, { resultats: 5 });
    repository.seedCounts(sandbox.sandbox_session_id, { resultats: 10 });

    await domain.reset("formateur-a", "attempts_only");

    expect(repository.count("resultats", null)).toBe(5);
    expect(repository.count("resultats", sandbox.sandbox_session_id)).toBe(0);
  });

  it("10 - everything nettoie la session, supprime les comptes auth et marque reset", async () => {
    const repository = new InMemorySandboxRepository();
    const domain = createSandboxDomain(repository);
    const sandbox = await domain.setup("formateur-a");

    await domain.reset("formateur-a", "everything");

    expect(repository.deletedAuthUsers).toBe(4);
    expect(repository.sessions.get(sandbox.sandbox_session_id)?.statut).toBe("reset");
    expect(repository.groups.has(sandbox.groupe_id)).toBe(false);
  });

  it("11 - refuse de reinitialiser le sandbox d'un autre formateur", async () => {
    const repository = new InMemorySandboxRepository();
    const domain = createSandboxDomain(repository);
    const sandboxA = await domain.setup("formateur-a");

    await expect(
      domain.reset("formateur-b", "everything", sandboxA.sandbox_session_id),
    ).rejects.toMatchObject({ status: 403 });
  });
});

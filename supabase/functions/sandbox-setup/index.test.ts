import { describe, expect, it } from "vitest";
import {
  createSandboxDomain,
  InMemorySandboxRepository,
} from "../_shared/sandbox-domain";

const FORMATEUR_A = "formateur-a";
const FORMATEUR_B = "formateur-b";

describe("sandbox-setup", () => {
  it("1 - cree une session, un groupe et quatre eleves sans persister les mots de passe", async () => {
    const repository = new InMemorySandboxRepository();
    const domain = createSandboxDomain(repository);

    const response = await domain.setup(FORMATEUR_A);

    expect(response.eleves.map((eleve) => eleve.niveau)).toEqual(["A1", "A2", "B1", "B2"]);
    expect(response.eleves.every((eleve) => eleve.mot_de_passe_initial)).toBe(true);
    expect(repository.sessions.get(response.sandbox_session_id)?.eleve_emails).toHaveLength(4);
    expect(JSON.stringify(repository.sessions.get(response.sandbox_session_id))).not.toContain("mot_de_passe");
    expect(repository.groups.get(response.groupe_id)?.sandbox_session_id).toBe(response.sandbox_session_id);
  });

  it("2 - est idempotent et prolonge une session active sans retourner les mots de passe", async () => {
    const repository = new InMemorySandboxRepository();
    const domain = createSandboxDomain(repository);
    const first = await domain.setup(FORMATEUR_A);
    const second = await domain.setup(FORMATEUR_A);

    expect(second.sandbox_session_id).toBe(first.sandbox_session_id);
    expect(second.eleves.every((eleve) => eleve.mot_de_passe_initial === undefined)).toBe(true);
    expect(repository.createdAuthUsers).toBe(4);
  });

  it("3 - reactive une session expiree sans recreer ses comptes", async () => {
    const repository = new InMemorySandboxRepository();
    const domain = createSandboxDomain(repository);
    const first = await domain.setup(FORMATEUR_A);
    repository.sessions.get(first.sandbox_session_id)!.statut = "expired";

    const response = await domain.setup(FORMATEUR_A);

    expect(response.message).toContain("reactive");
    expect(repository.sessions.get(first.sandbox_session_id)?.statut).toBe("active");
    expect(repository.createdAuthUsers).toBe(4);
  });

  it("4 - force_recreate supprime uniquement l'ancien environnement et cree un nouvel id", async () => {
    const repository = new InMemorySandboxRepository();
    const domain = createSandboxDomain(repository);
    const first = await domain.setup(FORMATEUR_A);
    const second = await domain.setup(FORMATEUR_A, { force_recreate: true });

    expect(second.sandbox_session_id).not.toBe(first.sandbox_session_id);
    expect(repository.deletedAuthUsers).toBe(4);
    expect(repository.sessions.has(first.sandbox_session_id)).toBe(false);
  });

  it("5 - refuse un utilisateur qui n'est pas formateur", async () => {
    const repository = new InMemorySandboxRepository();
    repository.roles.set("eleve-a", "eleve");

    await expect(createSandboxDomain(repository).setup("eleve-a")).rejects.toMatchObject({ status: 403 });
  });

  it("6 - isole les sessions de deux formateurs", async () => {
    const repository = new InMemorySandboxRepository();
    const domain = createSandboxDomain(repository);
    const sessionA = await domain.setup(FORMATEUR_A);

    expect(await domain.status(FORMATEUR_B)).toBeNull();
    expect(repository.findSessionByOwner(FORMATEUR_B)?.id).not.toBe(sessionA.sandbox_session_id);
  });

  it("7 - propage sandbox_session_id au groupe et aux profils eleves", async () => {
    const repository = new InMemorySandboxRepository();
    const response = await createSandboxDomain(repository).setup(FORMATEUR_A);

    expect([...repository.groups.values()].every((row) => row.sandbox_session_id === response.sandbox_session_id)).toBe(true);
    expect([...repository.students.values()].every((row) => row.sandbox_session_id === response.sandbox_session_id)).toBe(true);
  });
});

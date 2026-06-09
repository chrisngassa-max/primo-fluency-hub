import type { NiveauSandbox, SandboxStatut } from "./sandbox.types";
import { SandboxDomainError } from "./sandbox-domain";

export interface PreviewStudent {
  niveau: NiveauSandbox;
  user_id: string;
  email: string;
  sandbox_session_id: string;
}

export interface PreviewSession {
  id: string;
  formateur_id: string;
  statut: SandboxStatut;
  expires_at: string;
  eleves: PreviewStudent[];
}

export class InMemorySandboxPreviewRepository {
  roles = new Map<string, "formateur" | "eleve">([
    ["formateur-a", "formateur"],
    ["formateur-b", "formateur"],
    ["eleve-a", "eleve"],
  ]);
  sessions = new Map<string, PreviewSession>();

  seed(ownerId = "formateur-a") {
    const session: PreviewSession = {
      id: `sandbox-${ownerId}`,
      formateur_id: ownerId,
      statut: "active",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      eleves: (["A1", "A2", "B1", "B2"] as NiveauSandbox[]).map((niveau) => ({
        niveau,
        user_id: `${ownerId}-${niveau}`,
        email: `${niveau.toLowerCase()}@sandbox.test`,
        sandbox_session_id: `sandbox-${ownerId}`,
      })),
    };
    this.sessions.set(ownerId, session);
    return session;
  }
}

const LEVELS: NiveauSandbox[] = ["A1", "A2", "B1", "B2"];

export function createSandboxPreviewDomain(repository: InMemorySandboxPreviewRepository) {
  return {
    resolve(ownerId: string, niveau: NiveauSandbox, clientPayload: Record<string, unknown> = {}) {
      if (repository.roles.get(ownerId) !== "formateur") {
        throw new SandboxDomainError("Acces reserve aux formateurs", 403);
      }
      if (!LEVELS.includes(niveau)) throw new SandboxDomainError("Niveau invalide", 400);

      const session = repository.sessions.get(ownerId);
      if (!session) throw new SandboxDomainError("Sandbox introuvable", 404);
      if (
        session.statut !== "active" ||
        new Date(session.expires_at).getTime() <= Date.now()
      ) {
        throw new SandboxDomainError("Sandbox expiree", 409);
      }

      const student = session.eleves.find((item) => item.niveau === niveau);
      if (!student || student.sandbox_session_id !== session.id) {
        throw new SandboxDomainError("Profil sandbox introuvable", 400);
      }

      return {
        session,
        student,
        ignored_client_eleve_id: clientPayload.eleve_id ?? null,
      };
    },

    mosaic(ownerId: string) {
      const session = repository.sessions.get(ownerId);
      if (!session) throw new SandboxDomainError("Sandbox introuvable", 404);
      return LEVELS.map((niveau) => this.resolve(ownerId, niveau).student);
    },
  };
}

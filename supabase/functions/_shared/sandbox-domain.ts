import type {
  EleveSandbox,
  NiveauSandbox,
  SandboxInviteResponse,
  SandboxResetScope,
  SandboxSetupRequest,
  SandboxSetupResponse,
  SandboxStatut,
} from "./sandbox.types";

type Role = "formateur" | "eleve";
type CountTable = "resultats" | "devoirs" | "sessions";

interface SessionRow {
  id: string;
  formateur_id: string;
  statut: SandboxStatut;
  group_id: string | null;
  eleve_user_ids: string[];
  eleve_emails: Array<Omit<EleveSandbox, "mot_de_passe_initial">>;
  expires_at: string;
}

export class SandboxDomainError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export class InMemorySandboxRepository {
  roles = new Map<string, Role>();
  sessions = new Map<string, SessionRow>();
  groups = new Map<string, { id: string; sandbox_session_id: string }>();
  students = new Map<string, { id: string; sandbox_session_id: string }>();
  memberships = new Map<string, { id: string; sandbox_session_id: string }>();
  createdAuthUsers = 0;
  deletedAuthUsers = 0;
  private sequence = 0;
  private counts = new Map<string, Record<CountTable, number>>();

  constructor() {
    this.roles.set("formateur-a", "formateur");
    this.roles.set("formateur-b", "formateur");
  }

  nextId(prefix: string) {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  findSessionByOwner(ownerId: string) {
    return [...this.sessions.values()].find((session) => session.formateur_id === ownerId);
  }

  seedCounts(sessionId: string | null, values: Partial<Record<CountTable, number>>) {
    const key = sessionId ?? "production";
    const current = this.counts.get(key) ?? { resultats: 0, devoirs: 0, sessions: 0 };
    this.counts.set(key, { ...current, ...values });
  }

  count(table: CountTable, sessionId: string | null) {
    return this.counts.get(sessionId ?? "production")?.[table] ?? 0;
  }

  clear(table: CountTable, sessionId: string) {
    const count = this.count(table, sessionId);
    this.seedCounts(sessionId, { [table]: 0 });
    return count;
  }
}

const LEVELS: NiveauSandbox[] = ["A1", "A2", "B1", "B2"];

export function createSandboxDomain(repository: InMemorySandboxRepository) {
  const assertFormateur = (ownerId: string) => {
    const role = repository.roles.get(ownerId) ?? (ownerId.startsWith("formateur") ? "formateur" : undefined);
    if (role !== "formateur") throw new SandboxDomainError("Acces reserve aux formateurs", 403);
  };

  const createEnvironment = async (
    ownerId: string,
    message: SandboxSetupResponse["message"],
  ): Promise<SandboxSetupResponse> => {
    const sessionId = repository.nextId("sandbox");
    const groupId = repository.nextId("group");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const eleves = LEVELS.map((niveau) => {
      const userId = repository.nextId(`user-${niveau.toLowerCase()}`);
      const email = `sandbox-${niveau.toLowerCase()}-${sessionId}@sandbox.captcf.local`;
      repository.createdAuthUsers += 1;
      repository.students.set(userId, { id: userId, sandbox_session_id: sessionId });
      repository.memberships.set(userId, { id: userId, sandbox_session_id: sessionId });
      return {
        niveau,
        email,
        user_id: userId,
        display_name: `Eleve Test ${niveau}`,
        mot_de_passe_initial: `Soleil-Bleu-Maison-${repository.createdAuthUsers}`,
      };
    });

    repository.groups.set(groupId, { id: groupId, sandbox_session_id: sessionId });
    repository.sessions.set(sessionId, {
      id: sessionId,
      formateur_id: ownerId,
      statut: "active",
      group_id: groupId,
      eleve_user_ids: eleves.map((eleve) => eleve.user_id),
      eleve_emails: eleves.map(({ mot_de_passe_initial: _password, ...eleve }) => eleve),
      expires_at: expiresAt,
    });

    return {
      sandbox_session_id: sessionId,
      group_id: groupId,
      groupe_id: groupId,
      eleves,
      expires_at: expiresAt,
      message,
    };
  };

  const removeEnvironment = (session: SessionRow, deleteSession = true) => {
    repository.deletedAuthUsers += session.eleve_user_ids.length;
    repository.groups.delete(session.group_id ?? "");
    for (const userId of session.eleve_user_ids) {
      repository.students.delete(userId);
      repository.memberships.delete(userId);
    }
    if (deleteSession) repository.sessions.delete(session.id);
  };

  return {
    async setup(ownerId: string, request: SandboxSetupRequest = {}) {
      assertFormateur(ownerId);
      const existing = repository.findSessionByOwner(ownerId);

      if (existing && !request.force_recreate && existing.statut === "active") {
        existing.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        return {
          sandbox_session_id: existing.id,
          group_id: existing.group_id!,
          groupe_id: existing.group_id!,
          eleves: existing.eleve_emails,
          expires_at: existing.expires_at,
          message: "existing" as const,
        };
      }

      if (existing && !request.force_recreate && existing.statut === "expired") {
        existing.statut = "active";
        existing.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        return {
          sandbox_session_id: existing.id,
          group_id: existing.group_id!,
          groupe_id: existing.group_id!,
          eleves: existing.eleve_emails,
          expires_at: existing.expires_at,
          message: "reactive" as SandboxSetupResponse["message"],
        };
      }

      const resumed = existing?.statut === "provisioning" && !request.force_recreate;
      if (existing) removeEnvironment(existing);
      return createEnvironment(ownerId, resumed ? "resumed" : "created");
    },

    async status(ownerId: string) {
      assertFormateur(ownerId);
      return repository.findSessionByOwner(ownerId) ?? null;
    },

    async reset(ownerId: string, scope: SandboxResetScope, requestedSessionId?: string) {
      assertFormateur(ownerId);
      const owned = repository.findSessionByOwner(ownerId);
      if (requestedSessionId && owned?.id !== requestedSessionId) {
        throw new SandboxDomainError("Sandbox non autorise", 403);
      }
      if (!owned) throw new SandboxDomainError("Sandbox introuvable", 404);

      const tables: Record<string, number> = {
        resultats: repository.clear("resultats", owned.id),
        devoirs: repository.clear("devoirs", owned.id),
      };
      if (scope === "sessions" || scope === "everything") {
        tables.sessions = repository.clear("sessions", owned.id);
      }
      if (scope === "everything") {
        tables.group_members = owned.eleve_user_ids.length;
        tables.profils_eleves = owned.eleve_user_ids.length;
        tables.groups = owned.group_id ? 1 : 0;
        removeEnvironment(owned, false);
        owned.statut = "reset";
        owned.group_id = null;
      }
      return { tables_nettoyees: tables, sandbox_session_id: owned.id };
    },

    async invite(ownerId: string, niveau: NiveauSandbox): Promise<SandboxInviteResponse> {
      assertFormateur(ownerId);
      if (!LEVELS.includes(niveau)) throw new SandboxDomainError("Niveau invalide", 400);
      const session = repository.findSessionByOwner(ownerId);
      const eleve = session?.eleve_emails.find((item) => item.niveau === niveau);
      if (!session || session.statut !== "active" || !eleve) {
        throw new SandboxDomainError("Eleve sandbox introuvable", 400);
      }
      return {
        invite_url: `https://auth.sandbox.test/${encodeURIComponent(eleve.email)}`,
        niveau,
        expires_in_seconds: 3600,
      };
    },
  };
}

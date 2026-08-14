export type EnrolledSession = {
  sessionId: string;
  groupId: string;
  groupNiveau: string | null;
};

type AdminLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
        in?: (column: string, values: unknown[]) => Promise<{ data: unknown; error: unknown }> | {
          maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
  };
};

export async function findEnrolledSessionForCode(
  admin: AdminLike,
  sessionCode: string,
  learnerId: string,
): Promise<EnrolledSession | null> {
  const { data: training, error: trainingError } = await admin
    .from("training_sessions")
    .select("id")
    .eq("code", sessionCode)
    .maybeSingle();
  if (trainingError) throw trainingError;
  const trainingId = (training as { id?: string } | null)?.id;
  if (!trainingId) return null;

  const sessionQuery = admin.from("sessions").select("id, group_id, group:groups(niveau)").eq("training_session_id", trainingId);
  const { data: sessionRows, error: sessionError } = await (sessionQuery as unknown as Promise<{ data: unknown; error: unknown }>);
  if (sessionError) throw sessionError;
  const rows = (Array.isArray(sessionRows) ? sessionRows : []) as Array<{
    id: string;
    group_id: string | null;
    group?: { niveau?: string } | Array<{ niveau?: string }>;
  }>;
  const groupIds = [...new Set(rows.map((row) => row.group_id).filter((id): id is string => Boolean(id)))];
  if (groupIds.length === 0) return null;

  const memberQuery = admin.from("group_members").select("group_id").eq("eleve_id", learnerId);
  const { data: memberships, error: memberError } = await (
    typeof memberQuery.in === "function"
      ? memberQuery.in("group_id", groupIds) as Promise<{ data: unknown; error: unknown }>
      : memberQuery as unknown as Promise<{ data: unknown; error: unknown }>
  );
  if (memberError) throw memberError;
  const enrolled = new Set(
    (Array.isArray(memberships) ? memberships : [])
      .map((row: { group_id?: string }) => row.group_id)
      .filter((id): id is string => Boolean(id)),
  );
  const match = rows.find((row) => row.group_id && enrolled.has(row.group_id));
  if (!match?.group_id) return null;
  const group = Array.isArray(match.group) ? match.group[0] : match.group;
  return {
    sessionId: match.id,
    groupId: match.group_id,
    groupNiveau: group?.niveau ?? null,
  };
}

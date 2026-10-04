type Scope = { userId: string; sessionId: string; groupId: string };
type Recovery = Scope & { requestId: string; fingerprint: string; deadline: string; createdAt: number };
const prefix = (scope: Scope) => `captcf:homework-send:v1:${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.sessionId)}:${encodeURIComponent(scope.groupId)}:`;
const key = (value: Recovery) => prefix(value) + value.fingerprint;

// Match JSON transport semantics, but make object property order irrelevant.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

function read(storage: Storage, storageKey: string, scope: Scope): Recovery | null {
  const raw = storage.getItem(storageKey);
  if (!raw) return null;
  const value = JSON.parse(raw) as Recovery;
  if (value.userId !== scope.userId || value.sessionId !== scope.sessionId || value.groupId !== scope.groupId
    || !/^[a-f0-9]{64}$/.test(value.fingerprint) || !/^[a-f0-9-]{36}$/.test(value.requestId)
    || !/^\d{4}-\d{2}-\d{2}$/.test(value.deadline) || !Number.isFinite(value.createdAt) || key(value) !== storageKey) {
    throw new Error('État de reprise illisible. Aucun envoi effectué.');
  }
  return value;
}

export function recoveryDeadline(scope: Scope): string | undefined {
  // Opening is read-only. Storage denial must not prevent viewing prepared content.
  try {
    let latest: Recovery | null = null;
    for (let i = 0; i < sessionStorage.length; i++) {
      const storageKey = sessionStorage.key(i)!;
      if (!storageKey.startsWith(prefix(scope))) continue;
      const value = read(sessionStorage, storageKey, scope);
      if (value && (!latest || value.createdAt > latest.createdAt)) latest = value;
    }
    return latest?.deadline;
  } catch { return undefined; }
}

export async function preserveHomeworkRequest(scope: Scope, deadline: string, batch: unknown, preferredId?: string): Promise<Recovery> {
  const bytes = new TextEncoder().encode(canonical(JSON.parse(JSON.stringify(batch))));
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  const value: Recovery = { ...scope, fingerprint, requestId: preferredId ?? crypto.randomUUID(), deadline, createdAt: Date.now() };
  try {
    const existing = read(sessionStorage, key(value), scope);
    if (existing) return existing;
    // Persist before the network request. Never silently send without reload protection.
    sessionStorage.setItem(key(value), JSON.stringify(value));
    if (!read(sessionStorage, key(value), scope)) throw new Error('Storage unavailable');
    return value;
  } catch {
    throw new Error('Reprise après rechargement indisponible dans ce navigateur. Aucun envoi effectué.');
  }
}

export function clearHomeworkRequest(value: Recovery): void {
  // A late completion must not delete a different request written since then.
  if (read(sessionStorage, key(value), value)?.requestId === value.requestId) sessionStorage.removeItem(key(value));
}

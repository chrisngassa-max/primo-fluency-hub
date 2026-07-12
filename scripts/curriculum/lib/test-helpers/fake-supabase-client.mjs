/**
 * Client Supabase minimal en memoire pour tester les modules du pont
 * curriculum (`publish-bridge.mjs`) sans base reelle. Couvre uniquement les
 * appels reellement utilises par le pont : select/eq/limit/maybeSingle,
 * upsert(...).select().single(), insert(...).select().single(),
 * update(...).eq(...) (avec ou sans .select().single() ensuite).
 *
 * Ne pas etendre pour d'autres besoins que le pont — un mock plus generique
 * dupliquerait ce que des libs existent deja pour ca ; celui-ci reste
 * volontairement petit et lisible.
 */
export function createFakeSupabaseClient(seed = {}) {
  const tables = new Map();
  for (const [name, rows] of Object.entries(seed)) {
    tables.set(name, rows.map((row) => ({ ...row })));
  }
  let idCounter = 1;
  const nextId = () => `fake-${idCounter++}`;

  function ensureTable(name) {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  }

  function from(tableName) {
    const rows = ensureTable(tableName);
    const filters = [];
    let pendingOp = null;
    let notInFilter = null;

    function matches(row) {
      if (!filters.every(([col, val]) => row[col] === val)) return false;
      if (notInFilter && notInFilter.values.includes(row[notInFilter.col])) return false;
      return true;
    }

    function findMatch() {
      return rows.find(matches);
    }

    async function resolveRead() {
      const match = findMatch();
      return { data: match ? { ...match } : null, error: null };
    }

    async function resolveWrite() {
      if (pendingOp?.type === 'insert') {
        const row = { id: pendingOp.payload.id ?? nextId(), ...pendingOp.payload };
        rows.push(row);
        return { data: { ...row }, error: null };
      }
      if (pendingOp?.type === 'upsert') {
        const conflictCols = (pendingOp.onConflict ?? 'id').split(',').map((s) => s.trim());
        const existing = rows.find((r) => conflictCols.every((c) => r[c] === pendingOp.payload[c]));
        if (existing) {
          Object.assign(existing, pendingOp.payload);
          return { data: { ...existing }, error: null };
        }
        const row = { id: nextId(), ...pendingOp.payload };
        rows.push(row);
        return { data: { ...row }, error: null };
      }
      if (pendingOp?.type === 'update') {
        const match = findMatch();
        if (!match) return { data: null, error: { message: `Fake update: no row matched in "${tableName}"` } };
        Object.assign(match, pendingOp.payload);
        return { data: { ...match }, error: null };
      }
      return resolveRead();
    }

    const builder = {
      select() { return builder; },
      eq(col, val) { filters.push([col, val]); return builder; },
      not(col, op, valueList) {
        if (op === 'in') {
          const values = String(valueList).replace(/^\(|\)$/g, '').split(',').filter(Boolean);
          notInFilter = { col, values };
        }
        return builder;
      },
      limit() { return builder; },
      upsert(payload, opts = {}) { pendingOp = { type: 'upsert', payload, onConflict: opts.onConflict }; return builder; },
      insert(payload) { pendingOp = { type: 'insert', payload }; return builder; },
      update(payload) { pendingOp = { type: 'update', payload }; return builder; },
      async maybeSingle() { return pendingOp ? resolveWrite() : resolveRead(); },
      async single() { return resolveWrite(); },
      then(onFulfilled, onRejected) {
        // Permet `await client.from(x).update(y).eq(z, w)` sans .select()/.single().
        return (pendingOp ? resolveWrite() : resolveRead()).then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  return {
    from,
    __dump: (tableName) => (tables.get(tableName) ?? []).map((row) => ({ ...row })),
  };
}

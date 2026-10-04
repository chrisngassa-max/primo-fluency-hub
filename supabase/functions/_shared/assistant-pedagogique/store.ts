export type Row = Record<string, unknown>;
export interface DataStore {
  read(table: string, columns: string, filters: Record<string, string | null>, latest?: boolean): Promise<Row[]>;
  insert(table: string, row: Row): Promise<void>;
}
type Query = PromiseLike<{ data: unknown; error: unknown }> & {
  select(columns: string): Query;
  eq(column: string, value: string): Query;
  is(column: string, value: null): Query;
  order(column: string, options: { ascending: boolean }): Query;
  limit(count: number): Query;
  insert(row: Row): Query;
};
// Client JWT pour les droits/états ; client serveur pour le contenu fermé à
// la RLS élève, chargé SEULEMENT après contrôle de l'affectation.
export function supabaseStore(client: { from(table: string): unknown }): DataStore {
  return {
    async read(table, columns, filters, latest = false) {
      let query = (client.from(table) as Query).select(columns);
      for (const [key, value] of Object.entries(filters)) query = value === null ? query.is(key, null) : query.eq(key, value);
      if (latest) query = query.order('created_at', { ascending: false }).limit(1);
      const { data, error } = await query.limit(latest ? 1 : 100);
      if (error) throw new Error('context_read_failed');
      return Array.isArray(data) ? data as Row[] : [];
    },
    async insert(table, row) {
      const { error } = await (client.from(table) as Query).insert(row);
      if (error) throw new Error('help_write_failed');
    },
  };
}
export const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
export const string = (value: unknown): string => typeof value === 'string' ? value : '';
export async function one(store: DataStore, table: string, columns: string, filters: Record<string, string | null>): Promise<Row | null> {
  const rows = await store.read(table, columns, filters);
  if (rows.length > 1) throw new Error('ambiguous_context');
  return rows[0] ?? null;
}

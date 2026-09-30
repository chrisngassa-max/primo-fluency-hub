import {readFileSync} from 'node:fs';
import {describe,expect,it,vi} from 'vitest';
import {calculateFactsHash,canonicalFactsPayload} from '../../supabase/functions/_shared/differentiation/fact-hashing';
import {handleFactsRevision} from '../../supabase/functions/_shared/differentiation/revise-facts';
import {revisedFactsGate} from '../../supabase/functions/_shared/differentiation/revised-facts-gate';
const migration=readFileSync('supabase/migrations/20260930072021_revise_differentiation_facts_atomically.sql','utf8');
const sqlTests=readFileSync('supabase/tests/facts_revision_local.sql','utf8');
const fact=(n:number)=>({fact_id:`fact_0${n}`,subject:'Charlotte',predicate:'explique',object:`fait ${n}`,semantic_qualifiers:{speaker:'Charlotte'},required_for_task:true,provenance:{source_id:'fixture',transcription_id:'fixture',segment_refs:[],chunk_refs:[],quote:'proof'}});
describe('RPC static contract (not an SQL execution)',()=>{
 it('takes no actor, role, or final hash; fixes owner, grants, and search path',()=>{
  const args=migration.split('CREATE FUNCTION public.revise_differentiation_facts_atomically(')[1].split(') RETURNS')[0];
  expect(args).not.toMatch(/actor|user_id|role|server_hash|new_hash/);
  expect(migration).toContain('actor uuid:=auth.uid()');expect(migration).toContain("s.created_by IS DISTINCT FROM actor");
  expect(migration).toContain('FROM PUBLIC,anon,service_role');expect(migration).toContain('TO authenticated');
  expect(migration).toContain('SECURITY DEFINER\nSET search_path=pg_catalog');
  expect(migration).not.toMatch(/GRANT\s+(UPDATE|INSERT|ALL)/i);
 });
 it('locks before checking and changes both rows in a single RPC transaction',()=>{
  expect(migration.indexOf('FOR UPDATE')).toBeLessThan(migration.indexOf('FACTS_REVISION_CONFLICT'));
  expect(migration).toContain("public.studio_facts_hash(facts)");
  expect(migration).toContain("-'studio_facts_confirmation'");
  expect(migration).toContain("validation_status='pending'");
  expect(migration).toContain('FACT_REFERENCED_BY_ITEM');expect(migration).toContain('FACT_REFERENCED_BY_FACT');
 });
 it('provides real-role SQL assertions and rollback-on-error coverage',()=>{
  expect(sqlTests).toContain('SET LOCAL ROLE anon');expect(sqlTests).toContain('SET LOCAL ROLE authenticated');
  expect(sqlTests).toContain('WRONG_OWNER_CONTEXT');expect(sqlTests).toContain('TEST_FORCED_ROLLBACK');
  expect(sqlTests).toContain('PARTIAL_WRITE');expect(sqlTests).toContain('ROLLBACK;');
 });
 it('matches SQL golden vectors to the existing canonical hash module',async()=>{
  const hash=await calculateFactsHash([fact(2),fact(1)]);
  expect(hash).toBe('sha256:0613abe1727a710cdccb212acff28301b26ece9ffead7605ef6c4cea359881f4');expect(sqlTests).toContain(hash);
  const corrected=await calculateFactsHash([{...fact(1),object:'Corrigé : éclipse, "totalité"\n😊'}]);
  expect(corrected).toBe('sha256:789e1ad302f7330cdec301db2f5ec3e7f1fa69f2fa4f15a5a3c9624d7d4acd04');expect(sqlTests).toContain(corrected);
  expect(canonicalFactsPayload([fact(1)])).not.toContain('provenance');
 });
});
describe('Revision route and generation safety',()=>{
 it('routes revision before any role-admin query, family creation or model call',()=>{
  const edge=readFileSync('supabase/functions/generate-differentiation-family/index.ts','utf8');
  const route=edge.indexOf('if (body.action === "revise_facts")');
  expect(edge.indexOf('await caller.auth.getUser()')).toBeLessThan(route);
  expect(route).toBeLessThan(edge.indexOf('admin.rpc('));
  expect(route).toBeLessThan(edge.indexOf('const factResponse = await geminiJson'));
  expect(edge.slice(route,edge.indexOf('const sourceId',route))).toContain('return json(result.status, result.body)');
 });
 it.each(['A1','B1','B2'])('blocks %s for revised facts without confirmation',()=>{
  expect(revisedFactsGate([{payload:{facts_revision:{},facts:{facts_hash:'h'}}}],{},false)).toBe('FACTS_CONFIRMATION_REQUIRED');
 });
 it('requires the bounded shared-facts path after a matching confirmation',()=>{
  const families=[{payload:{facts_revision:{},facts:{facts_hash:'h'}}}];
  const metadata={studio_facts_confirmation:{facts_hash:'h'}};
  for(const mode of [undefined,false,'true',1]) expect(revisedFactsGate(families,metadata,false,mode)).toBe('REVISED_FACTS_BOUNDED_MODE_REQUIRED');
  expect(revisedFactsGate(families,metadata,false,true)).toBeNull();
  expect(revisedFactsGate(families,metadata,true,true)).toBe('FACTS_REVISION_REGENERATION_FORBIDDEN');
  expect(revisedFactsGate(families,{studio_facts_confirmation:{facts_hash:'stale'}},false,true)).toBe('FACTS_CONFIRMATION_REQUIRED');
 });
 it('preserves non-revised sources',()=>expect(revisedFactsGate([{payload:{facts:{facts_hash:'h'}}}],{},false)).toBeNull());
 it('binds generation admission to the revision checked before insertion',()=>{
  const edge=readFileSync('supabase/functions/generate-differentiation-family/index.ts','utf8');
  expect(edge).toContain('payload: { generation_facts_guard:');
  expect(edge).toContain('correctif_05a_c: body.correctif_05a_c === true');
  expect(edge.indexOf('if (created.error)')).toBeLessThan(edge.indexOf('const factResponse = await geminiJson'));
  const guard=migration.split('CREATE FUNCTION public.guard_studio_facts_generation()')[1].split('CREATE TRIGGER guard_studio_facts_generation')[0];
  expect(guard.indexOf('FOR UPDATE')).toBeLessThan(guard.indexOf('FACTS_CONFIRMATION_REQUIRED'));
  expect(guard).toContain('FACTS_GENERATION_REVISION_CONFLICT');
 });
 it.each([{}, {action:'revise_facts',user_id:'forged'}, {action:'revise_facts',facts_hash:'forged'}])('rejects malformed input without RPC',async body=>{
  const rpc=vi.fn();expect((await handleFactsRevision(body,{rpc})).status).toBe(400);expect(rpc).not.toHaveBeenCalled();
 });
});

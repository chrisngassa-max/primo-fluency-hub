import {readFileSync} from 'node:fs';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {handleFactsRevision} from '../../supabase/functions/_shared/differentiation/revise-facts';

const body={action:'revise_facts',sourceId:'20000000-0000-4000-8000-000000000001',familyId:'30000000-0000-4000-8000-000000000001',expected_hash:'sha256:'+'0'.repeat(64),expected_version:1,expected_source_updated_at:'2026-09-30T00:00:00Z',edits:[{fact_id:'fact_01',subject:'Synthetic',predicate:'states',object:'temporary'}]};
afterEach(()=>vi.useRealTimers());
describe('Facts conflict HTTP contract',()=>{
 it('returns PT409 as a redacted conflict after exactly one RPC and no delay',async()=>{
  vi.useFakeTimers();
  const rpc=vi.fn().mockResolvedValue({data:null,error:{code:'PT409',message:'FACTS_REVISION_CONFLICT',details:'private SQL'}});
  const start=Date.now();
  expect(await handleFactsRevision(body,{rpc})).toEqual({status:409,body:{error:'FACTS_REVISION_CONFLICT'}});
  expect(rpc).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);expect(Date.now()-start).toBe(0);
 });
 it.each([['42501','SOURCE_FORBIDDEN',403],['P0001','FACT_REFERENCED_BY_ITEM',422],['40001','FACTS_REVISION_CONFLICT',409]])('never retries business error %s',async(code,message,status)=>{
  const rpc=vi.fn().mockResolvedValue({data:null,error:{code,message}});
  expect((await handleFactsRevision(body,{rpc})).status).toBe(status);expect(rpc).toHaveBeenCalledTimes(1);
 });
 it('invalid input performs no RPC',async()=>{
  const rpc=vi.fn();expect((await handleFactsRevision({...body,user_id:'forged'},{rpc})).status).toBe(400);expect(rpc).not.toHaveBeenCalled();
 });
 it.each([400,401,403,409,422])('does not retry HTTP %s even with a technical code',async status=>{
  const rpc=vi.fn().mockResolvedValue({data:null,error:{code:'40001',message:'serialization failure'},status});
  await handleFactsRevision(body,{rpc});expect(rpc).toHaveBeenCalledTimes(1);
 });
 it.each(['40001','40P01'])('retries a proven transaction abort %s at most once',async code=>{
  const rpc=vi.fn().mockResolvedValueOnce({data:null,error:{code,message:'technical transaction abort'},status:500}).mockResolvedValueOnce({data:{version:2},error:null});
  expect(await handleFactsRevision(body,{rpc})).toEqual({status:200,body:{version:2}});expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  const failed=vi.fn().mockResolvedValue({data:null,error:{code,message:'technical transaction abort'},status:500});
  expect((await handleFactsRevision(body,{rpc:failed})).status).toBe(409);expect(failed).toHaveBeenCalledTimes(2);
 });
 it('never retries an ambiguous transport error or leaks its details',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:null,error:{code:'',message:'private network details'},status:0});
  expect(await handleFactsRevision(body,{rpc})).toEqual({status:500,body:{error:'FACTS_REVISION_FAILED'}});expect(rpc).toHaveBeenCalledTimes(1);
 });
});

it('forward migration and corrective rollback change only the error signal',()=>{
 const old=readFileSync('supabase/migrations/20260930072021_revise_differentiation_facts_atomically.sql','utf8').replace(/\r/g,'');
 const fn=old.slice(old.indexOf('CREATE FUNCTION public.revise_differentiation_facts_atomically('),old.indexOf('\nALTER FUNCTION public.revise_differentiation_facts_atomically')).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').trim();
 const forward=readFileSync('supabase/migrations/20260930182414_fix_facts_revision_conflict_status.sql','utf8').replace(/\r/g,'');
 const rollback=readFileSync('supabase/secours/20260930182414_fix_facts_revision_conflict_status_rollback.sql','utf8').replace(/\r/g,'');
 expect(rollback.slice(rollback.indexOf('CREATE OR REPLACE')).trim()).toBe(fn);
 expect(forward.slice(forward.indexOf('CREATE OR REPLACE')).trim()).toBe(fn.replace("RAISE EXCEPTION 'FACTS_REVISION_CONFLICT' USING ERRCODE='40001';","RAISE SQLSTATE 'PT409' USING MESSAGE='FACTS_REVISION_CONFLICT',\n      DETAIL='Expected facts revision is stale.';"));
});

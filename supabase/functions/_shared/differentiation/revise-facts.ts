/** No generator/model dependency: this action can only invoke the caller's RPC. */
type Caller = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{data: unknown; error: {code?: string; message?: string} | null; status?: number}> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keys = ['action','sourceId','familyId','expected_hash','expected_version','expected_source_updated_at','edits'];
const editKeys = ['fact_id','subject','predicate','object','speaker','viewpoint'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export async function handleFactsRevision(body: unknown, caller: Caller) {
  if (!record(body) || Object.keys(body).some(k=>!keys.includes(k)) || body.action!=='revise_facts'
    || typeof body.sourceId!=='string' || !uuid.test(body.sourceId)
    || typeof body.familyId!=='string' || !uuid.test(body.familyId)
    || typeof body.expected_hash!=='string' || !/^sha256:[a-f0-9]{64}$/.test(body.expected_hash)
    || !Number.isSafeInteger(body.expected_version) || Number(body.expected_version)<1
    || typeof body.expected_source_updated_at!=='string' || !Number.isFinite(Date.parse(body.expected_source_updated_at))
    || !Array.isArray(body.edits) || body.edits.length<1 || body.edits.length>100
    || JSON.stringify(body.edits).length>262144
    || body.edits.some(e=>!record(e) || Object.keys(e).some(k=>!editKeys.includes(k))
      || ['fact_id','subject','predicate','object'].some(k=>typeof e[k]!=='string' || !(e[k] as string).trim() || (e[k] as string).length>4000)
      || ['speaker','viewpoint'].some(k=>k in e && (typeof e[k]!=='string' || !(e[k] as string).trim() || (e[k] as string).length>200)))) {
    return {status:400,body:{error:'FACTS_REQUEST_INVALID'}};
  }
  const args={
    p_source_id:body.sourceId,p_family_id:body.familyId,p_expected_hash:body.expected_hash,
    p_expected_version:body.expected_version,p_expected_source_updated_at:body.expected_source_updated_at,p_edits:body.edits,
  };
  let result=await caller.rpc('revise_differentiation_facts_atomically',args);
  // Only a proven database transaction abort can be replayed, once. Never retry
  // a business response, legacy hash conflict, or ambiguous transport failure.
  if (result.error && ['40001','40P01'].includes(result.error.code ?? '')
    && result.error.message!=='FACTS_REVISION_CONFLICT'
    && ![400,401,403,409,422].includes(result.status ?? 0)) {
    result=await caller.rpc('revise_differentiation_facts_atomically',args);
  }
  const {data,error}=result;
  if(error){
    const conflict=['PT409','40001','40P01','55P03'].includes(error.code ?? '');
    const status=conflict?409:error.code==='42501'?403:error.code==='P0001'?422:500;
    const code=conflict?'FACTS_REVISION_CONFLICT':status===403?'FACTS_REVISION_FORBIDDEN':status===422 && /^[A-Z_]+$/.test(error.message??'')?error.message!:'FACTS_REVISION_FAILED';
    return {status,body:{error:code}};
  }
  return {status:200,body:data};
}

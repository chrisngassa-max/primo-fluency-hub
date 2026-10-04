import { supabase } from '@/integrations/supabase/client';
export type FactEdit = {fact_id:string;subject:string;predicate:string;object:string;speaker?:string;viewpoint?:string};
export type FactsRevisionInput = {sourceId:string;familyId:string;expected_hash:string;expected_version:number;expected_source_updated_at:string;edits:FactEdit[]};
export type FactsRevisionReceipt = {old_hash:string;new_hash:string;fact_count:number;status:'draft';version:number};
export async function reviseStudioFacts(input:FactsRevisionInput):Promise<FactsRevisionReceipt>{
  const edits=input.edits.map(({fact_id,subject,predicate,object,speaker,viewpoint})=>({fact_id,subject,predicate,object,...(speaker!==undefined?{speaker}:{}),...(viewpoint!==undefined?{viewpoint}:{})}));
  const {data,error}=await supabase.functions.invoke('generate-differentiation-family',{body:{action:'revise_facts',sourceId:input.sourceId,familyId:input.familyId,expected_hash:input.expected_hash,expected_version:input.expected_version,expected_source_updated_at:input.expected_source_updated_at,edits}});
  let code=data?.error;
  if(error && !code){try{code=(await error.context?.json())?.error;}catch{/* response unavailable */}}
  if(error||code) throw new Error(code||'FACTS_REVISION_FAILED');
  if(!data || !/^sha256:[a-f0-9]{64}$/.test(data.new_hash) || data.status!=='draft') throw new Error('FACTS_RECEIPT_INVALID');
  return data;
}

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StudioAudioFactsStep } from '@/components/studio-audio/StudioAudioFactsStep';
import { reviseStudioFacts } from '@/lib/studioFactsRevision';
import { handleFactsRevision } from '../../supabase/functions/_shared/differentiation/revise-facts';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('@/lib/pedagogicalSources', () => ({ updatePedagogicalSourceFields: vi.fn() }));
import { supabase } from '@/integrations/supabase/client';
import { updatePedagogicalSourceFields } from '@/lib/pedagogicalSources';
const sourceId='11111111-1111-4111-8111-111111111111', familyId='22222222-2222-4222-8222-222222222222';
const hash='sha256:'+ 'a'.repeat(64), next='sha256:'+'b'.repeat(64);
const facts=[1,2].map(n=>({fact_id:`fact_0${n}`,subject:'Charlotte',predicate:'explique',object:`fait ${n}`,semantic_qualifiers:{speaker:'Charlotte'},provenance:{quote:'preuve',segment_refs:['s1'],chunk_refs:['c1']},required_for_task:true}));
const family:any={id:familyId,target_level:'A2',generation_status:'generated',review_status:'draft',published_exercise_id:null,payload:{version:1,facts:{required:facts,facts_hash:hash},variants:{A2:{exercise:{items:[{id:'q1',instruction:'Question une',fact_refs:['fact_01']}]}}}}};
const request={sourceId,familyId,expected_hash:hash,expected_version:1,expected_source_updated_at:'2026-09-29T00:00:00Z',edits:[{fact_id:'fact_01',subject:'Charlotte',predicate:'explique',object:'texte',speaker:'Charlotte'}]};
const receipt={old_hash:hash,new_hash:next,fact_count:1,status:'draft',version:2};
let root:Root; let container:HTMLDivElement;
beforeEach(()=>{container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();});
const render=(element:React.ReactNode)=>act(()=>root.render(element));
const fireEvent={click:(e:HTMLElement)=>act(()=>e.click()),change:(e:HTMLInputElement,event:{target:{value:string}})=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(e,event.target.value);e.dispatchEvent(new Event('input',{bubbles:true}));})};
const waitFor=vi.waitFor;
const texts=(pattern:RegExp)=>Array.from(container.querySelectorAll('p')).filter(e=>pattern.test(e.textContent??''));
const screen={
 getByRole:(role:string,options?:{name:string})=>Array.from(container.querySelectorAll<HTMLElement>(role==='button'?'button':`[role="${role}"]`)).find(e=>!options || (e.getAttribute('aria-label')??e.textContent)===options.name)!,
 getByLabelText:(name:string)=>Array.from(container.querySelectorAll('label')).find(e=>e.textContent?.trim()===name)!.querySelector('input')!,
 queryByLabelText:(pattern:RegExp)=>Array.from(container.querySelectorAll('label')).find(e=>pattern.test(e.textContent??''))??null,
 getByText:(pattern:RegExp)=>texts(pattern)[0],getAllByText:texts,
};
beforeEach(()=>{vi.clearAllMocks(); vi.mocked(supabase.functions.invoke).mockResolvedValue({data:receipt,error:null});});
function mount(){const onRevised=vi.fn().mockResolvedValue(undefined);render(<StudioAudioFactsStep source={{id:sourceId,updated_at:request.expected_source_updated_at,metadata:{}} as any} sealed={{facts_hash:hash,facts,sourceFamilyId:familyId,levels:['A2']}} family={family} confirmation={null} divergent={false} userId='owner' onConfirmed={vi.fn()} onRevised={onRevised}/>);return onRevised;}
it('sends only edits and concurrency preconditions, never client provenance/hash/identity',async()=>{
 await reviseStudioFacts({...request,facts_hash:'forged',user_id:'fake',edits:[{...request.edits[0],provenance:{quote:'fake'}}]} as any);
 expect(supabase.functions.invoke).toHaveBeenCalledExactlyOnceWith('generate-differentiation-family',{body:{action:'revise_facts',...request}});
});
it('Edge invokes only the caller RPC; rejects forbidden fields before invocation',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:receipt,error:null});
 expect(await handleFactsRevision({action:'revise_facts',...request},{rpc})).toMatchObject({status:200,body:receipt});
 expect(rpc).toHaveBeenCalledExactlyOnceWith('revise_differentiation_facts_atomically',{p_source_id:sourceId,p_family_id:familyId,p_expected_hash:hash,p_expected_version:1,p_expected_source_updated_at:request.expected_source_updated_at,p_edits:request.edits});
 rpc.mockClear();
 for(const extra of [{facts_hash:next},{user_id:'x'},{role:'formateur'},{edits:[{...request.edits[0],provenance:{}}]}]) expect((await handleFactsRevision({action:'revise_facts',...request,...extra},{rpc})).status).toBe(400);
 expect(rpc).not.toHaveBeenCalled();
});
it('returns a stable conflict without retrying',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:null,error:{code:'40001',message:'FACTS_REVISION_CONFLICT'}});
 expect(await handleFactsRevision({action:'revise_facts',...request},{rpc})).toMatchObject({status:409,body:{error:'FACTS_REVISION_CONFLICT'}});expect(rpc).toHaveBeenCalledTimes(1);
});
it('shows references and read-only provenance; prevents referenced removal',()=>{
 mount();fireEvent.click(screen.getByRole('button',{name:'Corriger les faits'}));
 expect(screen.getByText(/Question une/)).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Retirer fact_01'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Retirer fact_02'})).toBeEnabled();
 expect(screen.queryByLabelText(/provenance/i)).not.toBeInTheDocument();
 expect(screen.getAllByText(/preuve/).length).toBeGreaterThan(0);
});
it('compares edits, cancels locally, saves separately and invalidates confirmation',async()=>{
 const onRevised=mount();fireEvent.click(screen.getByRole('button',{name:'Corriger les faits'}));
 fireEvent.change(screen.getByLabelText('Objet fact_01'),{target:{value:'corrigé'}});
 expect(screen.getByText(/Avant : Charlotte explique fait 1/)).toBeInTheDocument();
 expect(screen.getByText(/Après : Charlotte explique corrigé/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Annuler les corrections'}));expect(supabase.functions.invoke).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Corriger les faits'}));expect(screen.getByLabelText('Objet fact_01')).toHaveValue('fait 1');
 fireEvent.click(screen.getByRole('button',{name:'Retirer fact_02'}));
 fireEvent.click(screen.getByRole('button',{name:'Enregistrer les corrections'}));
 await waitFor(()=>expect(onRevised).toHaveBeenCalledOnce());
 expect(screen.getByRole('status')).toHaveTextContent(next);
 expect(updatePedagogicalSourceFields).not.toHaveBeenCalled();
 expect(screen.getByRole('button',{name:'Confirmer les faits communs'})).toBeDisabled();
 expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
});
it('shows a conflict and preserves the unsaved edit',async()=>{
 vi.mocked(supabase.functions.invoke).mockResolvedValue({data:{error:'FACTS_REVISION_CONFLICT'},error:null});
 mount();fireEvent.click(screen.getByRole('button',{name:'Corriger les faits'}));fireEvent.change(screen.getByLabelText('Objet fact_01'),{target:{value:'corrigé'}});fireEvent.click(screen.getByRole('button',{name:'Enregistrer les corrections'}));
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent(/conflit/i));expect(screen.getByLabelText('Objet fact_01')).toHaveValue('corrigé');
});

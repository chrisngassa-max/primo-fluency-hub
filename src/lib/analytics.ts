import { supabase } from '@/integrations/supabase/client';

export async function logEvent(params: {
  actorId: string;
  actorType: 'eleve' | 'formateur';
  verb: string;
  objectId?: string;
  objectType?: string;
  competence?: string;
  microCompetenceId?: string;
  gabaritId?: string;
  seanceNumero?: number;
  context?: string;
  result?: Record<string, any>;
  sessionId?: string;
  groupId?: string;
}) {
  try {
    await supabase.from('analytics_events').insert({
      actor_id: params.actorId,
      actor_type: params.actorType,
      verb: params.verb,
      object_id: params.objectId,
      object_type: params.objectType,
      competence: params.competence,
      micro_competence_id: params.microCompetenceId,
      gabarit_id: params.gabaritId,
      seance_numero: params.seanceNumero,
      context: params.context,
      result: params.result,
      session_id: params.sessionId,
      group_id: params.groupId,
      source_app: 'primo',
    });
  } catch (e) {
    console.error('[analytics] logEvent failed', e);
  }
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sanitizeExercice, type RawExercice } from '../_shared/session-content-sanitizer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return jsonResponse({ error: 'Authentification requise' }, 401);
    }
    const token = authHeader.slice(7).trim();
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      return jsonResponse({ error: 'Session invalide' }, 401);
    }
    const learnerId = userData.user.id;

    const { session_code: sessionCode } = await req.json().catch(() => ({}));
    if (!sessionCode || typeof sessionCode !== 'string') {
      return jsonResponse({ error: 'session_code requis' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Vérification d'enrôlement — même chemin que le reste de la
    // plateforme (training_sessions -> sessions -> group_members),
    // effectuée ici server-side (service role), jamais confiée à une
    // policy RLS activable par le client lui-même.
    const { data: enrollment, error: enrollmentError } = await admin
      .from('training_sessions')
      .select('id, sessions:sessions(id, group_id, group_members:group_members(eleve_id))')
      .eq('code', sessionCode)
      .maybeSingle();

    if (enrollmentError) {
      console.error('[get-seance-content] enrollment lookup error:', enrollmentError.message);
      return jsonResponse({ error: 'Erreur de vérification' }, 500);
    }

    const isEnrolled = Boolean(
      (enrollment as any)?.sessions?.some((s: any) =>
        (s.group_members ?? []).some((gm: any) => gm.eleve_id === learnerId),
      ),
    );
    if (!isEnrolled) {
      return jsonResponse({ error: 'Non enrôlé dans cette séance' }, 403);
    }

    const { data: activities, error: activitiesError } = await admin
      .from('session_activities')
      .select('id, activity_code, title, objective, display_order, pedagogical_status')
      .eq('session_code', sessionCode)
      .order('display_order', { ascending: true });
    if (activitiesError) throw activitiesError;

    // Jamais file_url / source_file_path / storage_path dans cette
    // sélection : liste de colonnes en dur, jamais construite depuis
    // l'input du client.
    const { data: documents, error: documentsError } = await admin
      .from('session_documents')
      .select('id, document_type, title, content_html, content_json, display_order, activity_id, pedagogical_status, audience')
      .eq('session_code', sessionCode)
      .in('audience', ['apprenant', 'both'])
      .in('pedagogical_status', ['publishable', 'published']);
    if (documentsError) throw documentsError;

    const { data: links, error: linksError } = await admin
      .from('session_document_links')
      .select('id, linked_id, display_order, activity_id, title')
      .eq('session_code', sessionCode)
      .in('audience', ['apprenant', 'both']);
    if (linksError) throw linksError;

    const linkedIds = (links ?? []).map((l) => l.linked_id);
    let exercisesById = new Map<string, Record<string, unknown>>();
    if (linkedIds.length > 0) {
      const { data: exercises, error: exercisesError } = await admin
        .from('exercices')
        .select('id, titre, consigne, competence, format, niveau_vise, contenu, civic_content, pedagogical_status, needs_content_review')
        .in('id', linkedIds)
        .in('pedagogical_status', ['publishable', 'published'])
        .eq('needs_content_review', false);
      if (exercisesError) throw exercisesError;
      exercisesById = new Map((exercises ?? []).map((e) => [e.id, e]));
    }

    const supportBlocks = (documents ?? []).map((d) => ({
      kind: 'support',
      id: d.id,
      activity_id: d.activity_id,
      display_order: d.display_order,
      title: d.title,
      content_html: d.content_html,
      content_json: d.content_json,
    }));

    const exerciseBlocks = (links ?? [])
      .map((link) => {
        const exercice = exercisesById.get(link.linked_id);
        if (!exercice) return null;
        return {
          kind: 'exercise' as const,
          id: link.id,
          activity_id: link.activity_id,
          display_order: link.display_order,
          ...sanitizeExercice(exercice),
        };
      })
      .filter((b) => b !== null);

    const blocks = [...supportBlocks, ...exerciseBlocks].sort((a: any, b: any) => a.display_order - b.display_order);

    return jsonResponse({
      session_code: sessionCode,
      activities: (activities ?? []).filter((a) => a.pedagogical_status !== 'draft'),
      blocks,
    });
  } catch (err: any) {
    console.error('[get-seance-content] unhandled error:', err?.message ?? err);
    return jsonResponse({ error: err?.message ?? 'Erreur interne' }, 500);
  }
});

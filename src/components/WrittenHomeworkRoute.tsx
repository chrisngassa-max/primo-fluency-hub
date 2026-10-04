import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isDeterministicWrittenHomework } from '@/lib/homeworkConsent';
import AIConsentRequiredRoute from './AIConsentRequiredRoute';

export default function WrittenHomeworkRoute({ children }: { children: ReactNode }) {
  const { devoirId } = useParams();
  const { user } = useAuth();
  const { data, isPending, isError } = useQuery({
    queryKey: ['homework-consent-route', user?.id, devoirId],
    queryFn: async () => {
      const { data, error } = await supabase.from('devoirs')
        .select('exercice:exercices!devoirs_exercice_id_fkey(competence,format,contenu)')
        .eq('id', devoirId!).eq('eleve_id', user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!devoirId,
  });
  if (isPending) return <p>Chargement du devoir…</p>;
  if (isError || !data) return <p>Devoir indisponible.</p>;
  return isDeterministicWrittenHomework(data.exercice) ? <>{children}</>
    : <AIConsentRequiredRoute>{children}</AIConsentRequiredRoute>;
}

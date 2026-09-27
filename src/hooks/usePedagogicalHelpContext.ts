import { useEffect } from 'react';
import { useAidePedagogique } from '@/contexts/AidePedagogiqueContext';
import type { PedagogicalSelectors } from '@/lib/avatar/pedagogicalTypes';

/** Ne transmet que des sélecteurs. La page ne déclare jamais la remise/mode. */
export function usePedagogicalHelpContext(selectors: PedagogicalSelectors | null, itemCount = 0) {
  const { setAideContext } = useAidePedagogique();
  const exerciseId = selectors?.exerciseId;
  const itemIndex = selectors?.itemIndex;
  const sessionId = selectors?.sessionId;
  const devoirId = selectors?.devoirId;
  const attemptId = selectors?.attemptId;
  useEffect(() => {
    setAideContext({ pedagogical: exerciseId && itemIndex !== undefined ? { exerciseId, itemIndex, sessionId, devoirId, attemptId } : null, pedagogicalItemCount: itemCount });
    return () => setAideContext({ pedagogical: null, pedagogicalItemCount: 0 });
  }, [setAideContext, exerciseId, itemIndex, sessionId, devoirId, attemptId, itemCount]);
}

// Adaptateur Node : la logique canonique vit dans _shared et est consommée
// telle quelle par les scripts curriculum et les Edge Functions Deno.
export {
  getExerciseCoherenceContract,
  validateExerciseCoherence,
} from "../../../supabase/functions/_shared/exercise-coherence-validator.mjs";
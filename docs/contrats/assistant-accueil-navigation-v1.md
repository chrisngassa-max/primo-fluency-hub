# Contrat assistant d'accueil — accueil-navigation-v1

Source exécutable : `supabase/functions/_shared/assistant-accueil/contract-v1.ts`.  
Le serveur applique cette matrice avant tout appel de modèle. Un seul orchestrateur : `orchestrateAccueil`.

## Outils

`open_route`, `deliver_validated_hint`, `replay_audio_segment`, `recommend_next_activity`, `flag_help_needed`.

## Matrice mode × outil

| Outil | Entraînement | Devoir | Évaluation |
|---|---|---|---|
| open_route | liste blanche élève | devoir courant seulement | écran d'évaluation courant |
| deliver_validated_hint | indices validés 1 à 3 | indice 1 seulement | interdit |
| replay_audio_segment | selon la règle de l'exercice | selon le contrat du devoir | interdit |
| recommend_next_activity | autorisé | seulement après remise | interdit |
| flag_help_needed | signal pédagogique | signal pédagogique | signal technique seulement |

## Indices

Banque d'abord. Le modèle ne peut que reformuler un indice déjà validé. Pour un QCM, un indice est refusé s'il élimine une option, désigne une option probable, cite un mot présent seulement dans la bonne réponse, ou réduit le choix à deux options.

## Contexte sortant

`auth.uid()` et le contrôle RLS restent dans l'orchestrateur. Le payload vers Gemini ne contient ni uid, ni nom, ni email. En évaluation : aucune clé, correction, indice ou transcription. Une ligne dont l'élève n'est pas l'utilisateur authentifié bloque tout le tour.

## Conservation

| Cas | Texte stocké | Durée |
|---|---|---|
| Conversation ordinaire | non | — |
| flag_help_needed | extrait nécessaire + résumé | 30 jours |
| Erreur | payload expurgé | 7 jours |
| Métriques | non | — |
| Fallback | non ; journal `provider=faq_fallback`, réponse visible | — |

Ce lot ne crée pas de table. La durée est une décision, pas une écriture.

## IA réelle

Bloquée pour les données élèves tant que `CAPTCF_ASSISTANT_PAID_TIER_PROVEN` n'est pas `true`. Ce drapeau n'est pas posé.

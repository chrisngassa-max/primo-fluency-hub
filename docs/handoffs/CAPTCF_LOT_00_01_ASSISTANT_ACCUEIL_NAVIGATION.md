# CAPTCF — Lot 0 contrat + Lot 1 accueil navigation

**Date :** 2026-09-27  
**Branche locale :** `captcf-lot-00-01-assistant-accueil`  
**Point de départ :** `e7af8fff9a07a772c637bd4132e0d328289dcd73`  
**Commit code :** `cf9b463f53ba554b0664479eade3dca9d7798b7a`  
**Nature :** contrat + code local. Aucun push, aucun déploiement, aucune migration, aucun appel payant.

## Architecture constatée

Un seul assistant, pas un nouvel agent. L'Edge `captcf-assistant-qa` reste l'entrée HTTP. Le consentement (`ai_processing_consents`), les plafonds, la FAQ et `callAI` sont réutilisés.

L'orchestrateur `orchestrateAccueil` construit un contexte compact, applique la matrice, puis seulement ensuite pourrait appeler un modèle. Dans ce lot, cet appel n'est pas fait.

Modèle prévu pour l'assistant : `CAPTCF_ASSISTANT_MODEL`, défaut `google/gemini-2.5-flash-lite`.  
API : `callAI` dans `supabase/functions/_shared/ai-client.ts`. Passerelle Lovable `https://ai.gateway.lovable.dev/v1/chat/completions` si `LOVABLE_API_KEY`, sinon Gemini `generateContent` sur `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`. Le préflight 3B-3 indique un runtime par `GEMINI_API_KEY`, sans `LOVABLE_API_KEY`.  
Conservation côté client IA : aucun identifiant de conversation, aucun drapeau de rétention. Le texte d'une conversation ordinaire n'est pas écrit par l'orchestrateur.

`readiness`, `routing_decisions` et le Mode Atelier n'ont pas été modifiés.

## Paid Tier

Non prouvé. Le dépôt montre un smoke Gemini Flash-Lite réussi, ce qui ne distingue pas un palier gratuit d'un palier payant. Aucun appel de facturation ni appel modèle n'a été fait ici. L'IA réelle est donc marquée bloquée pour les données élèves (`CAPTCF_ASSISTANT_PAID_TIER_PROVEN` absent). Les tests utilisent le provider simulé, qui ne doit pas être appelé.

## Fonctions disponibles

- `open_route` sur liste blanche élève
- `deliver_validated_hint` depuis la banque, filtré par le mode et par les règles QCM
- `replay_audio_segment` selon la règle exercice ou devoir
- `recommend_next_activity` selon la matrice
- `flag_help_needed` : décision de conservation seulement
- accueil : aujourd'hui, devoirs, prochaine séance, ouvrir l'activité
- fallback FAQ visible, journal `provider=faq_fallback` sans texte

## Limites

- Le chargeur Edge ne copie pas le contenu d'exercice : la banque d'indices réelle est vide, le replay est faux par défaut. Les tests injectent la banque.
- `flag_help_needed` ne persiste rien : aucune nouvelle table.
- Le panneau Aide applique le même orchestrateur en local, avec les titres de devoirs lus par le client RLS de l'élève. La décision qui fait foi reste l'Edge, qui ignore tout snapshot envoyé par le navigateur.
- L'écran élève est derrière la connexion. Le libellé FAQ et la navigation n'ont pas été rejoués dans un compte élève.

## Vérification

Tests ciblés : contrat, payload, navigation, corpus qualitatif, assistant 3B-2/3B-3. 36 tests passés. `vite build` passé.  
Le corpus `captcf-accueil-conversations-reference.json` est une référence qualitative, pas un contrôle de sécurité.

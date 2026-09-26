# CAPTCF — LOT 3B-1 — Prototype Avatar FAQ (local)

**Date :** 2026-09-24  
**Après Phase B :** `01505c1a`  
**Nature :** MVP local réversible — **0** API payante, **0** table distante, **0** déploiement, **0** données élèves.

## Livré

| Élément | Chemin |
|---|---|
| FAQ contrôlée | `src/data/captcf-avatar-faq.json` |
| Moteur matching + refus | `src/lib/avatar/answerAvatarQuestion.ts` |
| UI texte (bouton Aide) | `src/components/eleve/AvatarAssistantPanel.tsx` |
| Branchement élève | `src/layouts/EleveLayout.tsx` (réversible : retirer 2 lignes) |
| Tests | `src/test/avatar-assistant-faq.test.ts` — **10/10 pass** |

## Garde-fous

- Refus : admin / résultats officiels / autre élève  
- Fallback uncertain hors FAQ  
- Bouton « Ma langue » désactivé (pas d’API)  
- Pas de consent IA (aucun modèle appelé)

## Arrêt volontaire

- Pas d’Edge Function, pas de clé, pas de TTS/STT  
- Pas d’audit RLS  
- Prochaine étape (autorisation coût) : option B cadrage 3B si validation UX

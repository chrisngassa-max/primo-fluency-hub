# CAPTCF — LOT 3B-2 — Assistant pédagogique contextuel

**Date :** 2026-09-26  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**Nature :** MVP local séance pilote S01 — **0** API payante, **0** table distante, **0** déploiement, **0** données élèves réelles.

---

## 1. Architecture (résumé)

Panneau Aide (`AvatarAssistantPanel`) ← contexte React (`AidePedagogiqueContext`, sync depuis Ma séance) ← orchestrateur `answerContextualQuestion` ← requête nettoyée `prepareAssistantRequest` ← **fournisseur IA remplaçable** (`AssistantAiProvider`) → aujourd’hui `local_deterministic` ; FAQ `answerAvatarQuestion` en fallback.

```
MaSeance → useSyncAideContextFromSeance → AidePedagogiqueProvider
                                              ↓
                                    AvatarAssistantPanel
                                              ↓
                              answerContextualQuestion
                         ↙ refus évaluation / sources insuffisantes
            prepareAssistantRequest (S01 corpus, sans PII)
                         ↓
            resolveAssistantProvider() → LocalDeterministicProvider
                         ↓ (si unavailable / erreur)
                  FAQ locale (Lot 3B-1)
```

---

## 2. Données utilisées

| Source | Usage |
|---|---|
| Séance élève (`sessions.titre`, exercices persistés) | Titre, code déduit (`inferCurriculumSessionCode`), exercice en cours / à faire |
| Corpus local `src/data/captcf-s01-assistant-sources.json` | Objectifs, faits validés, lexique, consignes / aides par niveau — **sans corrigé** |
| FAQ `src/data/captcf-avatar-faq.json` | Fallback si provider indisponible ou hors périmètre FAQ |

**Non utilisés :** `corrige.json`, scores, emails, `eleve_id`, noms, autres élèves.

---

## 3. Protections

- Refus contrôlé si demande de **réponse d’évaluation**
- Refus / incertitude si **sources insuffisantes** (hors S01 + hors FAQ)
- `assertNoPersonalData` sur la requête préparée (clés PII, email-like)
- Clés API / Edge `ai-client` **non appelées** (arrêt volontaire avant branchement réel)
- Pas de nouvelle table distante

---

## 4. Ce qui fonctionne réellement

- Contexte séance + exercice affiché dans le panneau Aide (via Ma séance)
- 5 intentions UI : expliquer, reformuler, exemple, indice, mini-exercice
- Adaptation texte A1 / A2 / B1 / B2 (fournisseur local déterministe)
- Refus réponse d’évaluation
- Fallback FAQ si provider `available: false`
- Tests ciblés + build OK

---

## 5. Ce qui reste simulé

- Toutes les « réponses IA » = **faux fournisseur local déterministe** (pas de modèle)
- Pas d’Edge Function dédiée assistant élève
- Pas de TTS / STT / avatar animé
- Hors S01 : pas de corpus contextuel (FAQ ou refus)

---

## 6. Coût prévisible branchement IA réel

Réutiliser Edge + `supabase/functions/_shared/ai-client.ts` (Lovable gateway / Gemini) :

| Poste | Ordre de grandeur |
|---|---|
| Dev | 0,5–1 j (Edge + consent `ai_consent` + journalisation minimale) |
| Coût run | faible (Gemini Flash / gateway) — **tokens courts**, contexte S01 borné |
| RGPD | revue consent + rétention avant prod |

**Aucune clé côté navigateur.**

---

## 7. Prochaine autorisation nécessaire

1. **Autorisation coût / clés** pour brancher un vrai provider via Edge (remplacer seulement `resolveAssistantProvider` + Edge Function).  
2. Eventuellement **consent IA élève** (`has_ai_consent`) avant tout appel modèle.  
3. Extension corpus au-delà de S01 = lot contenu séparé.

---

## 8. Fichiers livrés

| Élément | Chemin |
|---|---|
| Corpus S01 | `src/data/captcf-s01-assistant-sources.json` |
| Orchestrateur | `src/lib/avatar/answerContextualQuestion.ts` |
| Préparation / PII | `src/lib/avatar/prepareAssistantRequest.ts` |
| Provider local | `src/lib/avatar/providers/*` |
| Contexte React | `src/contexts/AidePedagogiqueContext.tsx` |
| Sync Ma séance | `src/hooks/useSyncAideContextFromSeance.ts` |
| UI | `src/components/eleve/AvatarAssistantPanel.tsx` |
| Tests | `src/test/avatar-assistant-contextual.test.ts` |

**Tests :** 7 contextual + 10 FAQ = 17/17 pass — **build** OK.

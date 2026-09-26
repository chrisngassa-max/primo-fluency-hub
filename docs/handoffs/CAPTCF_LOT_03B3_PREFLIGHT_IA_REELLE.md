# CAPTCF — LOT 3B-3 PHASE A — Préflight IA réelle et consentement

**Date :** 2026-09-26  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**Commit de départ :** `c884088f` (HEAD au démarrage = ce commit ; ancêtre confirmé)  
**Nature :** préflight + code local — **0 déploiement**, **0 migration**, **0 appel payant**, **0 secret créé**, **0 push**.

---

## 1. Préflight ciblé

| # | Question | Réponse |
|---|---|---|
| 1 | Lovable/Gemini Edge sans exposer clé ? | **Oui** — `supabase/functions/_shared/ai-client.ts` : `LOVABLE_API_KEY` / `GEMINI_API_KEY` côté Edge uniquement. Client n’envoie que JWT + payload pédagogique. |
| 2 | Modèle le moins coûteux suffisant | **`gemini-2.5-flash-lite`** (via Lovable : `google/gemini-2.5-flash-lite`) — réponses pédagogiques courtes. |
| 3 | Coût 10 / 100 / 1000 | Voir §3 (tarifs officiels Google). |
| 4 | Limites | Question ≤ 400 car. ; réponse ≤ 600 ; ≤ 6 faits / 6 lexique ; ≤ 30 Q IA/jour (localStorage) ; timeout 8 s → FAQ. |
| 5 | Payload PII | `assertNoPersonalData` + contrôles Edge ; pas d’id/email/nom/score. |
| 6 | Consentement | Info simple + accept/refus UI ; **sans nouvelle table** (voir §4). |
| 7 | Protections | Prompt grounded ; refus évaluation côté client + filtre fuite côté Edge ; hors sujet → incertitude / FAQ. |
| 8 | Contenu validé | Uniquement corpus S01 (`captcf-s01-assistant-sources.json`) dans le prompt — pas de corrigé. |

---

## 2. Architecture préparée

```
AvatarAssistantPanel (+ boîte consentement Aide)
        ↓
answerContextualQuestion (auth → consent Edge → quota → timeout)
        ↓
prepareAssistantRequest (S01, sans PII, borné)
        ↓
resolveAssistantProvider()
  ├─ Phase A (défaut) : LocalDeterministicProvider
  └─ Phase B (flags ON + consent) : EdgeAssistantProvider
        ↓
Edge captcf-assistant-qa (code prêt, NON déployé)
  kill-switch CAPTCF_ASSISTANT_AI_ENABLED + checkConsent(consent_ai)
  → callAI(model flash-lite)
```

---

## 3. Fournisseur / modèle / coût estimé

**Source tarifaire officielle :** [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) (consulté 2026-09-26).

| Modèle | Input / 1M tokens | Output / 1M tokens |
|---|---|---|
| **gemini-2.5-flash-lite** (reco) | **$0.10** | **$0.40** |
| gemini-2.5-flash (fallback ai-client) | $0.30 | $2.50 |

**Hypothèse conservatrice / question :** ~1000 tokens entrée (sources S01 bornées + consignes) + ~200 tokens sortie.

| Volume | Coût estimé (Flash-Lite) | Coût estimé (Flash) |
|---|---|---|
| 10 | ~**$0.002** | ~$0.008 |
| 100 | ~**$0.02** | ~$0.08 |
| 1000 | ~**$0.18** | ~$0.80 |

Lovable gateway : coût réel dépend du compte Lovable ; la clé reste serveur. Recommandation CapTCF : Gemini Flash-Lite en premier via `CAPTCF_ASSISTANT_MODEL`.

---

## 4. Consentement — **sans nouvelle table**

| Couche | Mécanisme |
|---|---|
| UI Aide (accept / refuse) | **localStorage** `captcf_assistant_ai_consent_v1` |
| Quota journalier | **localStorage** `captcf_assistant_usage_YYYY-MM-DD` |
| Garde Edge (Phase B) | Table **existante** `ai_processing_consents.consent_ai` via `checkConsent` |

Refus Aide → FAQ locale maintenue. Pas de migration.

---

## 5. Prêt localement vs simulé

### Prêt localement
- Orchestrateur : auth, consent Edge, quota, timeout, bornes
- Provider Edge client + Edge Function **code** (`captcf-assistant-qa`)
- Boîte consentement dans panneau Aide
- Fallback FAQ auto
- Tests simulés (0 réseau payant)
- `config.toml` entrée `verify_jwt = true` (préparation)

### Reste simulé / non activé
- Aucun déploiement Edge
- Flag client `VITE_CAPTCF_ASSISTANT_AI_LIVE` **OFF**
- Kill-switch serveur `CAPTCF_ASSISTANT_AI_ENABLED` **OFF** (sinon 503)
- Réponses courantes = provider local déterministe
- Aucun appel Lovable/Gemini réel

---

## 6. Données envoyées (Phase B, si autorisé)

Uniquement `PreparedAssistantRequest` : question, intent, niveau, titre séance/leçon/exercice, consigne, faits/lexique/aides S01 validés.  
**Jamais :** `eleve_id`, email, nom, scores, voix.

---

## 7. Secrets nécessaires (Phase B uniquement)

| Secret / flag | Rôle |
|---|---|
| `LOVABLE_API_KEY` et/ou `GEMINI_API_KEY` | Déjà prévus pour ai-client (ne pas créer ici) |
| `CAPTCF_ASSISTANT_AI_ENABLED=true` | Kill-switch serveur |
| `CAPTCF_ASSISTANT_MODEL` (opt.) | Défaut `google/gemini-2.5-flash-lite` |
| `VITE_CAPTCF_ASSISTANT_AI_LIVE=true` | Flag client |
| `AI_PSEUDONYM_SECRET` | Déjà requis par `ensurePseudonymSecretOrLog` |

**Phase A : aucun secret créé.**

---

## 8. Tests / build

- `avatar-assistant-preflight-3b3.test.ts` + contextual + FAQ → **25/25**
- `npm run build` → **OK**

---

## 9. Autorisation EXACTE requise pour Phase B

> **J’autorise CapTCF Lot 3B-3 Phase B : déployer l’Edge Function `captcf-assistant-qa`, activer `CAPTCF_ASSISTANT_AI_ENABLED=true` et `VITE_CAPTCF_ASSISTANT_AI_LIVE=true`, et accepter des appels payants Gemini/Lovable (modèle flash-lite, plafonds 30 Q/jour/élève et réponses ≤600 car.) en réutilisant les secrets Edge déjà configurés — sans nouvelle table ni migration.**

---

## 10. Fichiers clés

| Élément | Chemin |
|---|---|
| Edge (non déployée) | `supabase/functions/captcf-assistant-qa/index.ts` |
| Provider Edge | `src/lib/avatar/providers/edgeAssistantProvider.ts` |
| Consent / limits / flags | `src/lib/avatar/assistantConsent.ts`, `assistantLimits.ts`, `assistantFeatureFlags.ts` |
| Orchestrateur | `src/lib/avatar/answerContextualQuestion.ts` |
| UI consent | `src/components/eleve/AvatarAssistantPanel.tsx` |
| Tests | `src/test/avatar-assistant-preflight-3b3.test.ts` |

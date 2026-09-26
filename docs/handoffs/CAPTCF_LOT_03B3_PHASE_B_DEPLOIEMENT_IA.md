# CAPTCF — LOT 3B-3 PHASE B — Déploiement IA réelle

**Date :** 2026-09-26  
**Écart PR #34 :** déjà **MERGED** (`49789347`, 2026-09-26) **avant** les commits 3B-2/3B-3 → **nouvelle PR #35** créée (pas de réouverture #34).

---

## Opérations exécutées

| Étape | Résultat |
|---|---|
| Branche | `captcf-lot-03b-assistant-ia` (cherry-pick `c884088f`→`ffcdc2c7`, `f192871a`→`ffa09c30` + `bc67f265` flag PROD) |
| PR | [#35](https://github.com/chrisngassa-max/primo-fluency-hub/pull/35) → merged |
| CI + preview | green (`test-build-lint` + Vercel preview) |
| Edge deploy | `captcf-assistant-qa` **v1** sur `gudcenhmzlcvhgbgklzw`, d’abord `CAPTCF_ASSISTANT_AI_ENABLED=false` |
| Auth | sans JWT → **401** (`verify_jwt=true`) |
| Consent serveur | table `ai_processing_consents` lisible ; **23** `consent_ai=true` actifs ; Edge appelle `checkConsent` |
| PII | payload préparé + `assertNoPii` Edge ; pas de clé Gemini frontend |
| Frontend prod | Vercel **READY** `dpl_CHHdNPA9CJCXjP6v7tEWKAzXoQhg` alias **captcf.fr** |
| Flag client | `VITE_CAPTCF_ASSISTANT_AI_LIVE=true` (Vercel prod/preview) + default `PROD` dans code |
| Flag serveur | `CAPTCF_ASSISTANT_AI_ENABLED=true` **après** frontend live |

---

## SHA / versions

| Élément | Valeur |
|---|---|
| `origin/main` (merge #35) | `a90ded1b450f83e496b0b0bacd13220fe749e19a` |
| Tip feature avant merge | `bc67f265` |
| Edge | `captcf-assistant-qa` **version 1** |
| Modèle configuré | `google/gemini-2.5-flash-lite` (défaut Edge) ; runtime via `GEMINI_API_KEY` (pas de `LOVABLE_API_KEY`) |
| Appels observés `ai_processing_logs` | **aucun** (smoke élève non réalisé) |

---

## Smoke élève réel

**Non réalisable** dans cette session : aucun compte élève consentant + session locale sûre sans créer de compte / demander MDP / réactiver E2E.  
FAQ locale reste disponible côté client. Pas de validation fonctionnelle bout-en-bout revendiquée.

---

## Coûts observables

Aucun appel modèle facturé observé (0 ligne `captcf-assistant-qa` dans `ai_processing_logs`).  
Estimation théorique inchangée (Flash-Lite ~$0.002 / $0.02 / $0.18 pour 10/100/1000 Q).

---

## RA (rollback immédiat)

```bash
npx supabase secrets set CAPTCF_ASSISTANT_AI_ENABLED=false --project-ref gudcenhmzlcvhgbgklzw
```

→ Edge répond 503 `assistant_ai_disabled` ; le panneau Aide bascule FAQ.  
Optionnel frontend : `VITE_CAPTCF_ASSISTANT_AI_LIVE=false` sur Vercel + redeploy.

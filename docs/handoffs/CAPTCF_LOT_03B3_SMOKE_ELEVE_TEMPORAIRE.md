# CAPTCF — LOT 3B-3 — Smoke élève temporaire `captcf-assistant-qa`

**Date :** 2026-09-26  
**Projet :** `gudcenhmzlcvhgbgklzw`  
**Edge :** `captcf-assistant-qa` v1  
**Association séance :** payload S01 injecté uniquement (pas de mutation groupe / élèves réels)

---

## Compte temporaire

| Champ | Valeur |
|---|---|
| Email | `smoke.assistant.20260926@captcf-smoke.test` |
| Mot de passe | temporaire généré, **non versionné** (fichier gitignored `.local-security-evidence/`) |
| user_id | `d5f26c1c-ce94-4a9f-81f5-68a6b190fdb4` |
| Rôle | `eleve` |
| Consent | `ai_processing_consents.consent_ai=true` (`source=smoke_temp_3b3`) |
| Ban | **oui** — `banned_until` ≈ 2126-09-02 ; sessions/refresh = **0** ; consent révoqué |
| Preuves | `.local-security-evidence/` (gitignored) |

---

## 5 scénarios

| # | Scénario | HTTP | Modèle | Comportement |
|---|---|---|---|---|
| 1 | Question contextualisée S01 | **200** | `google/gemini-2.5-flash-lite` | Réponse grounded parcours 80 h / objectifs |
| 2 | Reformulation niveau | **200** | idem | Reformulation simple (sources limitées sur devoir/règle) |
| 3 | Hors sujet | **200** | idem | Refus contrôlé + recentrage CapTCF |
| 4 | Réponse d’évaluation | **200** | idem | **uncertain=true** — refus spoiler évaluation |
| 5 | Probe fallback / nonsens | **200** | idem | Refus grounded « sources insuffisantes » + invite à reformuler |

Aucun scénario n’a déclenché de 5xx → **flag non désactivé**.

---

## Modèle / flag

| Élément | État |
|---|---|
| Modèle réellement renvoyé | `google/gemini-2.5-flash-lite` |
| Provider logué | `lovable_or_gemini` |
| `CAPTCF_ASSISTANT_AI_ENABLED` final | **true** (smoke OK) |

---

## Journaux

### `ai_processing_logs`
**Oui** — 5 lignes `status=ok`, `data_categories=['pedagogical_context']`, modèle `google/gemini-2.5-flash-lite`.

### PII dans logs
**OK** — schéma `ai_processing_logs` : pas de colonnes question/réponse/email ; seulement ids + métadonnées techniques. Pas de texte pédagogique stocké.

---

## RA

Toujours disponible :

```bash
npx supabase secrets set CAPTCF_ASSISTANT_AI_ENABLED=false --project-ref gudcenhmzlcvhgbgklzw
```

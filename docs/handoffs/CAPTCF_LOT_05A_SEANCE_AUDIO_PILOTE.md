# CAPTCF — LOT 5A — Séance audio différenciée pilote (Louise)

**Date :** 2026-09-26  
**Branche :** `captcf-lot-05a-audio-louise-pilote`  
**Projet :** Supabase `gudcenhmzlcvhgbgklzw`  
**Préflight :** `docs/handoffs/CAPTCF_LOT_05A_PREFLIGHT_SEANCE_AUDIO_DIFFERENCIEE.md`  
**Autorisation propriétaire :** Lot 5A séance audio différenciée pilote (source unique Louise) — reçue et respectée.

---

## Verdict

**OK pilote** — pipeline import → hash → STT → revue → analyse → génération A1–B2 → validation humaine simulée → publication → devoir test → smoke élève (MP3 original) réussi.

| Critère préflight | Résultat |
|---|---|
| 1 seul audio Louise | **OK** |
| A2 publié + `contenu.audio` | **OK** (6 items) |
| Autre variante (A1/B1) | **OK** (A1 + B1 + B2 publiés) |
| Élève entend MP3 original | **OK** (SHA identique, 1 476 404 o) |
| Pas d’autre MP3 / pas migration / pas ADR-STT | **OK** |
| Secrets/deploy Edge supplémentaires | **Non** — `GEMINI_API_KEY` + Edges déjà présents |

---

## Source audio

| Champ | Valeur |
|---|---|
| Chemin | `docs/fichiers oral/A2/louise_musique_et_ville.mp3` |
| Taille | 1 476 404 octets (~1,4 Mo) |
| SHA-256 local | `b880b3c77f980676858ba05e71e7f3d435e1d8074a633b248d9ce90503d102db` |
| `source_id` | `4a0e8321-9ece-42d7-bf76-8825b1e65e79` |
| `content_hash` (serveur) | `sha256:b880b3c77f980676858ba05e71e7f3d435e1d8074a633b248d9ce90503d102db` |
| Statuts | `status=analyzed`, `review_status=utilisable` |
| Transcription | `ac470742-28f8-4d5f-93bd-c49ddf4e2715` — 31 segments, revue humaine simulée (raw → reviewed via RPC) |

Le binaire **n’est pas** committé ; import Storage bucket `pedagogical-sources` uniquement.

---

## Pipeline (étapes)

| # | Étape | Statut | Notes |
|---|---|---|---|
| 1 | Branche depuis `main` | **OK** | `captcf-lot-05a-audio-louise-pilote` |
| 2 | Import + hash | **OK** | Edge `hash-pedagogical-source` ~1,8 s |
| 3 | Transcription Gemini | **OK** | ~19 s ; provider provisoire existant |
| 4 | Revue humaine (contrôlée) | **OK** | RPC `validate_pedagogical_source_transcription_review` |
| 5 | Analyse | **OK** | Edge `analyze-pedagogical-source` ~19 s |
| 6 | Génération A2→A1→B1→B2 | **OK** (avec retries) | Sockets intermittents côté client ; 1ère A2 `validation=failed` (`DIFF_NO_CORRECT_ANSWER`) → force regen → `passed_with_warnings` |
| 7 | Validation + publish | **OK** | A1, A2, B1, B2 publiés |
| 8 | Devoir test + smoke | **OK** | Voir § Smoke |
| 9 | Ban comptes temp | **OK** | `banned_until` ≈ 2126-09-02 |

---

## Niveaux générés / publiés

| Niveau | Famille | Exercice | Items | Validation | `contenu.audio` |
|---|---|---|---|---|---|
| **A1** | `651c11cd-…` | `c149d6a6-…` | **4** | passed_with_warnings | même `source_id` + hash |
| **A2** | `5db352f5-…` | `2e654590-…` | **6** | passed_with_warnings | idem |
| **B1** | `0b8ae2d3-…` | `f72e6373-…` | **7** | passed_with_warnings | idem |
| **B2** | `173d6c8c-…` | `5434a97f-…` | **6** | passed_with_warnings | idem |

Titres publiés (indicatif) : A1 « La Musique et le Solfège » ; A2/B1 « La musique et son apprentissage » ; B2 « La Musique : Passion et Pratique ».

### Faits / `facts_hash`

Chaque niveau a un `facts_hash` **distinct** (extraction/génération par appel). Limite observée : le critère « mêmes faits » n’est pas garanti au hash près entre niveaux dans ce run — ancrage audio (`source_id` + `source_content_hash`) commun, mais hashes de faits non unifiés. À traiter hors 5A si exigence stricte.

### Borne ≤ 6 items

- A1/A2/B2 : respectée.  
- **B1 = 7 items** : dépassement de la borne préflight — noté limite / dette pédagogique, pas de correctif générateur dans 5A.

---

## Liaison test

| Type | ID | Détail |
|---|---|---|
| **Devoir** | `1a3ee07d-409e-4fec-af41-0f750ccc80f5` | `source_label=lot05a-louise-pilote-A2`, exercice A2 `2e654590-…`, statut `en_attente` |
| Séance | — | Non créée (évite `group_id` / élèves réels) ; devoir suffit au gate 5A |

---

## Smoke élève temporaire

| Champ | Valeur |
|---|---|
| Formateur temp | `smoke.lot05a.formateur.…@captcf-smoke.test` — **banni** |
| Élève temp | `smoke.lot05a.eleve.…@captcf-smoke.test` — **banni** |
| MDP | non versionné (`.local-security-evidence/lot05a-louise-credentials.json`) |
| Preuves | `.local-security-evidence/lot05a-louise-evidence-latest.json` (gitignored) |
| `resolve-exercise-audio` | **200** — champ `audio_url` (pas `signed_url`) |
| Fetch MP3 | **200**, 1 476 404 o, SHA = local |
| Preview formateur | **200** |

---

## Appels / coûts observés (bornés)

| Appel Edge | Occurrences utiles (ordre de grandeur) |
|---|---|
| `hash-pedagogical-source` | 1 |
| `transcribe-pedagogical-source` | 1 (Gemini STT) |
| `analyze-pedagogical-source` | 1 (LLM) |
| `generate-differentiation-family` | ≥4 (+ retries / force A2 / B2 stuck) |
| `publish-differentiation-family` | 4 (A1, A2, B1, B2) |
| `resolve-exercise-audio` | 2 (devoir + preview) |

**Secrets / deploy :** aucun secret nouveau ; aucun deploy Edge supplémentaire. `GEMINI_API_KEY` déjà configuré ; Edges pipeline déjà ACTIVE.

---

## Limites / incidents

1. **Timeouts client** (`fetch failed` / socket closed) sur génération longue — retries nécessaires.  
2. **A2 v1** : validation auto `failed` (`DIFF_NO_CORRECT_ANSWER` items 1 et 4) → force regenerate.  
3. **B2** : ligne `generating` bloquée → abort + republish d’une famille `passed_with_warnings` précédemment archivée.  
4. **`facts_hash` non partagé** entre niveaux.  
5. **B1 = 7 items** > borne 6.  
6. Exercice A2 : clé `script_audio` présente dans `contenu` côté row exercice (attendu publication) ; sanitization séance non rejouée ici (smoke via devoir + `resolve-exercise-audio` uniquement).  
7. Scripts pilote uniquement dans `.local-security-evidence/` (gitignored) — pas de changement applicatif productif requis pour ce run.

---

## Hors périmètre (respecté)

- Pas de migration schéma  
- Pas de changement ADR / provider STT  
- Pas de bibliothèque dialogues  
- Pas de backfill anciens exercices  
- Pas de génération sur d’autres MP3  

---

## Prochaine autorisation

> **J’autorise le merge (et éventuellement la promotion prod) du Lot 5A** sur `main` / environnement cible — **ou** un lot correctif borné (unifier `facts_hash`, plafonner items ≤ 6, parcours séance curriculum) **avant** merge.

Sans nouvelle phrase propriétaire : **pas de merge `main`**, pas d’élargissement corpus audio.

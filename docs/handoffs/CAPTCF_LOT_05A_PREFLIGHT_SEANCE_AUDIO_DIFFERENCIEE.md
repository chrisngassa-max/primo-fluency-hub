# CAPTCF — LOT 5A — Préflight « séance audio différenciée pilote »

**Date :** 2026-09-26  
**Nature :** préflight documentaire uniquement — **aucun développement**, **aucun appel payant**, **aucune migration**, **aucun déploiement**, **aucune génération massive**.  
**Dépôt :** `D:\sites\tcf pro` (primo-fluency-hub)  
**Projet prod de référence :** Supabase `gudcenhmzlcvhgbgklzw`  
**Parent plan :** `docs/handoffs/CAPTCF_PLAN_LOTS_BORNES_ACCES_REPRODUCTIBILITE.md` § LOT 5-AUDIO-STT (après noyau) — ce sous-lot **5A** borne un pilote séance, pas le benchmark STT ni la biblio complète.

---

## 1. Diagnostic court

### 1.1 Parcours existant (import → publication)

Chaîne déjà présente dans le code / handoffs A2 + multilevel (PR #27 / #32 / lot2) :

```text
Formateur : PedagogicalSourcesPage
  → import MP3 (Storage + pedagogical_sources)
  → hash-pedagogical-source (SHA-256 serveur, idempotent)
  → transcribe-pedagogical-source (Gemini full-file V1 provisoire)
  → revue humaine (reviewed_text + segments ; status=reviewed obligatoire)
  → analyze-pedagogical-source (chunks pédagogiques)
  → generate-differentiation-family (1 appel / target_level A1|A2|B1|B2 ;
       faits extraits + facts_hash ; variantes grounded sur les mêmes faits)
  → revue humaine famille (draft → in_review → validated)
  → publish-differentiation-family
       → exercice avec contenu.audio { source_id, source_content_hash, mime_type }
Apprenant :
  → séance (session_exercices) / devoir / play_token / preview
  → resolve-exercise-audio (triple hash, URL signée courte)
  → CoAudioPlayer = MP3 original (pas TTS de la transcription)
```

Références : `captcf-a2-audio-status-and-next-steps.md`, `captcf-lot2-audio-original-apprenant.md`, `captcf-v1-gemini-provisional-transcription.md`, `ADR-001-stt-provider.md`, `src/lib/differentiationFamilies.ts`, Edge `hash|transcribe|analyze|generate|publish-differentiation-*` + `resolve-exercise-audio`.

### 1.2 Ce qui fonctionne réellement vs incomplet

| Zone | État | Preuve / note |
|---|---|---|
| Import MP3 + hash serveur | **Opérationnel** (slice A2) | Edge `hash-pedagogical-source` ; UI import |
| Transcription Gemini provisoire | **Opérationnel mais provisoire** | Handoff Gemini V1 ; timestamps `unverified` |
| Revue humaine transcription | **Opérationnel** | UI `SourceTranscriptionActions` ; gate `REVIEWED_TRANSCRIPTION_REQUIRED` |
| Analyse + chunks | **Opérationnel** | Edge `analyze-pedagogical-source` |
| Génération A1–B2 grounded | **Opérationnel en code** | `target_level` + `generateDifferentiationFamiliesForLevels` (séquentiel) ; PR #32 |
| Publication gardée + MP3 apprenant | **Opérationnel en code** | Lot2 `contenu.audio` + `resolve-exercise-audio` |
| E2E authentifié historique | **Documenté une fois** | Fixture `a2-sample-jeu-cropolis.mp3` (rapport A2) — pas rejoué dans ce préflight |
| Décision STT multi-providers | **Incomplet / bloqué** | ADR-001 status *blocked* |
| Bibliothèque dialogues (spec 2026-07-28) | **Non livrée** | Spec brouillon ; hors 5A |
| Backfill anciens exercices sans `contenu.audio` | **Non démarré** | `captcf-lot2-backfill-anciens-exercices.md` |
| Transcription 100 % manuelle sans IA | **Incomplet** | Relecture/édition après run STT OK ; **pas** de seed manuel sans appel Edge si STT échoue avant toute ligne |
| « Une séance curriculum » liant 4 variantes + devoir + progression | **Partiel** | Publication → exercice ; liaison `session_exercices` / devoirs existants mais **pas** de parcours produit « séance audio différenciée pilote » borné et recetté |
| Recette pédagogique multi-audios | **Partiel** | Un E2E historique ≠ validation pédagogique large |

### 1.3 Audio pilote autorisé (UN seul)

| Champ | Valeur |
|---|---|
| **Chemin** | `docs/fichiers oral/A2/louise_musique_et_ville.mp3` |
| **Pourquoi** | Dossier A2 (aligné slice CO) ; fichier parmi les plus légers du corpus local (~1,4 Mo) ; thème quotidien TCF (musique / ville) ; **ne pas** versionner ni copier le binaire dans une autre arborescence |
| **Hors-pilote** | Tous les autres MP3 de `docs/fichiers oral/` et fixtures synthétiques `FAKE-MP3::` |

### 1.4 Séance précise (pilote)

**Une ligne :** séance CO TCF pilote « Louise — musique et ville », support unique A2, 4 variantes A1/A2/B1/B2 sur les **mêmes faits** du dialogue, ≤ 6 items / niveau, ~15 min apprenant, 1 seul MP3.

| Paramètre | Borne |
|---|---|
| Objectif TCF | Compréhension orale — repérer faits explicites d’un dialogue authentique |
| Niveau support | A2 (transformation IDENTITY) ; A1/B1/B2 via `A2_TO_*` |
| Durée cible apprenant | ≤ 15 min (écoute + QCM) |
| Quantité max | **1** source audio ; **≤ 4** familles (1/niveau) ; **≤ 6** items/niveau ; **pas** de génération hors ces niveaux |
| Compétence | `CO` uniquement |

### 1.5 Variantes A1/A2/B1/B2 (mêmes faits)

- Extraction de faits une fois (chunks + segments revue) → `facts` + `facts_hash`.  
- Chaque `target_level` produit une variante d’exercice **ancrée** sur ces faits (`fact_refs` sur items) ; A2 = IDENTITY, autres = règles de transformation référentiel CO.  
- Interdit en 5A : inventer des faits hors dialogue ; publier un niveau sans validation humaine ; lancer 4 générations parallèles non bornées (conserver orchestration séquentielle / concurrence ≤ 2 déjà dans le client).

### 1.6 Chemin séance → devoir → réponse → correction → progression

```text
1. Publish famille(s) validée(s) → row(s) exercices (+ contenu.audio)
2. Formateur lie exercice(s) à une séance via session_exercices
   (et/ou crée un devoir pointant le même exercice)
3. Envoi élèves (Dashboard formateur / flux devoir existant)
4. Élève : SeanceApprenant ou DevoirPassation → CoAudioPlayer
   → resolve-exercise-audio (auth contextuelle) → réponses
5. Correction / feedback : mécaniques devoir existantes
   (ex. devoir_feedback) + suivi session_exercices / resultats
6. Progression : agrégats monitoring / tracking séance déjà en place
   — 5A ne crée pas un nouveau moteur de progression
```

**Gate produit 5A :** au moins **un** niveau (recommandé A2) publié + jouable en séance **ou** devoir avec MP3 original ; idéal = les 4 niveaux publiés et testés, mais le critère minimal est A2 + preuve d’au moins une variante différenciée (A1 ou B1).

### 1.7 Validation humaine avant publication

Obligatoire, déjà câblée :

1. Transcription `status = reviewed` (pas seulement `ready`).  
2. Source `status = analyzed` et `review_status ∈ {utilisable, valide}`.  
3. Famille : validation auto non `failed` + `review_status = validated` avant publish.  
4. Timestamps `unverified` : avertissement OK si règles Gemini V1 ; **pas** de seek « preuve certaine » côté UI.  
5. Aucune publication si hash manquant / source stale / MP3 absent.

### 1.8 Fonctionnement manuel si transcription ou IA échoue

| Échec | Conduite 5A (sans nouveau code dans ce préflight) |
|---|---|
| STT Gemini échoue | **Stop chaîne** ; toast erreur ; pas de publish. Contournement actuel = **réécouter le MP3** + **réessayer** (`force`) ; seed manuel sans Edge = **écart connu** (hors scope minimal 5A sauf autorisation explicite). |
| Transcription prête mais incorrecte | Éditer `reviewed_text` / segments dans l’UI → re-valider revue → ré-analyser si besoin. |
| Génération famille échoue / `failed` | Feedback famille + régénération **un niveau à la fois** ; ne pas forcer une famille déjà `published`. |
| Analyse / chunks manquants | Relancer `analyze-pedagogical-source` après transcription revue. |
| Audio apprenant indisponible | Message explicite (anciens exercices sans `contenu.audio`) ; **pas** de fallback TTS sur original référencé. |

---

## 2. Plan d’implémentation par étapes (après autorisation)

> Ordre strict. Chaque étape = une autorisation possible de stop/go. **Pas** d’appel payant ni deploy dans le préflight.

| # | Étape | Livrable | Hors-périmètre |
|---|---|---|---|
| 0 | Ce préflight (fait) | Present document | Code, secrets, remote |
| 1 | Branche dédiée `captcf-lot-05a-seance-audio-pilote` depuis `main` à jour | Branche vide fonctionnellement ou docs-only d’abord | Autres lots audio/STT |
| 2 | Import **manuel** du seul MP3 pilote (UI formateur) + hash | `source_id` + `content_hash` notés en evidence gitignored | Commit du binaire MP3 |
| 3 | Transcription + **revue humaine** + analyse | Source `analyzed` + transcription `reviewed` | Changer de provider STT |
| 4 | Génération bornée A2 puis A1/B1/B2 (séquentiel) | 1–4 familles ; mêmes `facts_hash` | Génération massive / autres audios |
| 5 | Revue humaine + publish **niveau par niveau** (A2 d’abord) | `published_exercise_id` + `contenu.audio` | Backfill legacy |
| 6 | Liaison séance pilote + smoke élève (1 compte test) | Preuve écoute MP3 + réponse + feedback | Prod élèves réels |
| 7 | Handoff clôture 5A (OK/KO + RA) | Doc daté | Biblio dialogues ; ADR STT |

---

## 3. Critères minimaux de réussite (séance pilote)

1. **Un seul** audio : `docs/fichiers oral/A2/louise_musique_et_ville.mp3` (référence chemin ; import Storage, pas copie git).  
2. Au moins la variante **A2** publiée avec `contenu.audio` cohérent (triple hash).  
3. Au moins **une** autre variante (A1 ou B1) générée et validée humaine, **mêmes faits** (même `facts_hash` / provenance).  
4. Élève test entend le **MP3 original** (pas TTS) en séance **ou** devoir.  
5. Aucune fuite `script_audio` dans le payload séance sanitizé.  
6. Zéro autre MP3 traité ; zéro migration schéma ; zéro changement provider STT.  
7. Evidence smoke dans `.local-security-evidence/` (gitignored) — pas de secrets dans git.

---

## 4. Prochaine autorisation exacte (pour démarrer le développement 5A)

Phrase à coller par le propriétaire :

> **J’autorise le Lot 5A — séance audio différenciée pilote :** branche dédiée depuis `main`, import/hash/transcription/revue/analyse/génération bornée A1–B2 et publication **uniquement** pour la source issue de `docs/fichiers oral/A2/louise_musique_et_ville.mp3`, liaison à **une** séance ou devoir de test, smoke élève temporaire, **sans** migration schéma, **sans** changement ADR/STT, **sans** bibliothèque dialogues, **sans** backfill d’anciens exercices, **sans** génération sur d’autres MP3. Les appels Gemini/STT restent **bornés** à ce pilote et soumis à confirmation avant tout secret/deploy supplémentaire sur `gudcenhmzlcvhgbgklzw`.

Sans cette phrase : **aucun** développement 5A.

---

## 5. Confirmations préflight

| Contrôle | État |
|---|---|
| Appels payants (STT/LLM) dans cette mission | **0** |
| Migrations | **0** |
| Déploiements applicatifs | **0** |
| Copie de gros binaires MP3 dans le dépôt | **0** (chemin cité seulement) |

# CapTCF — Lot 5B-B — Studio audio guidé

**Date :** 2026-09-29  
**Nature :** lot local — UI + orchestration front ; aucun push, PR, déploiement, migration ni mutation distante  
**Dépôt :** `D:\SITES\CAPTCF`  
**Branche :** `captcf-lot-05b-b-studio-audio-guide`  
**HEAD (feat) :** `fad3103a378cad350e428b976ad64e117abd60fe`  
**Base :** `origin/main` @ `0f6eaed8` (PR #43 présente)  
**Projet Supabase :** `gudcenhmzlcvhgbgklzw` (non muté dans ce lot)

## Route

| Route | Rôle |
| --- | --- |
| `/formateur/studio-audio` | Accueil Studio : import MP3 audio + reprise d’une source existante |
| `/formateur/studio-audio/:sourceId` | Wizard 8 étapes branché sur l’état serveur |
| `/formateur/sources-pedagogiques` | Hub existant **conservé** (pas de doublon métier) |

Menu formateur : entrée **« Studio audio »** (`FormateurSidebar`) à côté de Sources pédagogiques.

## Composants / libs réutilisés

- `SourceTranscriptionActions` (variant `inline`)
- `SourceAnalysisActions` (étape 3, analyse chunks)
- `SourceDifferentiationFamilyActions` (variant `inline` + gates génération / publication)
- Libs : `pedagogicalSources`, `pedagogicalSourceTranscriptions`, `pedagogicalSourceAnalysis`, `differentiationFamilies`
- Edges **inchangées** : `hash-pedagogical-source`, `transcribe-pedagogical-source`, `analyze-pedagogical-source`, `generate-differentiation-family`, `publish-differentiation-family`
- Rattachement séance : même table `session_exercices` / pattern SessionPilot via `studioAudioSessionLink.ts` (contrôle `groups.formateur_id`)

Nouveaux fichiers d’orchestration (sans dupliquer la logique métier Edge) :

- `src/lib/studioAudioWorkflow.ts`
- `src/lib/studioAudioSessionLink.ts`
- `src/components/studio-audio/*`
- `src/pages/formateur/StudioAudioPage.tsx`
- `src/pages/formateur/StudioAudioWizardPage.tsx`

## Huit étapes — fonctionnement

| # | Étape | Reliée à | État réel |
| --- | --- | --- | --- |
| 1 | Importer l’audio | `createPedagogicalSource` + `hash-pedagogical-source` | **Opérationnel** (UI Studio audio-only) |
| 2 | Métadonnées / droits | `updatePedagogicalSourceFields` | **Opérationnel** |
| 3 | Transcrire + relire (+ analyse) | Edges STT / analyze existantes | **Opérationnel** (appel Edge réel si lancé ; **non exécuté** dans ce lot local) |
| 4 | Confirmer les faits | Affiche faits + `facts_hash` issus des familles ; confirmation dans `pedagogical_sources.metadata.studio_facts_confirmation` | **Opérationnel** côté UI/stockage metadata ; bootstrap A2 si aucun fait |
| 5 | Choisir A1–B2 + générer | `generate-differentiation-family` + gate multilevel | **Relié** ; **bloqué sans confirmation** si faits absents / non confirmés / hash divergents ; A2 seul autorisé pour amorcer les faits |
| 6 | Relire les variantes | même composant familles (revue / feedback) | **Opérationnel** |
| 7 | Valider et publier | `publish-differentiation-family` ; publication refusée si non `validated` ou > 6 items | **Opérationnel** |
| 8 | Ajouter à une séance | `session_exercices` idempotent + refus séance non gérée | **Opérationnel** (mutation distante **non lancée** en Phase A locale) |

Barre d’étapes : terminée / courante / disponible / bloquée + raison + action suivante recommandée. Reprise au refresh via données serveur + `recommendedStep`.

## Ce qui reste simulé / bloqué / hors lot

- Aucun appel Gemini / STT / génération payante pendant ce lot.
- Aucun nouvel import MP3 réel traité ici (fichiers oraux locaux préservés non commités).
- Confirmation des faits : **pas de nouvelle table** — JSON `metadata` existant. Si une migration était un jour souhaitée pour une colonne dédiée, ce n’est **pas** requis aujourd’hui.
- STT reste le pipeline provisoire Gemini déjà en place.
- Double statut exercice `draft` vs famille `published` (Louise) : hors périmètre, non corrigé.

## Migration nécessaire

**Non.** Confirmation des faits persistée dans `pedagogical_sources.metadata.studio_facts_confirmation`.

### Si une colonne dédiée était exigée plus tard (non appliqué)

```sql
-- AVANT (proposé seulement)
alter table public.pedagogical_sources
  add column if not exists studio_facts_confirmation jsonb;

-- RETOUR ARRIÈRE
alter table public.pedagogical_sources
  drop column if exists studio_facts_confirmation;
```

## Edge Functions modifiées

**Non.** Aucun déploiement Edge.

## Tests exécutés

```text
npm test -- src/test/studio-audio-guided-workflow.test.tsx \
  src/test/studio-audio-session-link.test.ts \
  src/test/differentiationFamilies-multilevel.test.ts \
  src/test/pedagogical-source-guards.test.ts
→ 27 passed

npm run build → OK
git diff --check → OK
```

Couverture ciblée : 8 étapes, reprise, blocages transcription/faits/confirmation, hash divergents, sélection A1–B2, plafond 6 items, publication avant validation, rattachement / idempotence / séance non autorisée, erreurs lisibles, a11y barre d’étapes.

## Limites connues

- L’analyse (chunks) reste un sous-bloc de l’étape 3 (pas une 9ᵉ étape).
- La génération multilevel réelle consommera Gemini en Phase B.
- Pas de drag-and-drop MP3 (input file, comme le hub sources).
- Le Studio compose les composants existants ; le hub Sources pédagogiques reste utilisable en parallèle.

## Procédure de recette Phase B (manuel, hors ce lot)

1. Formateur connecté → menu **Studio audio**.
2. Reprendre Louise (`4a0e8321-…`) **sans** réimporter de MP3.
3. Vérifier reprise d’étape, faits + `facts_hash` commun, confirmation metadata.
4. Générer uniquement les niveaux manquants si besoin (pas de force regenerate inutile).
5. Valider → publier → « Ajouter à une séance » sur une séance **du formateur**.
6. Vérifier idempotence (second clic → déjà présent).
7. Tenter une séance d’un autre formateur → refus.
8. Aucun `service_role` côté navigateur.

## Retour arrière proposé

```bash
git checkout main
git branch -D captcf-lot-05b-b-studio-audio-guide
# ou revert des commits feat/docs sur la branche
```

Fichiers non suivis à préserver : `docs/fichiers oral/`, `supabase/.temp/`, `.local-security-evidence/`, audit `CAPTCF_AUDIT_STUDIO_AUDIO_EXISTANT.md` s’il reste local.

## Confirmation Phase A

- aucun push  
- aucune PR / merge  
- aucun déploiement Vercel / Edge  
- aucune migration appliquée  
- aucune mutation Supabase distante  
- aucun appel payant Gemini  
- aucun traitement d’un nouveau MP3  

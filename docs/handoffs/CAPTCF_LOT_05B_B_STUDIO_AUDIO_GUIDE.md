# CapTCF â€” Lot 5B-B â€” Studio audio guidÃ©

**Date :** 2026-09-29
**Nature :** lot local â€” UI + orchestration front ; aucun push, PR, dÃ©ploiement, migration ni mutation distante
**DÃ©pÃ´t :** `D:\SITES\CAPTCF`
**Branche :** `captcf-lot-05b-b-studio-audio-guide`
**HEAD (feat) :** `fad3103a378cad350e428b976ad64e117abd60fe`
**Base :** `origin/main` @ `0f6eaed8` (PR #43 prÃ©sente)
**Projet Supabase :** `gudcenhmzlcvhgbgklzw` (non mutÃ© dans ce lot)

## Route

| Route | RÃ´le |
| --- | --- |
| `/formateur/studio-audio` | Accueil Studio : import MP3 audio + reprise dâ€™une source existante |
| `/formateur/studio-audio/:sourceId` | Wizard 8 Ã©tapes branchÃ© sur lâ€™Ã©tat serveur |
| `/formateur/sources-pedagogiques` | Hub existant **conservÃ©** (pas de doublon mÃ©tier) |

Menu formateur : entrÃ©e **Â« Studio audio Â»** (`FormateurSidebar`) Ã  cÃ´tÃ© de Sources pÃ©dagogiques.

## Composants / libs rÃ©utilisÃ©s

- `SourceTranscriptionActions` (variant `inline`)
- `SourceAnalysisActions` (Ã©tape 3, analyse chunks)
- `SourceDifferentiationFamilyActions` (variant `inline` + gates gÃ©nÃ©ration / publication)
- Libs : `pedagogicalSources`, `pedagogicalSourceTranscriptions`, `pedagogicalSourceAnalysis`, `differentiationFamilies`
- Edges **inchangÃ©es** : `hash-pedagogical-source`, `transcribe-pedagogical-source`, `analyze-pedagogical-source`, `generate-differentiation-family`, `publish-differentiation-family`
- Rattachement sÃ©ance : mÃªme table `session_exercices` / pattern SessionPilot via `studioAudioSessionLink.ts` (contrÃ´le `groups.formateur_id`)

Nouveaux fichiers dâ€™orchestration (sans dupliquer la logique mÃ©tier Edge) :

- `src/lib/studioAudioWorkflow.ts`
- `src/lib/studioAudioSessionLink.ts`
- `src/components/studio-audio/*`
- `src/pages/formateur/StudioAudioPage.tsx`
- `src/pages/formateur/StudioAudioWizardPage.tsx`

## Huit Ã©tapes â€” fonctionnement

| # | Ã‰tape | ReliÃ©e Ã  | Ã‰tat rÃ©el |
| --- | --- | --- | --- |
| 1 | Importer lâ€™audio | `createPedagogicalSource` + `hash-pedagogical-source` | **OpÃ©rationnel** (UI Studio audio-only) |
| 2 | MÃ©tadonnÃ©es / droits | `updatePedagogicalSourceFields` | **OpÃ©rationnel** |
| 3 | Transcrire + relire (+ analyse) | Edges STT / analyze existantes | **OpÃ©rationnel** (appel Edge rÃ©el si lancÃ© ; **non exÃ©cutÃ©** dans ce lot local) |
| 4 | Confirmer les faits | Affiche faits + `facts_hash` issus des familles ; confirmation dans `pedagogical_sources.metadata.studio_facts_confirmation` | **OpÃ©rationnel** cÃ´tÃ© UI/stockage metadata ; bootstrap A2 si aucun fait |
| 5 | Choisir A1â€“B2 + gÃ©nÃ©rer | `generate-differentiation-family` + gate multilevel | **ReliÃ©** ; **bloquÃ© sans confirmation** si faits absents / non confirmÃ©s / hash divergents ; A2 seul autorisÃ© pour amorcer les faits |
| 6 | Relire les variantes | mÃªme composant familles (revue / feedback) | **OpÃ©rationnel** |
| 7 | Valider et publier | `publish-differentiation-family` ; publication refusÃ©e si non `validated` ou > 6 items | **OpÃ©rationnel** |
| 8 | Ajouter Ã  une sÃ©ance | `session_exercices` idempotent + refus sÃ©ance non gÃ©rÃ©e | **OpÃ©rationnel** (mutation distante **non lancÃ©e** en Phase A locale) |

Barre dâ€™Ã©tapes : terminÃ©e / courante / disponible / bloquÃ©e + raison + action suivante recommandÃ©e. Reprise au refresh via donnÃ©es serveur + `recommendedStep`.

## Ce qui reste simulÃ© / bloquÃ© / hors lot

- Aucun appel Gemini / STT / gÃ©nÃ©ration payante pendant ce lot.
- Aucun nouvel import MP3 rÃ©el traitÃ© ici (fichiers oraux locaux prÃ©servÃ©s non commitÃ©s).
- Confirmation des faits : **pas de nouvelle table** â€” JSON `metadata` existant. Si une migration Ã©tait un jour souhaitÃ©e pour une colonne dÃ©diÃ©e, ce nâ€™est **pas** requis aujourdâ€™hui.
- STT reste le pipeline provisoire Gemini dÃ©jÃ  en place.
- Double statut exercice `draft` vs famille `published` (Louise) : hors pÃ©rimÃ¨tre, non corrigÃ©.

## Migration nÃ©cessaire

**Non.** Confirmation des faits persistÃ©e dans `pedagogical_sources.metadata.studio_facts_confirmation`.

### Si une colonne dÃ©diÃ©e Ã©tait exigÃ©e plus tard (non appliquÃ©)

```sql
-- AVANT (proposÃ© seulement)
alter table public.pedagogical_sources
  add column if not exists studio_facts_confirmation jsonb;

-- RETOUR ARRIÃˆRE
alter table public.pedagogical_sources
  drop column if exists studio_facts_confirmation;
```

## Edge Functions modifiÃ©es

**Non.** Aucun dÃ©ploiement Edge.

## Tests exÃ©cutÃ©s

```text
npm test -- src/test/studio-audio-guided-workflow.test.tsx \
  src/test/studio-audio-session-link.test.ts \
  src/test/differentiationFamilies-multilevel.test.ts \
  src/test/pedagogical-source-guards.test.ts
â†’ 27 passed

npm run build â†’ OK
git diff --check â†’ OK
```

Couverture ciblÃ©e : 8 Ã©tapes, reprise, blocages transcription/faits/confirmation, hash divergents, sÃ©lection A1â€“B2, plafond 6 items, publication avant validation, rattachement / idempotence / sÃ©ance non autorisÃ©e, erreurs lisibles, a11y barre dâ€™Ã©tapes.

## Limites connues

- Lâ€™analyse (chunks) reste un sous-bloc de lâ€™Ã©tape 3 (pas une 9áµ‰ Ã©tape).
- La gÃ©nÃ©ration multilevel rÃ©elle consommera Gemini en Phase B.
- Pas de drag-and-drop MP3 (input file, comme le hub sources).
- Le Studio compose les composants existants ; le hub Sources pÃ©dagogiques reste utilisable en parallÃ¨le.

## ProcÃ©dure de recette Phase B (manuel, hors ce lot)

1. Formateur connectÃ© â†’ menu **Studio audio**.
2. Reprendre Louise (`4a0e8321-â€¦`) **sans** rÃ©importer de MP3.
3. VÃ©rifier reprise dâ€™Ã©tape, faits + `facts_hash` commun, confirmation metadata.
4. GÃ©nÃ©rer uniquement les niveaux manquants si besoin (pas de force regenerate inutile).
5. Valider â†’ publier â†’ Â« Ajouter Ã  une sÃ©ance Â» sur une sÃ©ance **du formateur**.
6. VÃ©rifier idempotence (second clic â†’ dÃ©jÃ  prÃ©sent).
7. Tenter une sÃ©ance dâ€™un autre formateur â†’ refus.
8. Aucun `service_role` cÃ´tÃ© navigateur.

## Retour arriÃ¨re proposÃ©

```bash
git checkout main
git branch -D captcf-lot-05b-b-studio-audio-guide
# ou revert des commits feat/docs sur la branche
```

Fichiers non suivis Ã  prÃ©server : `docs/fichiers oral/`, `supabase/.temp/`, `.local-security-evidence/`, audit `CAPTCF_AUDIT_STUDIO_AUDIO_EXISTANT.md` sâ€™il reste local.

## Confirmation Phase A

- aucun push
- aucune PR / merge
- aucun dÃ©ploiement Vercel / Edge
- aucune migration appliquÃ©e
- aucune mutation Supabase distante
- aucun appel payant Gemini
- aucun traitement dâ€™un nouveau MP3

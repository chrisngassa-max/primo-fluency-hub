# CapTCF — Lot 5B-B Phase B — Publication et recette Studio audio

**Date :** 2026-09-29  
**Nature :** publication Git + recette production (Louise uniquement)  
**Dépôt :** `D:\SITES\CAPTCF`  
**Branche source :** `captcf-lot-05b-b-studio-audio-guide`  
**Projet Supabase :** `gudcenhmzlcvhgbgklzw` (aucune migration / Edge déployée)

## Publication

| Élément | Valeur |
| --- | --- |
| PR | https://github.com/chrisngassa-max/primo-fluency-hub/pull/44 |
| État PR | **MERGED** |
| SHA branch tip poussé | `1f7acf79` (feat `fad3103a` + docs `991b237a` + trim whitespace) |
| SHA merge `main` | `9e571cc065d34778f4c8ae3fdc8046f171c5f747` |
| Ancien SHA frontend (`main`) | `0f6eaed82bfe5bd529d4692a2504f22fd3774d57` |
| Nouveau SHA frontend | `9e571cc065d34778f4c8ae3fdc8046f171c5f747` |
| Rollback frontend | redéployer / promouvoir `0f6eaed8` (candidat Vercel `dpl_GqXeC2yp5yn2C7jBS5JWHzZc2mg5`) |

### Vercel

| Déploiement | État | SHA | Alias |
| --- | --- | --- | --- |
| Preview PR | READY | `1f7acf79` | `primo-fluency-hub-git-captcf-lot-05b-b-studio-audio-guide-meme3.vercel.app` |
| Production | **READY** | `9e571cc0` | `captcf.fr`, `www.captcf.fr`, `primo-fluency-hub.vercel.app` |
| Production id | `dpl_D9r8CasuMJjhLLkpC3G6ik1j6c8j` | | |

Bundle prod observé : `/assets/index-CRuN28lZ.js` contient `Studio audio`, les libellés d’étapes et `facts_hash`.

### CI

- `test-build-lint` : **pass**
- Vercel preview : **pass**
- Périmètre PR : Studio uniquement (15 fichiers) — pas de migration, pas d’Edge

## Tests locaux avant push

```text
npm test -- studio-audio-guided-workflow + studio-audio-session-link
          + differentiationFamilies-multilevel + pedagogical-source-guards
→ 27 passed
npm run build → PASS
git diff --check origin/main...HEAD → PASS (après trim whitespace docs)
```

## Revue sécurité ciblée (résumé)

- Routes Studio sous `ProtectedRoute requiredRole="formateur"`.
- Faits : fusion `metadata` via `mergeStudioFactsConfirmation` (spread des métadonnées existantes).
- Génération multilevel : `assertGenerationAllowed` refuse faits absents / non confirmés / `facts_hash` divergents.
- Séance : `assertSessionManagedByFormateur` via `groups.formateur_id` (pas de confiance navigateur).
- Idempotence attach : lecture préalable `session_exercices` avant insert.
- Pas de `service_role` dans le front Studio ; pas de secrets journalisés.

## Recette production — Louise

**Source :** `4a0e8321-9ece-42d7-bf76-8825b1e65e79` — *LOT5A Pilote — Louise musique et ville*

| Contrôle | Résultat |
| --- | --- |
| Routes HashRouter | `/#/formateur/studio-audio` et `/#/formateur/studio-audio/:sourceId` |
| Accès non authentifié | écran login formateur / redirection hors Studio (garde formateur) |
| Bundle Studio en prod | oui |
| Source Louise | `analyzed` / `utilisable` / audio |
| Transcription | `reviewed` (existante) — **STT non relancé** |
| Faits | 29 faits ; `facts_hash` = `sha256:4fd8d5565ba8cedeb8fa0d9bbf20451dece02b4c83157f4303433398ba03f5a5` (commun A1–B2 publiés) |
| Variantes publiées | A1, A2, B1, B2 (exercice IDs inchangés) |
| Génération / publish / STT / Gemini | **0** (non déclenchés ; aucun nouvel import MP3) |
| UI 8 étapes authentifiée | **partielle** — login formateur requis ; pas de mot de passe de recette disponible dans ce run (compte smoke existant non réinitialisé / non banni) |

### Huit étapes — verdict data / produit

| # | Verdict |
| --- | --- |
| 1 Import | reprise sans nouvel import — **OK** |
| 2 Droits | `rights_status=internal_pilot` présent — **OK** |
| 3 Transcription | `reviewed` sans nouvel appel — **OK** |
| 4 Faits | hash commun visible en base ; confirmation `metadata.studio_facts_confirmation` encore `null` (non forcée en Phase B) — **OK lecture** |
| 5 Génération | non lancée (interdit) — **OK** |
| 6 Relecture | familles publiées présentes — **OK** |
| 7 Publication | déjà publiées ; non republicées — **OK** |
| 8 Séance | recette rattachement ci-dessous — **OK** |

## Recette rattachement séance

Opération **serveur** (même contrats que `studioAudioSessionLink`) sous le formateur owner Louise `346db213-…` :

1. Création groupe temporaire `LOT5BB-RECETTE-TMP` + séance `feb56af2-…`
2. Insertion de 4 `session_exercices` (A1→B2, ordres 1–4)
3. Rejeu logique idempotente : `already_present=4`, `would_insert=0`
4. Séance étrangère : `allowed=false` pour un autre `formateur_id`
5. **Nettoyage** : suppression des 4 liens + séance + groupe → compteurs à 0
6. Exercices Louise : inchangés (`statut=draft` côté banque, familles `published`)

Aucun compte temporaire nouveau créé → **pas de ban** (smoke Lot 5A conservé).

## Edge / migration

- Edge modifiée : **aucune**
- Migration : **aucune**
- Déploiement Edge : **aucun**

## Limites restantes

- Recette UI complète (barre d’étapes, clavier, mobile) nécessite une session formateur authentifiée ; non exécutée bout-en-bout dans le navigateur faute de credentials de recette.
- Pas d’unique DB sur `(session_id, exercice_id)` : l’idempotence repose sur la logique applicative (vérifiée).
- `studio_facts_confirmation` non renseignée sur Louise (optionnelle tant que lecture des faits familles suffit pour la reprise).
- Logs Edge ClickHouse indisponibles pendant la fenêtre (erreur backend query_logs) — absence d’appels payants garantie par non-déclenchement explicite + interdiction mission.

## Rollback

Frontend : revenir à `0f6eaed8` / déploiement production précédent `dpl_GqXeC2yp5yn2C7jBS5JWHzZc2mg5`.

## Confirmation

- Push + PR #44 + merge effectués  
- captcf.fr **READY** sur `9e571cc0`  
- 0 Gemini / STT / generate / publish pendant la recette  
- données temporaires nettoyées : **oui**  
- Edge / migration : **aucune**  

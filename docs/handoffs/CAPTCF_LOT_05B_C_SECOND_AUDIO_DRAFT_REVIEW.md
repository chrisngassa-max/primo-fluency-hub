# Lot 5B-C — Actualisation de la recette réelle du 29 septembre 2026

Cette actualisation remplace le verdict STOP AUTH du premier arrêt. La recette a réellement repris dans le navigateur interne après connexion manuelle du propriétaire. Le parcours demeure incomplet : arrêt à la première tentative de génération A2.

## Résultat actuel

- Session formateur : OK, Christian. Aucun identifiant ni mot de passe lu ou conservé.
- Source : `abddcf10-a426-4701-88eb-aaf05d9fc707`.
- Propriétaire de la source et relecteur de la transcription : `82acac8e-8add-4f62-9cfd-701989a82bd9` ; identité affichée dans la session : Christian.
- Statut source : `analyzed` ; revue source : `brouillon`.
- Droits : `internal_pilot` ; réutilisation élèves : false ; génération IA : true.
- Publication : non. Aucune séance, aucun devoir ni élève créé. Louise inchangée.
- Aucune modification de code, migration, policy, secret, déploiement, PR ou push.

## Préflight et import

- Dépôt `D:\SITES\CAPTCF`, branche `captcf-lot-05b-c-second-audio-pilot`, HEAD initial `0290d8b33a0fb1ff0049cb8f2b82186375f97a90`.
- Fichiers suivis propres au départ. Fichiers non suivis conservés : archive et dossier éclipse, MP3 voisin à la racine, `docs/fichiers oral/`, audit Studio existant et `supabase/.temp/linked-project.json`.
- MP3 unique : `20260812-b1-eclipse/20260812_b1_eclipse/rfi_b1_20260812_eclipse_audio.mp3`.
- Taille : 1 334 156 octets ; SHA-256 : `855D46C4125C3AC5C4978DCD67659D1ED81B253492BB92F77AAD197361B105CE`.
- Un import UI effectué, sans réimport. Hash enregistré : `sha256:855d46c4125c3ac5c4978dcd67659d1ed81b253492bb92f77aad197361b105ce`.
- Contrôle final normalisant le préfixe `sha256:` : exactement une source correspondante. Limite du préflight initial : sa recherche comparait le hash sans retirer ce préfixe ; le contrôle final corrige cette limite.
- Titre : Une éclipse visible en Europe. Note de licence interne RFI enregistrée, avec langue français, compréhension orale et niveau indicatif B1, faute de champs dédiés dans le formulaire d'import.
- Les cinq Edge Functions Studio contrôlées étaient ACTIVE et verify_jwt=true.

## Transcription et analyse

- Une transcription UI ; identifiant `d861a328-1d2a-4d0b-9c71-ed5829daf8e7`, tentative 1, Gemini 2.5 Flash, langue fr, 13 segments.
- Références locales consultées en lecture seule : transcription, fiche apprenant et corrigé PDF. Aucun de ces documents importé ou modifié.
- Texte complet comparé aux références. Corrections UI dans le texte global et les segments correspondants : Roquettes → Roquetes ; Elise Gazangel → Élise Gazengel ; Oui, ça devient → Voyez, ça devient ; qui vous regardez cet événement → qui vont regarder cet événement ; qu'un élément sociologique → qui est un élément sociologique.
- Relecture enregistrée via le bouton dédié ; statut persistant `reviewed`. Il s'agit de la transcription, aucune variante n'a été validée.
- Verdict textuel : contenu exploitable après corrections, négations, heure (vers 20 h), localisation et propos scientifiques conservés. Limite : aucune écoute indépendante effective par l'agent n'est attestée ; comparaison réalisée avec les documents de référence, et non certification acoustique.
- Durée MP3 mesurée par le pipeline : 113 976 ms. Dernier segment : 153 391 ms. Dérive : **+39 415 ms** ; `timestamp_status=unverified`. Ces repères ne sont pas précis et ne doivent pas servir à un découpage automatique. Aucun découpage effectué.
- Une analyse UI réalisée : 9 morceaux, modèle `text+google/gemini-2.5-flash`, niveau détecté B2 (référence RFI indicative B1).
- Morceaux consultés : résumé, description de l'éclipse, visibilité en Europe, Didier Queloz, émotion, vulgarisation scientifique, aspect sociologique, maximum vers 20 h, crédits. Pas de contradiction factuelle manifeste dans ces morceaux par rapport à la transcription corrigée ; ce ne sont pas des faits scellés.

## Génération A2 et blocage

Après autorisation explicite du propriétaire d'amorcer A2 avant la confirmation des faits :

1. A2 seul sélectionné ; A1/B1/B2 non sélectionnés.
2. Un clic sur « Générer les niveaux sélectionnés ».
3. Résultat UI : `A2 : error`.
4. Lecture seule de `differentiation_families` pour cette source : **zéro famille**.
5. Diagnostic du code Edge effectivement déployé (generate-differentiation-family v27) : le contrôle `getPedagogicalSourceReadinessError` précède toute génération/extraction ; source analyzed mais review_status=brouillon entraîne `SOURCE_REVIEW_NOT_APPROVED`.

Le code d'erreur détaillé n'a pas été capturé dans la réponse HTTP du navigateur ; le diagnostic est déduit du contrôle déployé et de l'état exact de la source en base. Les logs consultés n'ont pas fourni une réponse de génération détaillée exploitable.

**STOP avant confirmation ou extraction supplémentaire.** Aucun retry : blocage de prérequis déterministe, pas un échec transitoire justifiant une relance identique. Aucun passage automatique de la source à utilisable/valide.

| Niveau | Famille | Items | Statut |
| --- | --- | --- | --- |
| A1 | aucune | 0 | non lancé |
| A2 | aucune | 0 | tentative échouée avant création |
| B1 | aucune | 0 | non lancé |
| B2 | aucune | 0 | non lancé |

Faits extraits/scellés : aucun ; facts_hash : absent ; confirmation metadata : aucune. Aucun fait disponible à afficher ou à arbitrer. Audit item par item et comparaison inter-niveaux impossibles à ce stade ; aucune conclusion pédagogique sur des brouillons inexistants.

## Audit du parcours UI

- Session manuelle et accès direct Studio : OK.
- Menu formateur examiné : entrée Studio audio absente, malgré l'accès direct fonctionnel.
- Huit étapes visibles, états terminée/en cours/bloquée présents.
- Import, relecture et analyse persistants après rafraîchissement ; aucune perte de session constatée.
- Après analyse, l'écran restait imported et la génération bloquée jusqu'au rafraîchissement ; après rafraîchissement, analyzed et génération disponible.
- Étape faits : demande A2 seul avant de confirmer, contrairement à l'ordre initial de mission ; adaptation ensuite autorisée par le propriétaire.
- Génération proposée alors que la source est brouillon et sera refusée par le backend : prérequis de revue non expliqué dans ce parcours.
- Message d'échec persistant trop peu informatif : A2 : error.
- Mobile 390 px : texte et boutons lisibles, barre d'étapes défilant horizontalement ; contrôle partiel, pas une certification exhaustive.
- Clavier : fermeture de la fenêtre « Morceaux analysés » par Échap vérifiée. Parcours clavier complet non testé.
- Metadata conserve les informations d'import et d'analyse ; `transcription_review_requires_reanalysis=true` reste présent après analyse (anomalie à vérifier, non corrigée).

## Appels, coûts et décision

- 1 opération de transcription Gemini réussie ; 1 opération d'analyse Gemini réussie.
- 1 tentative UI de génération A2, refusée avant le chemin IA selon le contrôle déployé ; aucune extraction de faits ni génération de questions attestée.
- Aucun retry demandé par l'agent ; aucun nouvel appel pour A1/B1/B2.
- Nombre exact d'appels fournisseur internes et coût facturé non disponibles ; ne pas présenter un coût estimé inventé.
- Décision attendue du propriétaire : revue explicite de la source et éventuel passage à « utilisable » pour la recette interne, ou autorisation d'une correction du parcours dans une mission séparée. Aucun changement de statut ni correctif déployé dans ce lot.
- Prochaine reprise : même source, sans import/transcription/analyse supplémentaires ; contrôler d'abord le statut de revue et l'absence de famille pour éviter un doublon.

Le commit documentaire demandé conserve son intitulé prévu, mais ce compte rendu constate un **blocage**, pas une recette complète des quatre brouillons.


---

# Archive : premier arrêt avant connexion

# CapTCF — Lot 5B-C — Deuxième audio (éclipse) — revue brouillons

**Date :** 2026-09-29  
**Nature :** préflight + tentative de recette Studio E2E (arrêt avant import)  
**Dépôt :** `D:\SITES\CAPTCF`  
**Branche docs :** `captcf-lot-05b-c-second-audio-pilot`  
**Projet Supabase :** `gudcenhmzlcvhgbgklzw`  
**App :** https://captcf.fr  

**Point d’arrêt :** aucune mutation Studio (pas d’import, transcription, analyse, génération, publication).  
**Cause :** aucun compte formateur de recette sûr authentifiable dans ce run.

---

## 1. Préflight Git / prod

| Contrôle | Résultat |
| --- | --- |
| Branche locale | `captcf-lot-05b-c-second-audio-pilot` |
| HEAD | `c8b3752eea45009c953da88314ac7ab07d2fe5dc` |
| `origin/main` | même SHA `c8b3752e` |
| Fichiers suivis / non suivis | **préservés** (aucun commit hors handoff prévu ; dossier éclipse et archives restent non suivis) |
| Studio dans `main` | merge PR #44 `9e571cc065d34778f4c8ae3fdc8046f171c5f747` est **ancêtre** de HEAD |
| Prod Vercel (dernier déploiement production) | `dpl_AhV5ky35kiJb87rjXwoMpriCiyDT` — READY — SHA **`c8b3752e`** (docs Phase B PR #45) |
| Prod Studio code | présent via ancêtre `9e571cc0` (déploiement Studio dédié `dpl_D9r8CasuMJjhLLkpC3G6ik1j6c8j` toujours READY) |
| Écart vs mission « prod = 9e571cc0 » | prod pointe désormais sur **docs** `c8b3752e` ; le code Studio n’a pas été retiré |

Aucun push, PR, migration, Edge deploy, secret ou changement RLS dans ce lot.

---

## 2. Fichier audio pilote

| Champ | Valeur |
| --- | --- |
| Chemin | `D:\SITES\CAPTCF\20260812-b1-eclipse\20260812_b1_eclipse\rfi_b1_20260812_eclipse_audio.mp3` |
| `Test-Path` | **True** |
| Taille | **1 334 156** octets |
| Format | MP3 (MPEG audio) |
| Durée (parse frames local) | **≈ 113,98 s** (~1 min 54 s) |
| SHA-256 | `855D46C4125C3AC5C4978DCD67659D1ED81B253492BB92F77AAD197361B105CE` |
| Titre pédagogique prévu | Une éclipse visible en Europe |
| Niveau indicatif origine | B1 |
| Classification | **pilote interne** — diffusion publique non autorisée tant que les droits RFI ne sont pas confirmés |

### Inventaire lecture seule du dossier (inchangé)

| Fichier | Taille (o) | Rôle |
| --- | --- | --- |
| `rfi_b1_20260812_eclipse_audio.mp3` | 1 334 156 | audio pilote (seul autorisé) |
| `rfi_b1_20260812_eclipse_extrait1.mp3` | 248 492 | extrait — **non traité** |
| `rfi_b1_20260812_eclipse_extrait2.mp3` | 245 564 | extrait — **non traité** |
| `…_transcription.docx` / `.pdf` | 202 000 / 57 987 | référence humaine uniquement |
| `…_apprenant.docx` / `.pdf` | 278 986 / 4 096 486 | fiche apprenant — non importée |
| `…_corrige.doc` / `.pdf` | 301 568 / 4 074 596 | corrigé — référence uniquement |

Aucun déplacement, renommage, suppression ni commit de ce dossier.

### Doublon distant (hash)

Requête lecture seule `pedagogical_sources` sur le SHA-256 ci-dessus : **aucune ligne** → pas de source existante à reprendre ; un import Studio créerait une nouvelle source **si** un formateur authentifié était disponible.

---

## 3. Edge Functions Studio

| Function | Status | verify_jwt |
| --- | --- | --- |
| `hash-pedagogical-source` | ACTIVE v6 | **true** |
| `transcribe-pedagogical-source` | ACTIVE v14 | **true** |
| `analyze-pedagogical-source` | ACTIVE v7 | **true** |
| `generate-differentiation-family` | ACTIVE v27 | **true** |
| `publish-differentiation-family` | ACTIVE v16 | **true** |

`create-formateur-account` / `bootstrap-test-accounts` : ACTIVE, JWT true, stubs **410** (pas de création de compte via Edge).

---

## 4. Compte formateur / auth Studio

| Contrôle | Résultat |
| --- | --- |
| URL ouverte | https://captcf.fr/#/formateur/login |
| Deep-link sans hash `/formateur/studio-audio` | 404 Vercel (attendu — app en HashRouter) |
| Session formateur | **absente** — formulaire Email / Mot de passe |
| Compte smoke connu | `smoke.lot05a.formateur…@captcf-smoke.test` — **banni** (run antérieur) ; non réutilisé |
| Création compte | Edge stub 410 — non autorisée / non fonctionnelle |
| Contournement SQL / service_role / scripts | **interdit** par la mission et non tenté pour contourner le Studio |
| Mot de passe / secret | **aucun** lu, affiché ou conservé dans ce handoff |

**STOP AUTH :** la recette E2E Studio (import → … → brouillons A1–B2) ne peut pas démarrer sans connexion formateur réelle fournie par le propriétaire (Take Control navigateur ou compte de recette sûr non banni).

---

## 5. Huit étapes Studio — état

| # | Étape | Résultat |
| --- | --- | --- |
| 1 | Import audio | **non exécuté** (STOP AUTH) |
| 2 | Droits | **non exécuté** |
| 3 | Transcription | **non exécuté** — 0 appel STT |
| 4 | Analyse | **non exécuté** — 0 appel analyse |
| 5 | Faits communs | **non exécuté** |
| 6 | Génération multilevel | **non exécuté** — 0 génération |
| 7 | Relecture pédagogique | **non exécuté** |
| 8 | Publication / séance | **non exécuté** (interdit de toute façon) |

Contrôles UI partiels possibles sans auth : page login formateur ; pas de menu « Studio audio » ni barre d’étapes visibles hors session.

---

## 6. Résultats métier (vides — arrêt)

| Élément | Valeur |
| --- | --- |
| `source_id` | *aucune* (pas d’import ; pas de reprise) |
| `rights_status` | *non posé* (prévu : `internal_pilot`) |
| Transcription | *n/a* |
| Nombre de faits / `facts_hash` | *n/a* |
| Familles A1 / A2 / B1 / B2 | *aucune* |
| Items par niveau | *n/a* |
| Statut exercices | *n/a* — publication **non** |
| `session_exercices` / devoir / élève | **aucun** créé |
| Exercices Louise | **inchangés** |

### Audit pédagogique items

Non applicable — aucune génération.

---

## 7. Gemini / retries / coûts

| Métrique | Valeur |
| --- | --- |
| Appels Gemini | **0** |
| Opérations Gemini | aucune |
| Retries | **0** |
| Autre MP3 traité | **non** |
| Appel après point d’arrêt | **aucun** |
| Coût estimé | **0** |

---

## 8. Anomalie / défaut applicatif

| Type | Détail |
| --- | --- |
| Bloquant recette | Absence de compte formateur de recette sûr utilisable (smoke banni ; création Edge 410) |
| Routing | Accès hors hash `#` → 404 (comportement connu HashRouter ; deep-link correct = `/#/formateur/studio-audio`) |
| Contournement | Non appliqué (SQL / RPC / service_role / scripts manuels refusés pour remplacer le Studio) |
| Correctif minimal proposé | (1) Fournir une session formateur propriétaire via Take Control, **ou** (2) autoriser explicitement un compte de recette temporaire non banni + mot de passe jetable communiqué hors chat ; puis relancer uniquement l’E2E Studio depuis l’UI |

Aucun correctif code ni déploiement proposé comme obligatoire : le Studio prod est déployé ; le blocage est **auth / disponibilité compte**, pas un défaut pipeline Studio démontré.

---

## 9. Décisions demandées au propriétaire

1. Se connecter sur https://captcf.fr/#/formateur/login avec un formateur de recette sûr (ou Take Control du navigateur agent déjà ouvert sur cette page).
2. Confirmer la reprise de la mission 5B-C **après** authentification (même MP3, droits `internal_pilot`, arrêt avant publication).
3. Relire ensuite les brouillons A1–B2 avant toute publication / rattachement séance.

---

## 10. Garanties de ce run

- Publication exercices : **non**
- Séance / devoir / élève : **aucun**
- Push / PR / migration / Edge / secret / RLS : **aucun**
- Import MP3 / Gemini / STT : **aucun**
- Dossier local éclipse : **intact**
- Commit documentaire local prévu : `docs(studio): record second audio draft review` (ce fichier uniquement)

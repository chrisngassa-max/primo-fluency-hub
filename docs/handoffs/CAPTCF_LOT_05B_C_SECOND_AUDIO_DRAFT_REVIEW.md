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

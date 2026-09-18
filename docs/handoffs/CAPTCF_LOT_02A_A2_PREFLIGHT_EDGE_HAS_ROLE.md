# CAPTCF — LOT 2A-A2 PREFLIGHT — Edge `has_role` (avant Phase B deploy)

**Date UTC :** 2026-09-18T17:20Z (approx.)  
**Opérateur :** agent Lot 2A-A2 préflight  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**HEAD pré-fix :** `a0b99d03c94946987376a42e0d82ca2a5f18951d`  
**Commits locaux A2 préflight :**  
- `dc1aeb3dfdbc81630698aff69c50e4c15c716865` — `security(lot-2a-a2): align Edge has_role callers to uid/target_role`  
- `edd5ed489fc3158f8ce37f10cf2a18d1984a8b10` — `docs(lot-2a-a2): preflight Edge has_role before Phase B deploy`  
**HEAD post-préflight :** `edd5ed489fc3158f8ce37f10cf2a18d1984a8b10`  
**Projet prod :** `gudcenhmzlcvhgbgklzw` (TCF PRO NEW)  
**Mutation distante :** **aucune** (pas de deploy Edge, pas de migration, pas de policy)  
**Push :** **aucun**

Références : `CAPTCF_LOT_02A_PHASE_A_DIAGNOSTIC_RLS_HAS_ROLE.md`, `CAPTCF_PLAN_LOTS_BORNES_ACCES_REPRODUCTIBILITE.md`, `supabase/proposed/lot2a/06_EDGE_CALLERS_FIX_NOTES.md`.

---

## 1. Contrat remote vérifié (lecture seule)

| Élément | Valeur |
|---|---|
| Signature SQL remote | `has_role(uid uuid, target_role app_role)` |
| Preuve | `execute_sql` / `pg_proc` (2026-09-18) |
| Appels Edge legacy déployés | `_user_id` / `_role` sur les **6** fonctions ci-dessous |
| Effet PostgREST attendu | named-args legacy → `data=null` / erreur → garde `if (!hasRole)` → **403 formateur** |

---

## 2. Liste EXACTE — 6 fonctions / 8 appels

| # | Fonction | Fichier local | Appel (ancien → nouveau) | Rôle cible |
|---|---|---|---|---|
| 1 | `approve-student` | `supabase/functions/approve-student/index.ts` | `_user_id`,`_role` → `uid`,`target_role` | `formateur` |
| 2 | `create-student` | `supabase/functions/create-student/index.ts` | idem | `formateur` |
| 3a | `curriculum-adapt` | `supabase/functions/curriculum-adapt/index.ts` (`assertFormateur`) | idem | `formateur` |
| 3b | `curriculum-adapt` | idem | idem | `admin` |
| 4a | `curriculum-batch` | `supabase/functions/curriculum-batch/index.ts` (`assertFormateur`) | idem | `formateur` |
| 4b | `curriculum-batch` | idem | idem | `admin` |
| 5 | `reset-student-password` | `supabase/functions/reset-student-password/index.ts` | idem | `formateur` |
| 6 | `update-student-credentials` | `supabase/functions/update-student-credentials/index.ts` | idem | `formateur` |

**Justification unique :** le remote n’expose que les paramètres nommés `uid` / `target_role`. Les clés legacy `_user_id` / `_role` ne matchent pas → RPC inutile pour l’authz formateur.

**Déjà canoniques (hors périmètre A2) :** hash/transcribe/generate/publish/analyze pedagogical + `resolve-exercise-audio` (et shared) — **ne pas régresser**.

---

## 3. Versions distantes actuelles (`list_edge_functions`)

| Fonction | Version distante | verify_jwt | ezbr_sha256 (si fourni) | updated_at (epoch ms API) |
|---|---:|---|---|---|
| `approve-student` | **9** | false | — | 1780703266167 |
| `create-student` | **11** | true | `835ca82f…218ee0dc` | 1781357297874 |
| `curriculum-adapt` | **1** | true | `9c15fcfe…bfddef` | 1783414837059 |
| `curriculum-batch` | **5** | true | `cb958768…9879ff` | 1783354263418 |
| `reset-student-password` | **11** | true | `cdbb465b…d9106` | 1781357347180 |
| `update-student-credentials` | **6** | true | `99b350eb…369a3` | 1781357298333 |

Corps distants relus via `get_edge_function` : **tous** contiennent encore `rpc("has_role", { _user_id, _role })` (confirmé déployé avec l’erreur).

---

## 4. Comparaison local vs distant vs commit

### 4.1 Diff Git du correctif A2 (scoped)

`git diff` sur les 6 fichiers = **uniquement** renommage des clés RPC (10 lignes − / 10 lignes +). Aucun autre changement dans ce diff.

Exemples :

```diff
- await adminClient.rpc("has_role", { _user_id: caller.id, _role: "formateur" });
+ await adminClient.rpc("has_role", { uid: caller.id, target_role: "formateur" });
```

```diff
- await admin.rpc("has_role", { _user_id: user.id, _role: "formateur" });
- await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
+ await admin.rpc("has_role", { uid: user.id, target_role: "formateur" });
+ await admin.rpc("has_role", { uid: user.id, target_role: "admin" });
```

### 4.2 SHA locaux post-fix (SHA256 fichiers)

| Fichier | SHA256 local post-fix |
|---|---|
| `approve-student/index.ts` | `62E1F570…6025D0` |
| `create-student/index.ts` | `6BFFA9F3…A80C1E` |
| `curriculum-adapt/index.ts` | `FB641FCC…05FA542` |
| `curriculum-batch/index.ts` | `211B5422…36346A` |
| `reset-student-password/index.ts` | `D6DDD49C…99CEF8` |
| `update-student-credentials/index.ts` | `5B5D460E…AF13676` |

### 4.3 Drift local HEAD vs distant — **HORS périmètre A2** (ne pas déployer accidentellement)

| Fonction | Drift hors `has_role` | Impact si deploy « dossier local entier » |
|---|---|---|
| `approve-student` | Aucun significatif hors clés RPC | Deploy local post-fix ≈ remote+fix |
| `curriculum-batch` | Aucun significatif hors clés RPC | Deploy local post-fix ≈ remote+fix |
| `curriculum-adapt` | Bundle remote inclut `_shared/*` (ai-client, consent, lib…) | Deploy CLI peut rebundler shared locaux ≠ remote |
| `create-student` | Local upsert `mot_de_passe_initial: password` ; remote **n’écrit pas** le MDP en profil | **OUT** — changerait RGPD/comportement |
| `reset-student-password` | Local `mot_de_passe_initial: new_password` ; remote `null` | **OUT** |
| `update-student-credentials` | Local `mot_de_passe_initial: new_password` ; remote `null` | **OUT** |

**Stratégie deploy Phase B (obligatoire) :**

1. **IN :** uniquement les 8 renames `has_role` sur les 6 slugs.  
2. **OUT :** toute autre divergence locale (persistance MDP, shared curriculum, CORS, etc.).  
3. Pour `create-student` / `reset-student-password` / `update-student-credentials` : déployer depuis **archive remote** (`.local-security-evidence/.../remote-dumps`) + patch has_role only, **pas** depuis le working tree local brut si le dump confirme le drift.  
4. Commandes ciblées (une fonction à la fois), ex. :
   - `supabase functions deploy approve-student --project-ref gudcenhmzlcvhgbgklzw`
   - (idem pour chaque slug — **jamais** `deploy` sans slug / sans filtre).

---

## 5. Archive rollback / redéploiement version antérieure

| Artefact | Chemin | Contenu |
|---|---|---|
| Manifest | `.local-security-evidence/lot2a-a2-preflight-2026-09-18/MANIFEST.json` | versions, SHAs, drift OUT |
| Dumps remote | `.local-security-evidence/lot2a-a2-preflight-2026-09-18/remote-dumps/` | corps `get_edge_function` (gitignored) |
| Deploy-ready | `.local-security-evidence/lot2a-a2-preflight-2026-09-18/deploy-ready-has-role-only/` | remote + rename keys only (si généré) |

**Rollback immédiat :** redéployer le dump `remote-dumps/<slug>/` (version N ci-dessus) pour le slug fautif. Les dumps portent encore les clés legacy — c’est volontaire pour restauration bit-à-bit de l’état pré-A2.

---

## 6. Ordre de déploiement (fonction par fonction)

1. `approve-student` (1 appel, faible surface, verify_jwt=false — smoke 403→200 formateur)  
2. `create-student`  
3. `reset-student-password`  
4. `update-student-credentials`  
5. `curriculum-batch` (2 appels)  
6. `curriculum-adapt` (2 appels + dépendances shared — dernier)

Entre chaque : smoke parcours §8 ; arrêt si 403 formateur légitime casse ou régression.

---

## 7. Tests locaux

| Test | Résultat |
|---|---|
| `node scripts/security/assert-lot2a-has-role-callers.mjs --strict` | **SUCCESS** — `legacy_rpc_calls: 0`, `canonical_rpc_calls: 18` |
| Même commande sans `--strict` | **SUCCESS** (+ WARN latent migration `20260317202908`) |
| WARN latent | Migration git définit encore `_user_id,_role` — **hors A2** (sous-lot A1) |

---

## 8. Usage production (lecture logs, 24h)

Requêtes `query_logs` sur `function_edge_logs` / `edge_logs` filtrées sur les 6 paths : **0 événement** dans la fenêtre API (~24h).

| Conclusion usage | Statut |
|---|---|
| Trafic live confirmé sur ces 6 slugs (24h) | **Non observé** |
| Code déployé legacy confirmé | **Oui** (`get_edge_function`) |
| Parcours « cassé réel » mesuré live (smoke auth) | **Non mesuré** (pas de compte / pas d’appel auth) |

---

## 9. Distinctions — erreur / déployé / cassé réel / potentiel

| Cas | Erreur dans le code | Déployé avec l’erreur | Parcours réellement cassé | Risque seulement potentiel |
|---|---|---|---|---|
| 8 appels legacy vs remote `uid/target_role` | **Oui** (local pré-fix + remote) | **Oui** (6 fonctions) | **Probable** dès qu’un formateur appelle ces Edge (403 faux négatif) — **non prouvé** par smoke 24h | Si aucun formateur n’utilise le parcours |
| Drift MDP local≠remote | Oui (divergence produit) | Remote = variante « null / non persisté » | N/A pour A2 | **Oui** si deploy local non scoped |
| Policies / SQL has_role | Non (A2) | N/A | N/A | Sous-lots A1/B* |

**Synthèse :** défaut **confirmé en code + en prod déployée** ; impact utilisateur **fortement probable** mais **non mesuré** live dans cette fenêtre (0 hits logs).

---

## 10. Protocole smoke (après autorisation Phase B uniquement)

Prérequis : session formateur réelle (compte existant) ; ne pas créer de compte.

| Fonction | Parcours | Succès | Échec / arrêt |
|---|---|---|---|
| `approve-student` | Approuver un élève pending + groupe | HTTP 200, status approved | 403 « Accès réservé aux formateurs » pour un vrai formateur |
| `create-student` | Créer élève dans un groupe du formateur | 200 + user créé | 403 formateur |
| `reset-student-password` | Reset MDP élève du groupe | 200 + MDP | 403 formateur |
| `update-student-credentials` | Changer email/MDP élève du groupe | 200 | 403 formateur |
| `curriculum-batch` | `action=estimate` puis `status` si batch | 200 | 403 |
| `curriculum-adapt` | Appel avec `trainingSessionId` + `sessionCode` valides | 200 ou 200 degraded ressources | 403 formateur |

Négatif : utilisateur non-formateur → 403 attendu (ne doit **pas** passer à 200).

---

## 11. Critères d’arrêt et retour arrière

**Arrêt immédiat si :**

- Après deploy d’un slug, formateur authentifié reçoit encore 403 sur `has_role`  
- Assert local `--strict` redevient FAIL (legacy réintroduit)  
- Deploy a emporté du drift MDP / shared non autorisé  
- Erreurs 5xx nouvelles massives sur le slug

**Rollback :** redéployer dump `remote-dumps/<slug>/` (version tableau §3) ; re-vérifier smoke ; documenter incident.

---

## 12. Tableau synthèse (livrable)

| fonction | version distante | appels corrigés | diff exact | parcours | test | rollback |
|---|---:|---|---|---|---|---|
| `approve-student` | 9 | 1 (`formateur`) | `_user_id/_role`→`uid/target_role` | approbation élève | smoke formateur 200 | redeploy dump v9 |
| `create-student` | 11 | 1 (`formateur`) | idem | création élève | smoke 200 | redeploy dump v11 (**sans** drift MDP local) |
| `curriculum-adapt` | 1 | 2 (`formateur`+`admin`) | idem ×2 | adaptation séance | smoke 200/degraded | redeploy dump v1 + shared d’origine |
| `curriculum-batch` | 5 | 2 (`formateur`+`admin`) | idem ×2 | batch curriculum | estimate/status 200 | redeploy dump v5 |
| `reset-student-password` | 11 | 1 (`formateur`) | idem | reset MDP | smoke 200 | redeploy dump v11 |
| `update-student-credentials` | 6 | 1 (`formateur`) | idem | update email/MDP | smoke 200 | redeploy dump v6 |

---

## 13. IN / OUT du prochain deploy (Phase B)

### IN (autorisé sous A2)

- Les **6** Edge Functions listées  
- Uniquement le rename des **8** appels `has_role`  
- Commit local identifié contenant ces diffs (obligatoire avant deploy)

### OUT (interdit sans autorisation séparée)

- Push Git  
- `apply_migration` / SQL `has_role` (A1)  
- Policies B1–B4  
- Drift `mot_de_passe_initial` local vs remote  
- Redeploy massif d’autres fonctions / `_shared` non vérifiés  
- Toute autre correction applicative

---

## 14. PÉRIMÈTRE EXACT — autorisation demandée (Phase B)

> **Autorisation propriétaire demandée pour Lot 2A sous-lot A2 Phase B uniquement :**  
> déployer sur le projet Supabase `gudcenhmzlcvhgbgklzw` les **six** Edge Functions `approve-student`, `create-student`, `curriculum-adapt`, `curriculum-batch`, `reset-student-password`, `update-student-credentials`, **une par une** dans l’ordre §6, en n’appliquant que le correctif des **huit** appels `rpc('has_role')` (`_user_id`/`_role` → `uid`/`target_role`), à partir du **commit local identifié** (et/ou dumps remote+patch has_role-only pour les slugs à drift MDP), **sans** push Git, **sans** migration SQL, **sans** modification de policies, **sans** déployer d’autres fonctions ni le drift hors `has_role`.

---

## 15. Confirmation préflight

| Action | Statut |
|---|---|
| Deploy Edge | **non effectué** |
| Migration / `apply_migration` | **non effectué** |
| Modification policy | **non effectué** |
| Push | **non effectué** |
| Lectures remote métadonnées/fonctions | **oui** |
| Correctif local 8 appels | **oui** (working tree → à committer) |
| Handoff préflight | **ce fichier** |

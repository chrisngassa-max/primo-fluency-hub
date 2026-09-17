# CAPTCF — LOT 2A PHASE A — Diagnostic RLS / has_role

**Date UTC :** 2026-09-17T21:50Z → 2026-09-17T22:20Z (approx.)  
**Opérateur :** agent Lot 2A Phase A  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**HEAD initial (attendu préfixe `80c4d481`) :** `80c4d481a9d324b9d6ef530d17a6944304819134` — **confirmé**  
**Mutation distante :** **aucune**  
**Push :** **aucun**  
**Autorisation :** Lot 2A Phase A diagnostic/préparation uniquement (enregistrée). Phase B / sous-lots production = **autorisations distinctes requises**.

---

## 1. État Git

| Élément | Valeur |
|---|---|
| Branche | `codex-captcf-lot-00-protection-cartographie-20260917` |
| HEAD initial | `80c4d481a9d324b9d6ef530d17a6944304819134` |
| HEAD final | `304518eccde1ee8b37a1c0748872f76bd587a714` (+ handoff commit suivant) |
| Travaux existants | **préservés** (docs pédagogiques untracked non stagés) |
| AGENTS.md / CLAUDE.md | **absents** du dépôt (noté) |

Écart branche/HEAD : **aucun** — mission poursuivie.

---

## 2. Faits vérifiés vs hypothèses vs recommandations

### Faits vérifiés (remote `gudcenhmzlcvhgbgklzw`, SELECT / list_* only)

| Fait | Preuve |
|---|---|
| Une seule signature `has_role(uid uuid, target_role app_role)` | `pg_proc` + `pg_get_functiondef` |
| SECURITY DEFINER, `search_path=public`, STABLE | idem |
| EXECUTE : anon, authenticated, service_role | `proacl` |
| `has_role(NULL, …)` → `false` | SELECT distant |
| 310 policies RLS public schema ; 113 avec `polroles={}` ≡ `{public}` | inventaire |
| 161 TO authenticated ; 36 TO service_role | inventaire |
| 6 Sandbox isolation **RESTRICTIVE** inchangées | SELECT + Lot 0.8B |
| Migrations remote jusqu’à `20260917195043` lot06 | `list_migrations` |
| types.ts déjà `uid` / `target_role` | grep local |
| Migration git `20260317202908` définit encore `_user_id,_role` | fichier local |
| 10 appels Edge canoniques ; **8** legacy `_user_id/_role` | assert-lot2a |

### Hypothèses

| Hypothèse | Statut |
|---|---|
| Les 8 Edge legacy reçoivent `data=null` / erreur PostgREST et renvoient 403 formateur | **probable** (comportement PostgREST named-args) — non mesuré live sans smoke auth |
| Aucun client anon ne dépend des 113 policies `{public}` post Lot 0.6 | **fort** (GRANT anon confiné) — B1 low risk |
| Surcharge dual-name impossible (mêmes types uuid, app_role) | **fait PostgreSQL** |

### Recommandations

1. Sous-lot **A2 Edge** d’abord (corriger 8 callers) — impact authz immédiat, **sans** migration DB.  
2. Sous-lot **A1** alignement migration git / proposed `01_has_role_canonical.sql` (idempotent remote).  
3. Sous-lots policies **B1 → B2 → B3 → B4** (jamais les 113 d’un coup ; jamais Sandbox).  
4. Revue séparée des 19 `trop_large_authenticated` (hors hygiène TO).

---

## 3. AXE A — has_role

### Signatures

| Lieu | Signature |
|---|---|
| **Remote** | `has_role(uid uuid, target_role app_role)` |
| Local migration | `has_role(_user_id uuid, _role app_role)` — **drift** |
| types.ts | `uid` / `target_role` — aligné remote |

### Appelants classés

| Classe | Nb | Détail |
|---|---:|---|
| Cassés (legacy named vs remote) | **8** appels / 6 fonctions | approve-student, create-student, curriculum-adapt (×2), curriculum-batch (×2), reset-student-password, update-student-credentials |
| OK canoniques | **10** | pedagogical + resolve-exercise-audio |
| Ambigu / mixed | **0** | — |
| Latents | **1** | réappliquer migration 20260317202908 renommerait les params remote |
| Policies SQL positionnelles | nombreuses | **OK** (indépendantes des noms) |
| Triggers | 0 appel direct trouvé hors policies/fonctions | — |

### Contrat canonique proposé (1 phrase)

**`public.has_role(uid uuid, target_role app_role) RETURNS boolean` SECURITY DEFINER `search_path=public` ; PostgREST nommé uniquement `uid`/`target_role` ; pas de seconde surcharge homotype.**

### Transition

1. Corriger Edge legacy → canonique (deploy functions).  
2. Appliquer proposed `01_has_role_canonical.sql` si besoin d’aligner commentaires/grants (idempotent).  
3. Remplacer le corps de la migration historique en git (doc) sans l’appliquer telle quelle en prod sous l’ancien nom.  
4. Ne **jamais** `CREATE OR REPLACE` avec `_user_id,_role` tant que des Edge canoniques existent.

---

## 4. AXE B — policies `{public}`

Inventaire machine : `docs/security/CAPTCF_LOT_02A_POLICIES_INVENTORY.json` (+ `.md`).

### Counts par classe (toutes policies 310)

| Classe | Count |
|---|---:|
| dependante_has_role | 93 |
| correcte_role_implicite_vers_explicite | 90 |
| a_conserver | 52 |
| destinee_service_role | 49 |
| trop_large_authenticated | 19 |
| conserver_sandbox_restrictive | 6 |
| hygiene_seulement | 1 |

### Dont `{public}` seulement (113)

| Classe | Count |
|---|---:|
| correcte_role_implicite_vers_explicite | 90 |
| destinee_service_role | 13 |
| conserver_sandbox_restrictive | 6 |
| dependante_has_role | 3 |
| hygiene_seulement | 1 |

`{public}` n’est **pas** une vulnérabilité automatique : confronter GRANT (anon souvent 0) + condition. Risque principal = hygiène / surface si GRANT réouvert.

### PERMISSIVE / RESTRICTIVE

6 Sandbox RESTRICTIVE **à conserver** (Lot 0.8B). Aucune conversion mécanique.

---

## 5. Risques actifs vs latents

**Actifs**

- 8 appels Edge `has_role` legacy → authz formateur potentiellement cassée (403) sur create/approve/curriculum/credentials.
- Drift migration locale `_user_id/_role` si quelqu’un l’applique → casse les Edge déjà canoniques.

**Latents**

- 113 policies `{public}` : hygiène ; exposition réelle si GRANT anon revient.
- 19 policies `TO authenticated` + `true` : lecture/insert large entre utilisateurs authentifiés.
- 13 policies intent service encore sur `{public}`.
- EXECUTE `has_role` encore à anon.

---

## 6. Sous-lots proposés (ordre) + critères

| Ordre | Sous-lot | Diff SQL / action | Succès | Arrêt |
|---|---|---|---|---|
| 1 | **A2** Edge callers | Code only — voir `06_EDGE_CALLERS_FIX_NOTES.md` | `--strict` assert exit 0 ; smoke formateur | 403 résiduel / régression canonical |
| 2 | **A1** has_role SQL | `proposed/lot2a/01_has_role_canonical.sql` | signature remote inchangée ; null→false | tout rename vers legacy |
| 3 | **B1** 90 scoped | `02b_…_FULL.sql` | count `{public}` ↓90 ; Sandbox=6 | régression UI élève/formateur scoped |
| 4 | **B2** 13 service | `03_…_FULL.sql` | policies TO service_role | Edge service cassé |
| 5 | **B3** 3 profiles has_role | `04_…_FULL.sql` | TO authenticated | formateur ne voit plus élèves |
| 6 | **B4** 1 hygiene | `05_…_FULL.sql` | TO authenticated | — |
| — | Sandbox | **aucune** | 6 RESTRICTIVE | PERMISSIVE / DROP |
| — | trop_large 19 | hors Phase A apply | revue métier | — |

Chaque sous-lot : **autorisation propriétaire distincte** + rollback companion.

---

## 7. Tests exécutés

| Test | Résultat |
|---|---|
| `npm run security:check` | **EXIT 0** — pass=4 (dont `assert-lot2a-has-role-callers`) ; not_tested evidence/sql |
| `npm run security:selftest` | **EXIT 0 — 12/12** (10 Lot1/0.8B + 2 Lot2A has_role) |
| `assert-lot2a-has-role-callers` default | SUCCESS + WARN legacy=8 + latent migration |
| `assert-lot2a-has-role-callers --strict` | FAIL (détecte legacy) — attendu Phase A |
| Remote SELECT : Sandbox RESTRICTIVE | **6** |
| Remote SELECT : `pg_policies` roles | `{public}`=113, `{authenticated}`=161, `{service_role}`=36 |
| Remote SELECT : `has_role(NULL,…)` | **false** |
| SQL `lot2a_*.sql` BEGIN…ROLLBACK | **not_run** distant (pas de tx via MCP) — fichier prêt |

Non-régression Lot 0.8B : 6 RESTRICTIVE **acceptées** (selftest négatifs PERMISSIVE/missing/altered OK).

---

## 8. Livrables

| Artefact | Chemin |
|---|---|
| Handoff | `docs/handoffs/CAPTCF_LOT_02A_PHASE_A_DIAGNOSTIC_RLS_HAS_ROLE.md` |
| Inventaire | `docs/security/CAPTCF_LOT_02A_POLICIES_INVENTORY.md` + `.json` |
| Matrice | `docs/security/CAPTCF_LOT_02A_MATRICE_AVANT_APRES.md` |
| Proposed SQL | `supabase/proposed/lot2a/` |
| Tests SQL | `supabase/tests/lot2a_has_role_and_public_policies.sql` |
| Assert | `scripts/security/assert-lot2a-has-role-callers.mjs` |

---

## 9. Commits locaux (Lot 2A)

1. `240584b3e08a0d19465f89e979693fe54e894d4e` — `security(lot-2a): inventaire policies/has_role et extension harness`
2. `304518eccde1ee8b37a1c0748872f76bd587a714` — `security(lot-2a): migrations proposees has_role et policies public`
3. *(ce handoff)* — `docs(lot-2a): diagnostic Phase A has_role et policies public`

**Push : aucun.**

Fichiers pédagogiques untracked **préservés** (non stagés).
---

## 10. Conclusion — autorisations requises pour la suite

Phase A **terminée** sans mutation distante.

Pour Phase B, demander **séparément** :

1. Autorisation sous-lot **A2** (deploy Edge has_role)  
2. Autorisation sous-lot **A1** (SQL has_role si non déjà aligné)  
3. Autorisation sous-lot **B1** (90 policies)  
4. Puis B2 / B3 / B4 individuellement  

**Rappel :** aucune mutation distante dans ce lot ; `apply_migration` / deploy / push **interdits** sans nouvelle autorisation.

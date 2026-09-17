# CAPTCF — LOT 0.7 — Garde-fous futurs et clôture phase d'urgence

**Date UTC :** 2026-09-17T20:14Z → 2026-09-17T20:30Z  
**Opérateur :** Sofiane (agent Lot 0.7)  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**HEAD initial attendu / observé :** `fb93e683` / `fb93e6833f63049e2b37b758a731d76087a3591b` (pré-Lot 0.7)  
**Cible LECTURE SEULE :** Supabase `gudcenhmzlcvhgbgklzw` (TCF PRO NEW / captcf.fr) — `ACTIVE_HEALTHY`  
**Mutation distante :** **aucune**  
**Push :** **aucun**

Preuves locales : `.local-security-evidence/` (gitignored).

---

## 0. Décision d’arrêt (critique)

**Exposition critique ACTIVE découverte (authenticated, pas anon) :**  
6 policies `Sandbox isolation` sur `{public}` avec  
`USING ((sandbox_session_id IS NULL) OR can_access_sandbox(...))`  
sur `groups`, `group_members`, `sessions`, `devoirs`, `resultats`, `profils_eleves`.

Comme les policies RLS permissives sont **OU**-ées et que `authenticated` a encore `SELECT` sur ces tables, **tout compte authentifié peut lire les lignes de production** (`sandbox_session_id IS NULL`).

→ **ARRÊT clôture « urgence close » complète** jusqu’à autorisation propriétaire pour Lot 2A (correction policies).  
→ **Ne pas** traiter ce constat comme détail mineur.  
→ Confinement **anon** Lot 0.5/0.6 : **maintenu** (voir §1).

---

## 1. Étape 1 — Vérification maintien confinement

| Contrôle | Attendu | Observé | Statut |
|---|---|---|---|
| Branche | `codex-captcf-lot-00-protection-cartographie-20260917` | identique | OK |
| HEAD | `fb93e683…` | `fb93e6833f63049e2b37b758a731d76087a3591b` | OK |
| Projet | `gudcenhmzlcvhgbgklzw` ACTIVE_HEALTHY | confirmé MCP `get_project` | OK |
| Privileges table `anon` (public) | 0 | `anon_table_grants=0`, `anon_tables_with_any_priv=0` | OK |
| Sensitive SELECT anon | false | profiles/user_roles/… = false | OK |
| `bootstrap-test-accounts` | stub, `verify_jwt=true` | v10, `verify_jwt=true` | OK |
| `create-formateur-account` | stub, `verify_jwt=true` | v10, `verify_jwt=true` | OK |
| Compteurs | ~61/61/4/29 | 61 users / 61 profiles / 4 groups / 29 memberships | OK |
| Migrations | `20260917190900`, `20260917195043` | présentes remote `list_migrations` | OK |

**Maintien confinement anon + stubs : OK.**

---

## 2. Étape 2 — Inventaire DEFAULT PRIVILEGES

### 2.1 Synthèse par créateur / type (schéma `public` pertinent)

| Rôle créateur | Objet | ACL observée (extrait) | anon ? |
|---|---|---|---|
| **postgres** | tables | `postgres=arwdDxtm`, `authenticated=arwdDxtm`, `service_role=arwdDxtm` | **non** (révoqué Lot 0.6) |
| **postgres** | sequences | `postgres=rwU`, `authenticated=rwU`, `service_role=rwU` | **non** |
| **postgres** | functions | `postgres=X`, `authenticated=X`, `service_role=X` | **non** |
| **postgres** | types | aucun `pg_default_acl` type listé | N/A |
| **supabase_admin** | tables | `…, anon=arwdDxtm/supabase_admin, authenticated=…, service_role=…` | **OUI — latent** |
| **supabase_admin** | sequences | `anon=rwU/supabase_admin` | **OUI — latent** |
| **supabase_admin** | functions | `anon=X/supabase_admin` | **OUI — latent** |
| **supabase_admin** | types | aucun entry type | N/A |

Autres schémas (hors correction opérateur CapTCF) : `graphql` / `graphql_public` (mêmes grants anon via supabase_admin), `storage` (postgres→anon), `extensions`/`cron`/`realtime`/`auth` (dashboard/postgres only).

### 2.2 Fiche `supabase_admin` (public)

| Champ | Valeur |
|---|---|
| Privilèges futurs → **anon** | tables `arwdDxtm` (INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) ; sequences `rwU` ; functions `EXECUTE` |
| Privilèges futurs → **authenticated** | mêmes droits table/seq/func |
| Privilèges futurs → **PUBLIC** | non listé explicitement dans ACL (grants nominatifs aux rôles) |
| Objets futurs concernés | toute table/sequence/fonction **créée par `supabase_admin`** dans `public` |
| Commande théorique | `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon, PUBLIC;` (+ SEQUENCES / FUNCTIONS) |
| Erreur exacte Lot 0.6 | `insufficient_privilege` / permission denied (NOTICE migration : skipped supabase_admin DEFAULT PRIVILEGES) |
| Autorité nécessaire | rôle propriétaire système Supabase / support plateforme (pas le rôle migration opérateur) |
| Contournement | **interdit** (`SET ROLE` / elevation) — **impossible** pour l’opérateur actuel |

**Mitigation locale obligatoire :** chaque migration `CREATE TABLE` doit `REVOKE` anon explicitement + contrôle Lot 0.7.

---

## 3. Étape 3 — Garde-fou automatique

| Artefact | Rôle |
|---|---|
| `scripts/security/assert-lot07-future-guards.mjs` | contrôle local 3 couches |
| `scripts/security/lot07-remote-evidence.example.json` | schéma evidence sans secret |
| `supabase/tests/lot07_future_guards.sql` | assertions SQL + `ROLLBACK` |
| `docs/security/REGLE_CONTRIBUTION_TABLES.md` | règle contribution courte |
| héritage | `assert-no-insecure-account-bootstraps.mjs`, `assert-no-prod-bootstrap.mjs`, tests lot05/lot06 |

### Exécution

```bash
# Couche dépôt (doit passer aujourd’hui)
node scripts/security/assert-lot07-future-guards.mjs
node scripts/security/assert-no-insecure-account-bootstraps.mjs

# Couche distante observée (JSON gitignored, sans clés)
node scripts/security/assert-lot07-future-guards.mjs --evidence .local-security-evidence/02-lot07-remote-observed.json
# → ÉCHEC attendu tant que Sandbox isolation non corrigée (détection active)

# SQL transactionnel (MCP / SQL editor) — ROLLBACK inclus
# fichier: supabase/tests/lot07_future_guards.sql
```

### Couches

1. **Dépôt/migrations** : stubs 410 + `verify_jwt=true` ; présence lot05/06 ; toute migration post-`20260917195043` créant une table doit GRANT explicite + REVOKE anon + policies `TO` explicite.  
2. **Distant observé** : via evidence JSON ou SQL test — anon=0 ; policies permissives ; stubs remote.  
3. **Latent DEFAULT PRIVILEGES** : WARNING + obligation REVOKE dans nouvelles migrations ; pas de contournement rôle.

Aucune clé n’est lue ni imprimée.

---

## 4. Étape 4 — Policies `{public}` résiduelles

**Total :** 113 policies · **46** tables · **0** policy rôle `{anon}` seul.

### Comptes par classe (une policy peut apparaître dans plusieurs)

| Classe | Count | Notes |
|---|---:|---|
| Faux positif anon (neutralisé par GRANT anon = 0) | **113** | PostgREST anon ne peut plus toucher les tables |
| Nécessitant clause `TO` explicite | **113** | toutes encore `{public}` |
| Trop large pour authenticated | **7** | 6× Sandbox isolation + `interventions_select` (`is_systeme = true`) |
| Exposition critique ACTIVE | **6** | Sandbox isolation (voir §0) — **ARRÊT** |

### Échantillon inventaire (représentatif)

| table | policy | cmd | rôles | USING/CHECK | données | priv. nécessaire | expo anon | risque auth | reco |
|---|---|---|---|---|---|---|---|---|---|
| profiles | Users view own profile | SELECT | {public} | `id = auth.uid()` | profils | SELECT | aucune (no GRANT) | OK si TO auth | `TO authenticated` |
| profiles | Formateurs view their students | SELECT | {public} | has_role + group | élèves du formateur | SELECT | aucune | OK scoped | `TO authenticated` |
| devoirs | Eleves view own devoirs | SELECT | {public} | `eleve_id = auth.uid()` | devoirs | SELECT | aucune | OK | `TO authenticated` |
| devoirs | **Sandbox isolation** | SELECT | {public} | `sandbox_session_id IS NULL OR …` | **tous devoirs prod** | SELECT | aucune | **CRITIQUE** | drop/replace AND-filter Lot 2A |
| groups | **Sandbox isolation** | SELECT | {public} | idem | **tous groupes prod** | SELECT | aucune | **CRITIQUE** | Lot 2A |
| group_members | **Sandbox isolation** | SELECT | {public} | idem | memberships | SELECT | aucune | **CRITIQUE** | Lot 2A |
| sessions | **Sandbox isolation** | SELECT | {public} | idem | sessions | SELECT | aucune | **CRITIQUE** | Lot 2A |
| resultats | **Sandbox isolation** | SELECT | {public} | idem | résultats | SELECT | aucune | **CRITIQUE** | Lot 2A |
| profils_eleves | **Sandbox isolation** | SELECT | {public} | idem | profils élèves | SELECT | aucune | **CRITIQUE** | Lot 2A |
| interventions | interventions_select | SELECT | {public} | formateur OR `is_systeme` | interventions système | SELECT | aucune | large (lecture catalogue système) | `TO authenticated` + revoir OR |
| email_send_log | Service role can read… | SELECT | {public} | `auth.role()=service_role` | ops email | SELECT | aucune | OK intent | `TO service_role` |
| user_roles | Users view own roles | SELECT | {public} | `user_id = auth.uid()` | rôles | SELECT | aucune | OK | `TO authenticated` |

Inventaire complet exportable via :

```sql
SELECT tablename, policyname, cmd, roles::text, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND 'public' = ANY (roles)
ORDER BY 1, 2;
```

---

## 5. Étape 5 — Message prêt pour support Supabase

**Statut :** texte uniquement — **non envoyé**.

---

**Subject:** Request to revoke `supabase_admin` DEFAULT PRIVILEGES granting `anon` on future `public` objects — project `gudcenhmzlcvhgbgklzw`

Hello Supabase Support,

We need the official supported method to revoke **DEFAULT PRIVILEGES** owned by role **`supabase_admin`** that currently grant privileges to **`anon`** on **future** objects in schema **`public`**.

**Project ref:** `gudcenhmzlcvhgbgklzw` (TCF PRO NEW, region `eu-west-1`).

**Observed (privileges only — no secrets):**

From `pg_default_acl` for `supabase_admin` / schema `public`:

- **Tables:** `anon=arwdDxtm/supabase_admin` (and equivalent for `authenticated`, `service_role`, `postgres`)
- **Sequences:** `anon=rwU/supabase_admin`
- **Functions:** `anon=X/supabase_admin`

**What we already fixed ourselves:**

- `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE … FROM anon` **succeeded**.
- We revoked **all current** table privileges from `anon` on existing `public` tables (confinement migrations). Current state: **`anon` has 0 table privileges** in `public`.

**What failed:**

- `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES/SEQUENCES/FUNCTIONS FROM anon, PUBLIC;`  
  → **permission denied / insufficient_privilege** for our migration operator role.

We will **not** use `SET ROLE`, impersonation, or other privilege-escalation workarounds.

**Ask:**

1. What is the official procedure to remove `anon` (and ideally overly broad defaults) from `supabase_admin` DEFAULT PRIVILEGES on `public`?
2. Can Support apply this change on project `gudcenhmzlcvhgbgklzw`, or grant a safe operator path?
3. Please confirm the durable result so future tables created by platform roles do **not** auto-grant `TRUNCATE`/`DELETE`/etc. to `anon`.

Thank you.

---

## 6. Risques actifs vs latents

| Risque | Statut |
|---|---|
| Anon TRUNCATE/DELETE/SELECT tables public | **fermé** (actif = 0) |
| Bootstrap / create-formateur ouverts | **fermé** (stubs 410 + JWT) |
| DEFAULT PRIVILEGES `postgres`→anon | **fermé** |
| DEFAULT PRIVILEGES `supabase_admin`→anon | **latent** (futurs objets) |
| Policies `{public}` + auth.uid() | **latent hygiene** (Lot 2A TO) |
| Sandbox isolation OR-open | **ACTIF authenticated — bloqueur** |
| `has_role` bifide / B2 IPE | hors urgence (lots suivants) |
| Autres Edge `verify_jwt=false` | hors Lot 0.7 |

---

## 7. Critères « urgence close »

| Critère | Résultat |
|---|---|
| Anon 0 privilège table public | **OK** |
| Stubs comptes protégés | **OK** |
| Compteurs stables | **OK** |
| Garde-fou détecte régression anon / migrations | **OK** |
| DEFAULT PRIVILEGES système documentés + ticket prêt | **OK** (correction support en attente) |
| Aucune exposition critique ACTIVE nouvelle | **KO** — Sandbox isolation authenticated |
| Autorisation pour corriger Sandbox | **manquante** |

**Verdict phase urgence :** confinement **anon** clos opérationnellement ; **clôture globale urgence = NON** tant que Sandbox isolation non autorisée/corrigée.

---

## 8. Travaux transférés

### Lot 1 — exécuteur de tests reproductible (priorité si Sandbox autorisée en parallèle ou après gel)

- Orchestrer `assert-lot07-*`, lot05/06 SQL, evidence JSON, CI locale sans secrets.
- Preuves auto pour Lot 2A.

### Lot 2A — policies authenticated + `has_role` (priorité **immédiate** pour Sandbox)

1. Autorisation propriétaire explicite.
2. Remplacer/supprimer les 6 `Sandbox isolation` (ne plus ouvrir `IS NULL` en permissive OR).
3. Ajouter `TO authenticated` / `TO service_role` sur les 113 policies `{public}`.
4. Unifier contrat `has_role`.
5. Ne pas rouvrir GRANT anon.

**Recommandation coordinateur :**  
- Si l’objectif est **preuves avant tout** → Lot 1.  
- Vu **exposition authenticated ACTIVE** → **Lot 2A Sandbox en premier** (autorisation), Lot 1 en parallèle pour le harness.

---

## 9. État Git final (après commits Lot 0.7)

| Élément | Valeur |
|---|---|
| Branche | `codex-captcf-lot-00-protection-cartographie-20260917` |
| Commit 1 | `c98ba11e` — `security(lot-0.7): add future guards against anon privilege regression` |
| Commit 2 | (ce handoff) — `docs(lot-0.7): close emergency phase with residual risk inventory` |
| Push | **aucun** |
| Fichiers pédagogiques untracked | **non commités** |
| Recontrôle distant Lot 0.7 | anon_tables=0 ; counts 61/61/4/29 ; public_policies=113 ; sandbox_open=6 ; admin defaults anon=arwdDxtm |

---

## 10. Commandes lecture seule exécutées

- `git rev-parse` branche/HEAD ; `git status` ; `git log`
- MCP `get_project`, `list_migrations`, `list_edge_functions`
- MCP `execute_sql` SELECT only : grants anon, counts, `pg_default_acl`, `pg_policies`
- `node scripts/security/assert-lot07-future-guards.mjs` (OK sans evidence)
- Aucun `apply_migration` / `deploy_edge_function` / write SQL

---

*Fin handoff Lot 0.7 — ARRÊT partiel sur exposition Sandbox authenticated.*

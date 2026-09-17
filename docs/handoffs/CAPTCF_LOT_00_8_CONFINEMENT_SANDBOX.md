# CAPTCF — LOT 0.8 — Confinement Sandbox authenticated (Phase A — préparation)

**Date UTC :** 2026-09-17T20:39Z → 2026-09-17T20:55Z (approx.)  
**Opérateur :** agent Lot 0.8 (Phase A)  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**HEAD initial attendu / observé :** `43b68ad5` / `43b68ad54019dbf9b504ab7564ff1b68b3a6070f`  
**Cible LECTURE SEULE :** Supabase `gudcenhmzlcvhgbgklzw` (TCF PRO NEW / captcf.fr) — `ACTIVE_HEALTHY`  
**Mutation distante :** **NON RÉALISÉE — en attente autorisation**  
**Push :** **aucun**

---

## 0. Point d’arrêt (Phase B)

Aucun `apply_migration`, SQL d’écriture durable, déploiement, push, rotation clé ou suppression de données n’a été exécuté.

**Phrase d’autorisation requise (exacte) pour Phase B :**

> J’autorise l’application distante du Lot 0.8 Sandbox sur le projet Supabase gudcenhmzlcvhgbgklzw, selon le diff et le plan de retour arrière présentés.

Sans cette phrase : **arrêt**.

---

## 1. État Git (Phase A)

| Élément | Valeur |
|---|---|
| Branche | `codex-captcf-lot-00-protection-cartographie-20260917` |
| HEAD pré-Phase-A | `43b68ad54019dbf9b504ab7564ff1b68b3a6070f` |
| Projet | `gudcenhmzlcvhgbgklzw` uniquement |
| Fichiers pédagogiques untracked | **préservés** (non stagés) |
| Push | **aucun** |

Garde-fous locaux (OK) :

```bash
node scripts/security/assert-lot07-future-guards.mjs
node scripts/security/assert-no-insecure-account-bootstraps.mjs
node scripts/security/assert-no-prod-bootstrap.mjs
```

---

## 2. Inventaire avant (lecture seule)

### 2.1 Les 6 policies « Sandbox isolation »

| table | policy | permissive | cmd | roles | USING |
|---|---|---|---|---|---|
| groups | Sandbox isolation | **RESTRICTIVE** | SELECT | `{public}` | `(sandbox_session_id IS NULL) OR can_access_sandbox(...)` |
| group_members | Sandbox isolation | **RESTRICTIVE** | SELECT | `{public}` | idem |
| sessions | Sandbox isolation | **RESTRICTIVE** | SELECT | `{public}` | idem |
| devoirs | Sandbox isolation | **RESTRICTIVE** | SELECT | `{public}` | idem |
| resultats | Sandbox isolation | **RESTRICTIVE** | SELECT | `{public}` | idem |
| profils_eleves | Sandbox isolation | **RESTRICTIVE** | SELECT | `{public}` | idem |

`CHECK` : null sur les 6. Origine : `supabase/migrations/20260608210000_sandbox_v4.sql` (`AS RESTRICTIVE`).

### 2.2 Policies métier voisines (PERMISSIVE, rôles `{public}`)

| table | policies métier |
|---|---|
| groups | Eleves view their groups (SELECT) ; Formateurs manage own groups (ALL) |
| group_members | Eleves view own memberships (SELECT) ; Formateurs manage members (ALL) |
| sessions | Eleves view their sessions (SELECT) ; Formateurs manage sessions (ALL) |
| devoirs | Eleves view own devoirs (SELECT) ; Formateurs manage devoirs (ALL) |
| resultats | Eleves view own resultats (SELECT) ; Formateurs view student resultats (SELECT) |
| profils_eleves | Eleves view own profil (SELECT) ; Formateurs view student profils (SELECT) |

Aucune policy admin dédiée sur ces 6 tables (admin ops via `service_role` / Edge).

### 2.3 Grants

| grantee | tables (6) |
|---|---|
| anon | **aucun** |
| authenticated | SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER |
| service_role | idem |

### 2.4 Volumes (sans PII)

| table | prod (`sandbox_session_id IS NULL`) | sandbox |
|---|---:|---:|
| groups | 3 | 1 |
| group_members | 25 | 4 |
| sessions | 28 | 2 |
| devoirs | 1855 | 45 |
| resultats | 1117 | 31 |
| profils_eleves | 22 | 4 |
| sandbox_sessions | — | 1 active |

### 2.5 `can_access_sandbox(uuid)`

SECURITY DEFINER, STABLE : membre si `sandbox_sessions.statut='active'` et (`formateur_id = auth.uid()` OR `auth.uid() = ANY(eleve_user_ids)`). EXECUTE → `authenticated`.

### 2.6 Parcours applicatifs

| Parcours | Accès |
|---|---|
| UI formateur/élève (client Supabase) | policies métier (ownership / membership) |
| Sandbox setup/reset/preview/status/mosaic | Edge + **service_role** (filtre `sandbox_session_id`) |
| Play / placement publics | hors tables (Edge) |

---

## 3. Explication sémantique RLS (corrigée)

PostgreSQL : policies **PERMISSIVE** = OU ; **RESTRICTIVE** = ET (en plus d’au moins une permissive).

Lot 0.7 a traité `(IS NULL) OR can_access_sandbox(...)` comme une ouverture **PERMISSIVE** de toutes les lignes prod.  
**Observation distante :** les 6 policies sont **RESTRICTIVE** (`polpermissive=false`). Dans ce mode, l’expression **laisse passer** les lignes prod (`IS NULL`) **à travers le filtre restrictif**, puis les policies métier décident encore qui voit quoi. Elle **bloque** les lignes Sandbox sans `can_access_sandbox`.

→ Ce n’est **pas** une policy permissive qui ouvre toute la prod à tout `authenticated`.

Matrice **baseline** (policies actuelles, transaction ROLLBACK) : **PASS**  
(stranger=0 ; élève/formateur scopés ; autre formateur bloqué sur sandbox ; anon sans GRANT ; service_role OK).

---

## 4. Choix retenu

**DROP** des 6 policies « Sandbox isolation » (idempotent `DROP POLICY IF EXISTS`).

**Justification :**  
1. Mission : préférer la suppression si les policies métier suffisent.  
2. Simulation DROP + matrice (ROLLBACK) : **PASS** — propriétaire/élève/formateur/membre Sandbox / non-membre / anon / service_role inchangés dans les assertions.  
3. Évite de recréer une expression `IS NULL OR …` mal interprétée.  
4. Les chemins Sandbox opérationnels passent déjà par `service_role`.

**Non retenu :** remplacer aveuglément OR→AND (casserait le filtre RESTRICTIVE).  
**Non retenu :** policies Sandbox PERMISSIVES positives seules (hors besoin démontré ; métier suffit).

---

## 5. Diff SQL exact (forward)

Fichier : `supabase/migrations/20260917223000_lot08_confine_sandbox_isolation.sql`

```sql
DROP POLICY IF EXISTS "Sandbox isolation" ON public.groups;
DROP POLICY IF EXISTS "Sandbox isolation" ON public.group_members;
DROP POLICY IF EXISTS "Sandbox isolation" ON public.sessions;
DROP POLICY IF EXISTS "Sandbox isolation" ON public.devoirs;
DROP POLICY IF EXISTS "Sandbox isolation" ON public.resultats;
DROP POLICY IF EXISTS "Sandbox isolation" ON public.profils_eleves;
```

Remote `20260917223000` : **absent** (Phase A). Lots 0.5/0.6 présents.

---

## 6. Matrice avant / après (prévue)

| Acteur | Avant (RESTRICTIVE + métier) | Après DROP (métier seul) |
|---|---|---|
| anon | pas de GRANT | inchangé |
| authenticated stranger | 0 lignes | 0 lignes |
| élève prod | own scope ; pas sandbox d’autrui | idem (prouvé DROP-sim) |
| formateur owner sandbox | own prod + own sandbox | idem |
| autre formateur | pas sandbox d’autrui | idem |
| membre Sandbox | own sandbox via métier | idem |
| non-membre Sandbox | bloqué | idem |
| service_role | lecture ops | inchangé |
| admin UI dédié | N/A (pas de policy admin table) | N/A |

---

## 7. Tests

| Test | Méthode | Résultat Phase A |
|---|---|---|
| Baseline RESTRICTIVE | MCP `execute_sql` BEGIN…ROLLBACK | **PASS** (pas d’EXCEPTION) |
| DROP simulation + matrice | `supabase/tests/lot08_sandbox_isolation.sql` via MCP | **PASS** ; après ROLLBACK residual policies = **6** |
| Asserts locaux | lot07 / bootstrap / prod-bootstrap | **EXIT 0** |
| lot07 SQL remote post-apply | attend residual Sandbox isolation = 0 | **non exécuté en durable** |

---

## 8. Plan de retour arrière

Fichier : `supabase/secours/lot08_sandbox_isolation_rollback_secours.sql`  
Recrée les 6 policies **RESTRICTIVE** (texte = `20260608210000_sandbox_v4.sql`).  
Forward-only : ne pas éditer l’historique ; compensatoire séparée.

**Durée estimée apply Phase B :** &lt; 1 min (6 DROP).  
**Critères d’arrêt Phase B :**  
- residual `Sandbox isolation` ≠ 0 après apply ;  
- régression matrice (stranger / other formateur / eleve) ;  
- compteurs métier dérivés hors tolérance ;  
- apparition d’une policy **PERMISSIVE** `IS NULL OR can_access_sandbox`.

**Risques :** perte du filet RESTRICTIVE défense en profondeur si une future policy métier buggy matche des lignes Sandbox ; mitigation = Edge service_role + revue Lot 2A `TO authenticated`.  
**Urgence close :** **non** tant que non appliqué distant.

---

## 9. Artefacts Phase A / garde-fou

| Artefact | Rôle |
|---|---|
| `supabase/migrations/20260917223000_lot08_confine_sandbox_isolation.sql` | forward |
| `supabase/secours/lot08_sandbox_isolation_rollback_secours.sql` | RA |
| `supabase/tests/lot08_sandbox_isolation.sql` | matrice ROLLBACK |
| `scripts/security/assert-lot07-future-guards.mjs` | exige lot08 + refuse PERMISSIVE open |
| `supabase/tests/lot07_future_guards.sql` | residual=0 + refuse PERMISSIVE open |
| `scripts/security/lot07-remote-evidence.example.json` | schéma post-0.8 |

---

## 10. Commits locaux Phase A

1. `6a5fbb7677ae94b805fcfa8dac400ee75cc7ab29` — `security(lot-0.8): drop Sandbox isolation policies and add rollback tests`  
2. (ce handoff) — `docs(lot-0.8): prepare Sandbox confinement handoff pending remote auth`  

**Push : aucun.**

---

## 11. Mutation distante

**NON RÉALISÉE — en attente autorisation** (phrase §0).

---

*Fin handoff Lot 0.8 Phase A — ARRÊT avant apply distant.*

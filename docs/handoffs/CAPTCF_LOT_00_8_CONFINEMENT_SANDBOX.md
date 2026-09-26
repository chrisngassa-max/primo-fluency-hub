# CAPTCF — LOT 0.8 — Confinement Sandbox authenticated (Phase A — préparation)

**Date UTC :** 2026-09-17T20:39Z → 2026-09-17T20:55Z (approx.)  
**Opérateur :** agent Lot 0.8 (Phase A)  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**HEAD initial attendu / observé :** `43b68ad5` / `43b68ad54019dbf9b504ab7564ff1b68b3a6070f`  
**Cible LECTURE SEULE :** Supabase `gudcenhmzlcvhgbgklzw` (TCF PRO NEW / captcf.fr) — `ACTIVE_HEALTHY`  
**Mutation distante :** **NON RÉALISÉE**  
**Push :** **aucun**

---

## ERRATUM Lot 0.8B (décision finale)

**Phase B est ABANDONNÉE.** Ne pas appliquer la migration DROP.  
Les six policies « Sandbox isolation » **AS RESTRICTIVE** doivent être **conservées**.  
Le diagnostic d’exposition Lot 0.7 était un **faux positif** (confusion PERMISSIVE / RESTRICTIVE).

Voir : `docs/handoffs/CAPTCF_LOT_00_8B_RECTIFICATION_SANDBOX.md`  
- Migration `20260917223000_lot08_confine_sandbox_isolation.sql` : **retirée** du dépôt (jamais appliquée distant).  
- Script secours : marqué **ABANDONED / DO NOT USE**.  
- Urgence Sandbox : **annulée**.

Le reste de ce handoff documente la Phase A historique (préparation DROP) — **ne pas exécuter**.

---

## 0. Point d’arrêt (Phase B) — historique

Aucun `apply_migration`, SQL d’écriture durable, déploiement, push, rotation clé ou suppression de données n’a été exécuté.

~~Phrase d’autorisation requise pour Phase B~~ → **N/A** : Phase B abandonnée (0.8B).

---

## 1. État Git (Phase A)

| Élément | Valeur |
|---|---|
| Branche | `codex-captcf-lot-00-protection-cartographie-20260917` |
| HEAD pré-Phase-A | `43b68ad54019dbf9b504ab7564ff1b68b3a6070f` |
| Projet | `gudcenhmzlcvhgbgklzw` uniquement |
| Fichiers pédagogiques untracked | **préservés** (non stagés) |
| Push | **aucun** |

---

## 2. Inventaire avant (lecture seule) — TOUJOURS VALIDE

### 2.1 Les 6 policies « Sandbox isolation » (à CONSERVER)

| table | policy | permissive | cmd | roles | USING |
|---|---|---|---|---|---|
| groups | Sandbox isolation | **RESTRICTIVE** | SELECT | `{public}` | `(sandbox_session_id IS NULL) OR can_access_sandbox(...)` |
| group_members | Sandbox isolation | **RESTRICTIVE** | SELECT | `{public}` | idem |
| sessions | Sandbox isolation | **RESTRICTIVE** | SELECT | `{public}` | idem |
| devoirs | Sandbox isolation | **RESTRICTIVE** | SELECT | `{public}` | idem |
| resultats | Sandbox isolation | **RESTRICTIVE** | SELECT | `{public}` | idem |
| profils_eleves | Sandbox isolation | **RESTRICTIVE** | SELECT | `{public}` | idem |

`CHECK` : null sur les 6. Origine : `supabase/migrations/20260608210000_sandbox_v4.sql` (`AS RESTRICTIVE`).

### 2.2–2.6

Inchangés (policies métier PERMISSIVES, grants anon=0, volumes, `can_access_sandbox`, parcours Edge service_role) — voir historique Phase A ci-dessous si besoin de chiffres.

### 2.2 Policies métier voisines (PERMISSIVE, rôles `{public}`)

| table | policies métier |
|---|---|
| groups | Eleves view their groups (SELECT) ; Formateurs manage own groups (ALL) |
| group_members | Eleves view own memberships (SELECT) ; Formateurs manage members (ALL) |
| sessions | Eleves view their sessions (SELECT) ; Formateurs manage sessions (ALL) |
| devoirs | Eleves view own devoirs (SELECT) ; Formateurs manage devoirs (ALL) |
| resultats | Eleves view own resultats (SELECT) ; Formateurs view student resultats (SELECT) |
| profils_eleves | Eleves view own profil (SELECT) ; Formateurs view student profils (SELECT) |

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

---

## 3. Explication sémantique RLS (correcte — base de 0.8B)

PostgreSQL : policies **PERMISSIVE** = OU ; **RESTRICTIVE** = ET (en plus d’au moins une permissive).

Lot 0.7 a traité `(IS NULL) OR can_access_sandbox(...)` comme une ouverture **PERMISSIVE** de toutes les lignes prod.  
**Observation distante :** les 6 policies sont **RESTRICTIVE** (`polpermissive=false`). Dans ce mode, l’expression **laisse passer** les lignes prod (`IS NULL`) **à travers le filtre restrictif**, puis les policies métier décident encore qui voit quoi. Elle **bloque** les lignes Sandbox sans `can_access_sandbox`.

→ Ce n’est **pas** une policy permissive qui ouvre toute la prod à tout `authenticated`.  
→ **Aucune exposition Sandbox démontrée.**

Matrice **baseline** (policies actuelles, transaction ROLLBACK) : **PASS**.

---

## 4. Choix Phase A (HISTORIQUE — abandonné en 0.8B)

~~**DROP** des 6 policies~~ → **ANNULÉ**. Conservation des 6 RESTRICTIVE.

Justification de l’abandon (0.8B) :

1. Le DROP n’était motivé que par le faux diagnostic 0.7.  
2. Les policies RESTRICTIVE apportent une défense en profondeur utile.  
3. Risque d’apply accidentel de la migration locale — migration **retirée**.

---

## 5. Diff SQL forward — RETIRÉ

Fichier `supabase/migrations/20260917223000_lot08_confine_sandbox_isolation.sql` : **supprimé** (Lot 0.8B).  
Remote : **jamais** présent / **jamais** appliqué.

---

## 6–8. Matrice / tests / RA — historique Phase A

Simulation DROP + matrice (ROLLBACK) avait passé en Phase A, mais **ne constitue plus un plan d’apply**.  
Secours `supabase/secours/lot08_sandbox_isolation_rollback_secours.sql` : **ABANDONED / DO NOT USE**.

---

## 9. Artefacts (révisé 0.8B)

| Artefact | Rôle |
|---|---|
| ~~migration 20260917223000~~ | **retirée** |
| `supabase/secours/lot08_…_secours.sql` | abandonné (doc only) |
| `supabase/tests/lot08_sandbox_isolation.sql` | assert conservation RESTRICTIVE |
| `scripts/security/assert-lot07-future-guards.mjs` | inventaire typé 6 RESTRICTIVE |
| `supabase/tests/lot07_future_guards.sql` | idem + refuse PERMISSIVE open |

---

## 10. Commits locaux Phase A (historique)

1. `6a5fbb76` — `security(lot-0.8): drop Sandbox isolation policies and add rollback tests`  
2. `c85b47f0` — `docs(lot-0.8): prepare Sandbox confinement handoff pending remote auth`

**Push : aucun.** Suite corrective : commits Lot 0.8B.

---

## 11. Mutation distante

**NON RÉALISÉE — et ne doit plus l’être** (Phase B abandonnée).

---

*Fin handoff Lot 0.8 — erratum 0.8B : Phase B abandonnée ; RESTRICTIVE conservées ; urgence annulée.*

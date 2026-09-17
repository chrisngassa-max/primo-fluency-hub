# CAPTCF — LOT 0.8B — Rectification Sandbox (urgence annulée)

**Date UTC :** 2026-09-17T21:00Z → 2026-09-17T21:20Z (approx.)  
**Opérateur :** agent Lot 0.8B  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**HEAD initial observé :** `400c6bfa272bc5e96ed7b03603418a2aa917c95b` (Lot 1 docs)  
**Mutation distante :** **aucune**  
**Push :** **aucun**  
**Phase B Lot 0.8 :** **ABANDONNÉE — ne pas appliquer**

---

## 1. Décision

| Élément | Décision |
|---|---|
| Migration `20260917223000_lot08_confine_sandbox_isolation.sql` | **retirée** du dossier `supabase/migrations/` (jamais appliquée distant) |
| Six policies « Sandbox isolation » AS RESTRICTIVE | **conservées** en production |
| Critère `sandbox_isolation_open_policies = []` | **remplacé** par inventaire typé |
| Urgence Sandbox (Lot 0.7) | **annulée** (faux diagnostic PERMISSIVE / OR) |

Phrase : **urgence Sandbox annulée : oui**.

---

## 2. Correction sémantique RESTRICTIVE vs PERMISSIVE

PostgreSQL RLS :

- **PERMISSIVE** → OU entre policies → une expression `(sandbox_session_id IS NULL) OR can_access_sandbox(...)` **ouvrirait** les lignes prod à tout rôle couvert.
- **RESTRICTIVE** → ET avec les policies permissives → la **même** expression laisse passer les lignes prod **à travers le filtre restrictif**, puis les policies métier décident encore ; elle **bloque** les lignes Sandbox sans `can_access_sandbox`.

Lot 0.7 a lu l’expression comme une ouverture PERMISSIVE.  
Observation distante (Lot 0.8 Phase A) : les 6 policies sont **RESTRICTIVE** (`polpermissive=false`).  
→ **Aucune exposition Sandbox authentifiée démontrée** sous ce mode.

---

## 3. Inventaire typé attendu

Exactement **6** policies :

| table | policy | cmd | permissive | expression |
|---|---|---|---|---|
| groups | Sandbox isolation | SELECT | RESTRICTIVE | `(sandbox_session_id IS NULL) OR can_access_sandbox(sandbox_session_id)` |
| group_members | Sandbox isolation | SELECT | RESTRICTIVE | idem |
| sessions | Sandbox isolation | SELECT | RESTRICTIVE | idem |
| devoirs | Sandbox isolation | SELECT | RESTRICTIVE | idem |
| resultats | Sandbox isolation | SELECT | RESTRICTIVE | idem |
| profils_eleves | Sandbox isolation | SELECT | RESTRICTIVE | idem |

Champ evidence : `sandbox_isolation_policies` (objets typés).  
Champ obsolète interdit : `sandbox_isolation_open_policies`.

Règles de détection :

1. Policy **PERMISSIVE** contenant `sandbox_session_id IS NULL OR can_access_sandbox(...)` → **BLOQUANT**  
2. Les six RESTRICTIVE conformes → **ACCEPTÉES**  
3. Disparition / conversion PERMISSIVE / expression altérée → **ÉCHEC**

---

## 4. Changements garde-fous / harness

| Artefact | Changement |
|---|---|
| `scripts/security/assert-lot07-future-guards.mjs` | inventaire typé ; refuse DROP migration abandonnée ; refuse PERMISSIVE open |
| `supabase/tests/lot07_future_guards.sql` | assert 6 RESTRICTIVE + expression ; plus « residual=0 » |
| `supabase/tests/lot08_sandbox_isolation.sql` | plus de simulation DROP opérationnelle ; assert conservation |
| `scripts/security/validate-remote-evidence.mjs` | schéma `sandbox_isolation_policies` |
| `scripts/security/run-security-selftest.mjs` | fixtures négatives 0.8B |
| fixtures `evidence-valid` / `permissive` / `missing` / `altered-expr` / `open` (obsolète) | alignées |
| `supabase/secours/lot08_…_secours.sql` | marqué **ABANDONED / DO NOT USE** |
| migration `20260917223000_…` | **retirée** |

---

## 5. Résultats réels

```text
npm run security:check     → EXIT 0 (RESULT: SUCCESS)
npm run security:selftest  → EXIT 0 (10/10 scenarios matched)
```

| Scénario selftest | Attendu | Observé |
|---|---|---|
| local repo | PASS | PASS |
| 6 RESTRICTIVE conformes | PASS | PASS |
| 1 convertie PERMISSIVE | FAIL | FAIL |
| 1 manquante | FAIL | FAIL |
| expression altérée | FAIL | FAIL |
| champ obsolète open_policies | FAIL | FAIL |
| anon grants / stubs / incomplete / bad migration | FAIL | FAIL |

---

## 6. Commits locaux

1. `73224857190cb3ac984eb9f51a112d8fbfe4bc58` — `security(lot-0.8b): abandon Phase B DROP; fix Sandbox RESTRICTIVE guards`  
2. *(ce commit docs)* — `docs(lot-0.8b): rectify Sandbox urgency false positive and handoffs`  
   HEAD final : renseigner après commit 2.

**Push : aucun.**  
**HEAD initial Lot 0.8B :** `400c6bfa272bc5e96ed7b03603418a2aa917c95b`

---

## 7. Verdict

| Critère | Résultat |
|---|---|
| Dépôt local PASS | **oui** |
| Fixtures négatives détectées | **oui** |
| Exposition Sandbox démontrée | **non** |
| Protection RESTRICTIVE conservée | **oui** |
| Urgence Sandbox annulée | **oui** |
| Mutation distante / push | **aucune** |

---

## 8. Risques résiduels (hors Sandbox)

- DEFAULT PRIVILEGES `supabase_admin` → anon sur **futurs** objets `public` (latent ; ticket support)  
- 113 policies `{public}` — hygiène `TO authenticated` (Lot 2A)  
- `has_role` / B2 IPE — hors périmètre  
- Autres Edge `verify_jwt=false` — hors Lot 0.8B  

Confinement **anon** Lots 0.5/0.6 : **maintenu**.

---

## 9. Fichiers changés (lot)

Voir commits §6. Handoffs corrigés : `CAPTCF_LOT_00_7_…`, `CAPTCF_LOT_00_8_…`, `CAPTCF_LOT_01_…`, ce fichier.

---

*Fin handoff Lot 0.8B — urgence Sandbox annulée ; aucune mutation distante.*

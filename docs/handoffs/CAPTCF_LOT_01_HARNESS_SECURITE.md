# CAPTCF — LOT 1 — Banc de tests reproductible de sécurité

**Date UTC :** 2026-09-17T20:48Z → 2026-09-17T21:05Z (approx.)  
**Opérateur :** agent Lot 1  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**HEAD initial attendu (mission) :** `43b68ad5`  
**HEAD initial observé (ne pas revenir en arrière) :** `c85b47f033038a0c537f6457406a51f0162d3691`  
**Raison écart :** Lot 0.8 Phase A déjà commitée (`6a5fbb76`, `c85b47f0`) — avancées Lot 0.x uniquement ; mission poursuivie.  
**Mutation distante :** **aucune**  
**Push :** **aucun**  
**Supabase MCP :** non utilisé (fixtures locales suffisantes)

---

## 1. État Git

| Élément | Valeur |
|---|---|
| Branche | `codex-captcf-lot-00-protection-cartographie-20260917` |
| SHA initial réel | `c85b47f033038a0c537f6457406a51f0162d3691` |
| Commit 1 (harness) | `0de0cecfa1eee249d2dad2f4fd58922acdc86555` |
| Commit 2 / HEAD final | voir §11 (`docs(lot-1): …`) |
| Fichiers pédagogiques untracked | **préservés** (non stagés) |
| Push | **aucun** |

---

## 2. Inventaire réutilisé (pas de duplication)

| Artefact existant | Rôle | Orchestré par Lot 1 |
|---|---|---|
| `scripts/security/assert-lot07-future-guards.mjs` | local + evidence (anon, stubs, sandbox residual, migrations post-lot06) | oui |
| `scripts/security/assert-no-insecure-account-bootstraps.mjs` | Lot 0.6 stubs + lot06 migration | oui |
| `scripts/security/assert-no-prod-bootstrap.mjs` | Lot 0.5 bootstrap | oui |
| `scripts/security/lot07-remote-evidence.example.json` | schéma evidence | réutilisé / complété |
| `supabase/tests/lot05_placement_rls_refusal.sql` | SQL ROLLBACK | import résultats seulement |
| `supabase/tests/lot06_anon_privileges_refusal.sql` | SQL ROLLBACK | import résultats seulement |
| `supabase/tests/lot07_future_guards.sql` | SQL ROLLBACK + residual Sandbox=0 | import résultats seulement |
| `supabase/tests/lot08_sandbox_isolation.sql` | matrice Sandbox ROLLBACK | import résultats seulement |
| `docs/security/REGLE_CONTRIBUTION_TABLES.md` | règle contrib | pointe vers `npm run security:check` |
| CI GitHub | `curriculum-worker.yml` uniquement | **non** étendu (hors périmètre) |

**Nouveau (Lot 1) :** orchestrateur, validateur schéma evidence, fixtures, selftest, format import SQL, scripts npm.

---

## 3. Architecture minimale du harness

```
npm run security:check
        │
        ├─ A) LOCAL (toujours, sans secret)
        │     assert-lot07-future-guards.mjs
        │     assert-no-insecure-account-bootstraps.mjs
        │     assert-no-prod-bootstrap.mjs
        │
        ├─ B) EVIDENCE (si --evidence <json> expurgé)
        │     validate-remote-evidence.mjs  (± --strict-evidence)
        │     assert-lot07-future-guards.mjs --evidence …
        │       → détecte 6 policies Sandbox résiduelles (fail-closed Lot 0.7/0.8)
        │       → anon grants, stubs verify_jwt, permissive policies
        │
        └─ C) SQL (si --sql-results <json> importé)
              jamais d’auto-connexion distante
              lot05 / lot06 / lot07 / lot08 → pass|fail|not_run
```

**Couches de résultat :** `pass` | `fail` (bloquant) | `warn` | `not_tested` | `env_error`.

**Codes sortie stables :**

| Code | Signification |
|---:|---|
| **0** | succès — aucun échec bloquant (warnings / not_tested OK) |
| **1** | échec sécurité bloquant |
| **2** | erreur environnement (fichier manquant, JSON invalide, **spawn EPERM**, etc.) — **ne pas** confondre avec un test réussi |

---

## 4. Commandes exactes (Windows / PowerShell)

### Prérequis

- Node.js (testé : `v24.14.1`)
- Dépôt à la racine du projet
- **Aucun** secret pour les contrôles locaux
- Preuves distantes : fichier JSON **expurgé** sous `.local-security-evidence/` (gitignored)

### Commande rapide (local)

```powershell
cd "D:\sites\tcf pro"
npm run security:check
# équivalent :
node scripts/security/run-security-check.mjs
```

### Avec preuves distantes expurgées

```powershell
# 1) Copier/adapter le template (sans clés)
Copy-Item scripts\security\lot07-remote-evidence.example.json .local-security-evidence\remote.json
# 2) Remplir les compteurs / listes depuis SQL lecture seule ou MCP SELECT
# 3) Lancer :
npm run security:check -- --evidence .local-security-evidence\remote.json
```

### Validation schéma seule

```powershell
npm run security:validate-evidence -- --strict .local-security-evidence\remote.json
```

### Import résultats SQL transactionnels (ROLLBACK manuel)

```powershell
Copy-Item scripts\security\sql-results.example.json .local-security-evidence\sql-results.json
# Après exécution BEGIN…ROLLBACK des fichiers supabase/tests/lot0*.sql :
npm run security:check -- --sql-results .local-security-evidence\sql-results.json
```

### Self-test fixtures (négatifs = succès du scénario)

```powershell
npm run security:selftest
```

### Rapport JSON optionnel

```powershell
npm run security:check -- --json-report .local-security-evidence\lot01-report.json
```

---

## 5. Matrice scénarios — résultats réellement obtenus

Exécuté le 2026-09-17 sur HEAD `c85b47f0…` (pré-commits Lot 1) / artefacts Lot 1 locaux.

| Scénario | Attendu | Observé | Verdict scénario |
|---|---|---|---|
| Dépôt local `security:check` | exit **0** | exit **0** (3 PASS local ; evidence/SQL NOT_TESTED) | **PASS** |
| Fixture `evidence-valid.json` | exit **0** | exit **0** | **PASS** |
| Fixture `evidence-sandbox-open.json` (6 Sandbox Lot 0.7) | exit **1** + message residual | exit **1** ; `residual Sandbox isolation policies (6)` | **PASS** (échec attendu) |
| Fixture `evidence-anon-grants.json` | exit **1** | exit **1** | **PASS** (échec attendu) |
| Fixture `evidence-stub-unprotected.json` | exit **1** | exit **1** | **PASS** (échec attendu) |
| Fixture `evidence-incomplete.json` + `--strict-evidence` | exit **1** | exit **1** ; missing required fields | **PASS** (échec attendu) |
| Migration temporaire CREATE TABLE sans REVOKE/GRANT/TO | exit **1** | exit **1** ; fichier retiré après test | **PASS** (échec attendu) |
| `npm run security:selftest` global | exit **0** | **7/7** matched, exit **0** | **PASS** |

**Preuve style Lot 0.7 Sandbox : FAIL attendu confirmé = OUI.**

**Dépôt local check : PASS.**

---

## 6. Interprétation

| Sortie | Action |
|---|---|
| exit 0 + local PASS | OK pour merge local / contribution tables |
| exit 1 sur evidence avec `Sandbox isolation (6)` | état pré-Lot-0.8 remote — **attendu** jusqu’à Phase B autorisée |
| exit 1 sur anon / stubs | régression confinement — bloquer |
| exit 2 | corriger environnement ; **ne pas** déclarer les contrôles « verts » |

Warnings latents `supabase_admin` DEFAULT PRIVILEGES : informatifs (ticket support), non bloquants côté harness local.

---

## 7. Dépannage spawn EPERM (déjà observé sous sandbox Cursor)

Si le harness affiche `spawn EPERM` / exit **2** :

1. Relancer dans un PowerShell **hors** sandbox agent :  
   `node scripts/security/run-security-check.mjs`
2. Vérifier qu’un antivirus / Controlled Folder Access ne bloque pas les enfants de `node.exe`.
3. Session : `Set-ExecutionPolicy -Scope Process RemoteSigned` si la politique empêche npm.
4. Contournement : exécuter les asserts un par un (mêmes scripts) — le harness documente la commande exacte en cas d’EPERM.
5. **Ne jamais** traiter exit 2 comme succès de sécurité.

---

## 8. Limites et dépendances environnement

- Pas de connexion Supabase automatique ; pas de lecture de clés.
- Couche SQL = **manuelle** + import JSON ; tant que non importée → `not_tested` (pas un faux vert).
- Residual Sandbox : evidence / SQL lot07 échouent tant que Lot 0.8 non appliqué distant (fail-closed volontaire).
- Les 6 policies distantes sont **RESTRICTIVE** (Lot 0.8) ; le harness les signale comme résiduelles à DROP après autorisation — aligné handoff 0.8.
- CI GitHub non modifiée.
- Aucune correction de policies / `has_role` / B2 / lint global.

---

## 9. Fichiers changés

### Commit 1 — harness / code / tests / fixtures

- `package.json` — scripts `security:check`, `security:selftest`, `security:check:evidence`, `security:validate-evidence`
- `scripts/security/run-security-check.mjs`
- `scripts/security/run-security-selftest.mjs`
- `scripts/security/validate-remote-evidence.mjs`
- `scripts/security/sql-results.example.json`
- `scripts/security/fixtures/evidence-valid.json`
- `scripts/security/fixtures/evidence-sandbox-open.json`
- `scripts/security/fixtures/evidence-anon-grants.json`
- `scripts/security/fixtures/evidence-stub-unprotected.json`
- `scripts/security/fixtures/evidence-incomplete.json`
- `scripts/security/fixtures/bad-migration-create-table.sql`

### Commit 2 — documentation

- `docs/handoffs/CAPTCF_LOT_01_HARNESS_SECURITE.md` (ce fichier)
- `docs/security/REGLE_CONTRIBUTION_TABLES.md` (pointeur npm)

---

## 10. Transfert Lot 0.8 / 2A

| Vers | Élément |
|---|---|
| **Lot 0.8 Phase B** | Après apply distant : rejouer `security:check -- --evidence …` → `sandbox_isolation_open_policies` doit être `[]` (exit 0 côté evidence). Importer SQL `lot07` + `lot08` via `--sql-results`. |
| **Lot 2A** | Harness prêt pour preuves policies `{public}` / `TO authenticated` ; étendre evidence JSON si besoin sans casser le schéma actuel. Ne pas rouvrir GRANT anon. |
| Coordinateur | Commande unique locale documentée ; négatifs fixtures prouvés ; dépôt PASS ; Sandbox Lot 0.7 FAIL confirmé. |

---

## 11. Commits locaux

1. `0de0cecf` — `security(lot-1): add reproducible security check harness and fixtures`  
2. *(ce commit)* — `docs(lot-1): record security harness handoff and commands`  

**Pas de push.**

---

*Fin handoff Lot 1 — banc de tests reproductible prêt ; aucune mutation distante.*

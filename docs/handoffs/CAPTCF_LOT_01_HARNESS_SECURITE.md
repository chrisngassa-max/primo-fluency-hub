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

**Erratum Lot 0.8B :** le harness n’exige plus `sandbox_isolation_open_policies = []`.  
Il vérifie un **inventaire typé** de **6 policies RESTRICTIVE** « Sandbox isolation ».  
Phase B DROP abandonnée ; urgence Sandbox annulée. Voir `CAPTCF_LOT_00_8B_RECTIFICATION_SANDBOX.md`.

---

## 1. État Git

| Élément | Valeur |
|---|---|
| Branche | `codex-captcf-lot-00-protection-cartographie-20260917` |
| SHA initial réel | `c85b47f033038a0c537f6457406a51f0162d3691` |
| Commit 1 (harness) | `0de0cecfa1eee249d2dad2f4fd58922acdc86555` |
| Commit 2 | `400c6bfa` — `docs(lot-1): record security harness handoff and commands` |
| Alignement 0.8B | commits `security(lot-0.8b): …` + `docs(lot-0.8b): …` |
| Fichiers pédagogiques untracked | **préservés** (non stagés) |
| Push | **aucun** |

---

## 2. Inventaire réutilisé (pas de duplication)

| Artefact existant | Rôle | Orchestré par Lot 1 |
|---|---|---|
| `scripts/security/assert-lot07-future-guards.mjs` | local + evidence (anon, stubs, **inventaire Sandbox RESTRICTIVE**, migrations) | oui (corrigé 0.8B) |
| `scripts/security/assert-no-insecure-account-bootstraps.mjs` | Lot 0.6 stubs + lot06 migration | oui |
| `scripts/security/assert-no-prod-bootstrap.mjs` | Lot 0.5 bootstrap | oui |
| `scripts/security/lot07-remote-evidence.example.json` | schéma evidence typé | oui |
| `supabase/tests/lot05_*.sql` / `lot06_*.sql` / `lot07_*.sql` / `lot08_*.sql` | SQL ROLLBACK | import résultats seulement |
| `docs/security/REGLE_CONTRIBUTION_TABLES.md` | règle contrib | pointe vers `npm run security:check` |

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
        │       → inventaire typé 6 RESTRICTIVE Sandbox (PASS si conforme)
        │       → FAIL si PERMISSIVE / manquante / expression altérée
        │       → anon grants, stubs verify_jwt
        │
        └─ C) SQL (si --sql-results <json> importé)
              jamais d’auto-connexion distante
              lot05 / lot06 / lot07 / lot08 → pass|fail|not_run
```

**Codes sortie stables :** 0 succès · 1 échec sécurité · 2 erreur environnement.

---

## 4. Commandes exactes (Windows / PowerShell)

```powershell
cd "D:\sites\tcf pro"
npm run security:check
npm run security:selftest
npm run security:check -- --evidence .local-security-evidence\remote.json
```

Template evidence : `scripts/security/lot07-remote-evidence.example.json`  
Champ requis : `sandbox_isolation_policies` (objets typés).  
Champ **interdit** : `sandbox_isolation_open_policies`.

---

## 5. Matrice scénarios — Lot 1 d’origine + alignement 0.8B

### Lot 1 (historique, HEAD `c85b47f0` / artefacts Lot 1)

| Scénario | Verdict |
|---|---|
| Dépôt local `security:check` | PASS |
| Selftest global | PASS (7/7 à l’époque) |

### Lot 0.8B (rejeu réel)

| Scénario | Attendu | Observé |
|---|---|---|
| `npm run security:check` | exit 0 | **exit 0** |
| `npm run security:selftest` | exit 0 | **10/10** |
| Fixture 6 RESTRICTIVE | PASS | PASS |
| Fixture 1 PERMISSIVE | FAIL | FAIL |
| Fixture 1 manquante | FAIL | FAIL |
| Fixture expression altérée | FAIL | FAIL |
| Fixture champ obsolète open_policies | FAIL | FAIL |

**Preuve :** dépôt local PASS ; négatifs correctement détectés ; **aucune exposition Sandbox démontrée**.

---

## 6. Interprétation (révisée 0.8B)

| Sortie | Action |
|---|---|
| exit 0 + local PASS | OK |
| exit 1 sur inventaire Sandbox (PERMISSIVE / missing / altered) | régression réelle — bloquer |
| exit 1 sur anon / stubs | régression confinement — bloquer |
| exit 2 | corriger environnement ; **ne pas** déclarer vert |
| ~~exit 1 parce que 6 Sandbox présentes~~ | **obsolète** — présence RESTRICTIVE = attendu |

Warnings latents `supabase_admin` DEFAULT PRIVILEGES : informatifs, non bloquants.

---

## 7. Dépannage spawn EPERM

Inchangé : relancer hors sandbox agent ; ne jamais traiter exit 2 comme succès.

---

## 8. Limites

- Pas de connexion Supabase automatique.  
- Couche SQL = manuelle + import JSON.  
- Les 6 policies RESTRICTIVE sont **attendues** (défense en profondeur).  
- Phase B DROP **abandonnée** — ne pas réintroduire la migration.  
- CI GitHub non modifiée.  
- Aucune correction `has_role` / B2.

---

## 9. Fichiers changés (Lot 1)

Commit harness + docs Lot 1 (voir §1). Alignement fixtures/schéma : Lot 0.8B.

---

## 10. Transfert

| Vers | Élément |
|---|---|
| **Lot 0.8B** | Rectification faite — urgence Sandbox annulée |
| **Lot 2A** | Hygiène `{public}` / `TO authenticated` ; **ne pas** DROP Sandbox RESTRICTIVE ; ne pas rouvrir GRANT anon |
| Coordinateur | `security:check` / `security:selftest` PASS local |

---

## 11. Commits locaux Lot 1

1. `0de0cecf` — `security(lot-1): add reproducible security check harness and fixtures`  
2. `400c6bfa` — `docs(lot-1): record security harness handoff and commands`  

**Pas de push.**

---

*Fin handoff Lot 1 — erratum 0.8B : inventaire RESTRICTIVE ; urgence Sandbox annulée.*

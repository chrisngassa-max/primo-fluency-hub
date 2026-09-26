# CAPTCF — LOT 3A PHASE B — Déploiement B2 (readiness_config + compute-readiness)

**Date :** 2026-09-24  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**Commit source Edge :** `b4dda50c` (`fix(ipe): require B2 for naturalisation under 2026 IRN rules`)  
**Projet :** `gudcenhmzlcvhgbgklzw` uniquement  
**Push :** **aucun**  
**Preuves :** `.local-security-evidence/lot3a-phaseb-b2-2026-09-24/` (gitignored)

Autorisation propriétaire respectée : sync `readiness_config` naturalisation=B2 ; deploy **uniquement** `compute-readiness` ; **0** recalcul verdict ; **0** modif profil/résultat ; aucune autre migration/policy/fonction.

---

## 1. Préflight (lecture seule)

| Contrôle | Résultat |
|---|---|
| Branche / `b4dda50c` ancestor | OK |
| `readiness_config` active | algo_version **1**, id `813df1d0-…` |
| Objectifs avant | A2=« Carte de résident » ; B1=« Naturalisation » ; **pas de B2** |
| Snapshots | **0** |
| `compute-readiness` | version **3**, `verify_jwt=true`, sha `335d6430…` |
| Diff Edge local vs remote | limité à B2 (objectif/resolve/config) — **OK pour déployer** |

Sauvegarde hors Git : config préflight brute + méta Edge + SQL compensatoire `RA-restore-readiness_config-preflight.sql`.

---

## 2. Config avant / après

| Objectif | Avant | Après |
|---|---|---|
| A2 | Carte de résident (4) | **Carte de séjour pluriannuelle** (4) |
| B1 | Naturalisation (7) | **Carte de résident** (7) |
| B2 | absent | **Naturalisation** (10) |

Seuils B2 ajoutés (fragile 70, maîtrise/structures 70, priorites_B2). Bands / poids compétences inchangés (ex. pret.min=85, CO=0.25).

---

## 3. Migration

| Champ | Valeur |
|---|---|
| Fichier local | `supabase/migrations/20260924201358_readiness_config_naturalisation_b2.sql` |
| Version remote appliquée | **`20260924201358`** / `readiness_config_naturalisation_b2` |
| Nature | UPDATE jsonb `readiness_config` seulement ; garde préflight ; idempotente si déjà B2 |
| RA | `RA-restore-readiness_config-preflight.sql` (manuel, hors auto-apply) |

Post-contrôle SELECT : objectifs A2/B1/B2 correctes ; snapshots toujours **0**.

---

## 4. Edge `compute-readiness`

| | Avant | Après |
|---|---|---|
| Version | **3** | **4** |
| verify_jwt | **true** | **true** (inchangé) |
| Contenu | nat→B1, Objectif A2\|B1 | nat→**B2**, Objectif A2\|B1\|**B2**, config B2 |
| Déploiement | — | `npx supabase functions deploy compute-readiness --project-ref gudcenhmzlcvhgbgklzw --use-api` depuis code local = `b4dda50c` |
| sha après | — | `e31e7c48aca718c1c92b1260ff915b7007a2d9acc1de6d0a1312bab8472e4e51` |

Aucune autre fonction déployée. Secrets/vars inchangés.

---

## 5. Tests

| Test | Résultat |
|---|---|
| Vitest ciblé B2 (15) | **pass** |
| `npm run build` | **OK** |
| Distant A2/B1/B2 | **confirmé** (SELECT) |
| Smoke invoke naturalisation | **non réalisé** — l’Edge **écrit** des snapshots ; interdit par autorisation (« ne recalculer aucun ancien verdict » / pas d’écriture). Consigne : smoke manuel formateur ultérieur avec élève test + autorisation écriture. |

---

## 6. Verdicts recalculés

**Non.** `readiness_snapshots` = **0** avant et après. Aucun `compute-readiness` invoqué. Aucun profil/résultat modifié.

---

## 7. Git

- Migration locale alignée version remote `20260924201358`.  
- Handoff Phase B (ce fichier).  
- Commit documentaire local Phase B : `01505c1a`.  
- **Aucun push.**

---

## 8. Limites / non réalisés

- Smoke runtime Edge sans écriture : impossible (insert snapshots).  
- Pas de redéploiement `tcf-evaluate-answer` / `tcf-generate-exercise` (hors autorisation).  
- Front déjà B2 depuis lot 3A ; DB + Edge maintenant alignés.

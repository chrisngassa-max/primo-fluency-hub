# CAPTCF — LOT 2A-A2 PHASE B — Déploiement Edge `has_role`

**Date UTC :** 2026-09-18 (Phase B)  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**Commit source obligatoire :** `dc1aeb3dfdbc81630698aff69c50e4c15c716865`  
**Projet distant :** `gudcenhmzlcvhgbgklzw` uniquement  
**Push :** **aucun**  
**Migrations / policies / has_role SQL :** **inchangés** (interdits respectés)

Références : `CAPTCF_LOT_02A_A2_PREFLIGHT_EDGE_HAS_ROLE.md`, preuves gitignored `.local-security-evidence/lot2a-a2-phaseb-2026-09-18/`.

---

## 1. Résultat par fonction

| Fonction | Version avant → après | verify_jwt | has_role distant | Statut |
|---|---|---|---|---|
| `approve-student` | **9 → 10** | `false` (inchangé) | `uid` / `target_role` | **OK** |
| `create-student` | **11 → 12** | `true` | `uid` / `target_role` | **OK** (remote dump + patch has_role only ; pas de drift MDP) |
| `reset-student-password` | **11 → 12** | `true` | `uid` / `target_role` | **OK** (remote + patch) |
| `update-student-credentials` | **6 → 7** | `true` | `uid` / `target_role` | **OK** (remote + patch) |
| `curriculum-batch` | **5 → 8** | `true` | `uid` / `target_role` | **OK** après RA |
| `curriculum-adapt` | **1 → 1** | `true` | **encore legacy** `_user_id` / `_role` | **KO / non déployé** |

---

## 2. RA `curriculum-batch` (PLACEHOLDER)

1. Deploy accidentel **v6** avec corps littéral `PLACEHOLDER` → STOP série.  
2. Rollback immédiat **v7** = dump distant préflight (legacy `has_role`, corps réel).  
3. Redeploy forward **v8** = dump distant + **uniquement** 2 lignes `_user_id/_role` → `uid/target_role` (diff vérifié = 2 lignes).  
4. Post-contrôle : `get_edge_function` confirme `uid`/`target_role`, pas de `PLACEHOLDER`, `verify_jwt=true`.

Preuves : `.local-security-evidence/lot2a-a2-phaseb-2026-09-18/deploy-payloads/curriculum-batch-ROLLBACK/`, `curriculum-batch/`.

---

## 3. `curriculum-adapt` — bloqué (payload SAFE prêt)

### 3.1 Parasite détecté (non déployé)

Le payload préparé initial (`deploy-payloads/curriculum-adapt/`) contenait un drift **hors autorisation** :

- `triggered_by_user_id` → `triggered_byuid` (remplacement naïf `_user_id` → `uid`)

**Aucun déploiement** de ce payload.

### 3.2 Payload SAFE (gitignored)

Chemin : `.local-security-evidence/lot2a-a2-phaseb-2026-09-18/deploy-payloads/curriculum-adapt-SAFE/`

- Base = dump remote v1 (`functions/curriculum-adapt/index.ts` + 4× `functions/_shared/*`)  
- Diff index = **exactement 2 lignes** has_role  
- `triggered_by_user_id` conservé  
- `entrypoint_path` = `functions/curriculum-adapt/index.ts`  
- `verify_jwt` = `true`  
- Bundle ~45 KB / 5 fichiers  

### 3.3 Cause du non-déploiement autonome

`deploy_edge_function` MCP exige les **5 fichiers** (remplacement complet du bundle). La taille du payload (~45 KB) a empêché un `CallDynamicTool` fiable dans cette session sans risque de troncature (leçon PLACEHOLDER).  

**Action suivante recommandée :** déployer uniquement `curriculum-adapt` depuis `curriculum-adapt-SAFE/_mcp-deploy-args.json` (ou équivalent LF), puis `get_edge_function` pour confirmer `uid`/`target_role` et absence de `triggered_byuid`.

---

## 4. Contrôles post-série

| Contrôle | Résultat |
|---|---|
| `assert-lot2a-has-role-callers --strict` (local) | **SUCCESS** (`legacy=0`, `canonical=18`) |
| Smokes formateur authentifiés | **non testables** (pas de credentials formateur dans la session ; aucun compte créé) |
| Logs PostgREST `has_role` (lecture seule) | `query_logs` backend error / indisponible au moment du contrôle — **non concluant** |
| Fonctions hors périmètre | non touchées (pas de 7ᵉ deploy) |
| Policies / migrations / données | non mutées |

---

## 5. Interdits — confirmation

- Pas de `apply_migration` / SQL schema  
- Pas de modification policy / `has_role` côté base  
- Pas de push Git  
- Pas de rotation de clé  
- Pas de correction annexe (MDP drift volontairement hors scope)  
- Pas de 7ᵉ fonction  

---

## 6. Commits locaux

| SHA | Message |
|---|---|
| `dc1aeb3dfdbc81630698aff69c50e4c15c716865` | source A2 (has_role callers) — préflight |
| *(ce handoff)* | `docs(lot-2a-a2): Phase B Edge has_role deploy report` |

Preuves distantes / dumps : **gitignored** sous `.local-security-evidence/lot2a-a2-phaseb-2026-09-18/` (référencées, non commitables).

---

## 7. Verdict coordinateur

**5/6 OK** en prod sur `gudcenhmzlcvhgbgklzw`.  
**1/6 (`curriculum-adapt`) encore legacy** — payload SAFE prêt, parasite évité, RA batch terminé.  
Lot A2 Phase B : **partiel** — clôturable dès deploy SAFE de `curriculum-adapt` seul.

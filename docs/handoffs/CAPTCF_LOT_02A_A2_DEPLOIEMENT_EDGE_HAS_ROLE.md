# CAPTCF — LOT 2A-A2 PHASE B — Déploiement Edge `has_role`

**Date UTC :** 2026-09-18 (Phase B) — reprise PC maison (clôture `curriculum-adapt`)  
**Dépôt retenu :** `D:\sites\tcf pro` (seul candidat avec commit `dc1aeb3d…` + preuves A2 + handoff préflight)  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**HEAD au moment de la clôture :** *(commit doc ci-dessous)*  
**Commit source obligatoire :** `dc1aeb3dfdbc81630698aff69c50e4c15c716865`  
**Projet distant :** `gudcenhmzlcvhgbgklzw` uniquement  
**Push :** **aucun**  
**Migrations / policies / has_role SQL :** **inchangés** (interdits respectés)

Références : `CAPTCF_LOT_02A_A2_PREFLIGHT_EDGE_HAS_ROLE.md`, preuves gitignored `.local-security-evidence/lot2a-a2-phaseb-2026-09-18/`.

---

## 0. Sélection dépôt (reprise PC maison)

| Critère | Résultat |
|---|---|
| Commit `dc1aeb3dfdbc81630698aff69c50e4c15c716865` | **présent** (seul dépôt trouvé) |
| Commit `c921d866e21ee80fe02eed2525c6475bd13b6b0e` | **présent** |
| Branche attendue | **oui** |
| Preuves `.local-security-evidence/lot2a-a2-preflight-2026-09-18/` | **oui** |
| Handoff préflight A2 | **oui** |
| Classium / autres clones | **sans** le commit cible → ignorés |
| Workspace Cursor | déjà `D:\sites\tcf pro` → pas de `move_agent_to_root` |

---

## 1. Résultat par fonction

| Fonction | Version avant → après | verify_jwt | has_role distant | Statut |
|---|---|---|---|---|
| `approve-student` | **9 → 10** | `false` (inchangé) | `uid` / `target_role` | **OK** |
| `create-student` | **11 → 12** | `true` | `uid` / `target_role` | **OK** (remote dump + patch has_role only ; pas de drift MDP) |
| `reset-student-password` | **11 → 12** | `true` | `uid` / `target_role` | **OK** (remote + patch) |
| `update-student-credentials` | **6 → 7** | `true` | `uid` / `target_role` | **OK** (remote + patch) |
| `curriculum-batch` | **5 → 8** | `true` | `uid` / `target_role` | **OK** après RA |
| `curriculum-adapt` | **1 → 2** | `true` | `uid` / `target_role` | **OK** (SAFE, clôture reprise) |

Signature SQL remote revalidée : `has_role(uid uuid, target_role app_role)`.

---

## 2. RA `curriculum-batch` (historique session précédente)

1. Deploy accidentel **v6** avec corps littéral `PLACEHOLDER` → STOP série.  
2. Rollback immédiat **v7** = dump distant préflight (legacy `has_role`, corps réel).  
3. Redeploy forward **v8** = dump distant + **uniquement** 2 lignes `_user_id/_role` → `uid/target_role` (diff vérifié = 2 lignes).  
4. Post-contrôle : `get_edge_function` confirme `uid`/`target_role`, pas de `PLACEHOLDER`, `verify_jwt=true`.

---

## 3. `curriculum-adapt` — clôturé (reprise PC maison)

### 3.1 Historique bloquant (session antérieure)

- Payload parasite `triggered_byuid` **jamais déployé**.  
- Payload SAFE (remote + 2 renames has_role, `triggered_by_user_id` conservé) prêt mais MCP ~45 KB bloqué.

### 3.2 Clôture

1. Restauration SAFE depuis backup `agent-tools/curriculum-adapt-deploy-call.json` (après wipe accidentel du dossier SAFE lors d’un prep raté argv).  
2. Gate : `legacyRpc=false`, `canonRpc=true`, `parasite=false`, `triggered_by_user_id=true`, 5 fichiers.  
3. Deploy isolé TEMP via `npx supabase functions deploy curriculum-adapt --project-ref gudcenhmzlcvhgbgklzw` (pas le working tree local brut).  
4. Post-contrôle `list_edge_functions` / `get_edge_function` : **version 2**, `verify_jwt=true`, 5 fichiers, `uid`/`target_role`, pas de `triggered_byuid`.

---

## 4. Contrôles post-série

| Contrôle | Résultat |
|---|---|
| `assert-lot2a-has-role-callers --strict` (local) | **SUCCESS** (`legacy=0`, `canonical=18`) |
| Selftest Lot 1 / 0.8B | **SELFTEST SUCCESS** 12/12 |
| Smokes formateur authentifiés | **non testables** (pas de credentials formateur ; aucun compte créé) |
| Logs PostgREST / edge `has_role` | `query_logs` vide sur fenêtre consultée — **non concluant** |
| Fonctions hors périmètre | non touchées (pas de 7ᵉ deploy) |
| Policies / migrations / données / clés | non mutées |

---

## 5. Interdits — confirmation

- Pas de `apply_migration` / SQL schema  
- Pas de modification policy / `has_role` côté base  
- Pas de push Git  
- Pas de rotation de clé  
- Pas de correction annexe MDP (drift volontairement hors scope)  
- Pas de 7ᵉ fonction  

---

## 6. Commits locaux

| SHA | Message |
|---|---|
| `dc1aeb3dfdbc81630698aff69c50e4c15c716865` | source A2 (has_role callers) |
| `5350dd27…` | rapport Phase B partiel (5/6) |
| *(ce handoff)* | clôture Phase B 6/6 (adapt v2) |

Preuves distantes / dumps : **gitignored** sous `.local-security-evidence/lot2a-a2-phaseb-2026-09-18/`.

---

## 7. Verdict coordinateur

**6/6 OK** en prod sur `gudcenhmzlcvhgbgklzw` (réussite **technique**).  
Smokes formateur : **non réalisés** → pas de preuve fonctionnelle live.  
Décision : **réussite technique / validation fonctionnelle partielle (smokes manquants)**.
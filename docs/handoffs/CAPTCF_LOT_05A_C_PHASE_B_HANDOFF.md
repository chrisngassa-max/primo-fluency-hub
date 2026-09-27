# CAPTCF — LOT 5A-C — Phase B (pilote Louise)

**Date :** 2026-09-27  
**Branche :** `captcf-lot-05a-c-correctif-borne`  
**Projet :** `gudcenhmzlcvhgbgklzw`  
**Source :** `4a0e8321-9ece-42d7-bf76-8825b1e65e79` (Louise musique et ville)  
**Séance :** `e925a8ec-9539-473c-9902-eef1790f1a15`  
**Commit code plafond ≤6 :** `3d913a77ed318718cd33e42bb7089375ca4b7a9f` (`fix(lot-05a-c): cap generated variants at six items`)  
**Correspondance Edge :** ce SHA est le correctif local déployé en **`generate-differentiation-family` v25**

## Verdict

Phase B **OK** pour le pilote Louise uniquement. Faits scellés partagés, plafond ≤6 items, publication + liaison séance. Aucun autre MP3, aucune migration, aucun push/PR.

## Edges

| Fonction | Version | verify_jwt |
|---|---|---|
| `generate-differentiation-family` | **v25** (CLI = SHA `3d913a77…`) | true |
| `publish-differentiation-family` | v14 (inchangé) | true |

Smokes anonymes post-deploy generate : **401 / 401** (`AUTH_INVALID`), sans `WORKER_ERROR`.

## Correctif runtime (generate v25 = SHA `3d913a77…`)

- Consigne modèle : `resolveCorrectifPromptItemBounds` (B1 5–6 au lieu de 5–7).
- Avant persistance : `finalizeVariantItemsForPersist` tronque à 6 puis garde-fou `VARIANT_ITEM_CAP_EXCEEDED`.
- Tests : `src/test/lot05a-c-correctif.test.ts` (7 tests).

## Familles Louise (correctif_05a_c)

`facts_hash` commun : `sha256:4fd8d5565ba8cedeb8fa0d9bbf20451dece02b4c83157f4303433398ba03f5a5` (29 faits).

| Niveau | family_id | items | exercise_id | session_exercices |
|---|---|---|---|---|
| A1 | `2cc5ed11-6ae2-4d22-9688-3a65499f3e1d` | 4 | `62b06150-7942-4c41-bab9-fdba0a4d852c` | ordre 34 |
| A2 | `d0f40bb6-2348-4c3c-aa49-a2cdf0cb3549` | 6 | `972e14a8-9fe1-4f3d-93d1-9a8280028c91` | ordre 35 |
| B1 | `1edad20f-7c60-4c39-8e8b-1087bf92ffa1` | 6 | `bcbcef25-7dcf-4e35-97dd-1fb641ab9815` | ordre 36 |
| B2 | `1b28232a-44bf-4956-bdc4-b314e6badcf7` | 5 | `cb06e39a-e914-4729-8ce4-893e7f8faeaf` | ordre 37 |

Archive failed (conservée) : `445a67a9-c68b-4894-9661-cb4866967392` — `VARIANT_ITEM_CAP_EXCEEDED` (7>6) avant redeploy v25.

Liaison : `session_id=e925a8ec-9539-473c-9902-eef1790f1a15`, `statut=planifie`, `bloc=core` (contrainte DB ; `curriculum` refusé par check).

## Opérations / sécurité

- Formateurs smoke temporaires créés puis **bannis** ; sessions/refresh révoqués.
- Ownership source restauré vers le propriétaire d’origine Lot 5A.
- Aucun secret dans ce handoff ni dans les preuves versionnées.
- Preuves locales gitignored : `.local-security-evidence/lot05a-c-phase-b/`.

## Hors périmètre (respecté)

- Pas d’autre Edge redéployée  
- Pas d’autre MP3  
- Pas de migration / ADR / STT  
- Pas de push / PR  

## Suite éventuelle

Aligner `session-exercice-link.ts` (`bloc: curriculum`) avec le check DB (`core` / enums autorisés), ou élargir la contrainte — hors Phase B.

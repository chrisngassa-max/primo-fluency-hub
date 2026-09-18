# CAPTCF — LOT 2A-A2C — Validation fonctionnelle contrôlée

**Date UTC :** 2026-09-18 (~21:40Z session A2C)  
**Dépôt :** `D:\sites\tcf pro`  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**HEAD (handoff final Phase B) :** `e16b03d2c1d6b6d8786061a33eda553829a39afd`  
**Message :** `docs(lot-2a-a2): close Phase B after curriculum-adapt v2 deploy`  
**Projet distant (lecture / appels contrôlés uniquement) :** `gudcenhmzlcvhgbgklzw`  
**Push / deploy Edge / migration SQL / création compte / MDP demandé :** **aucun**

Références : `CAPTCF_LOT_02A_A2_DEPLOIEMENT_EDGE_HAS_ROLE.md`, `CAPTCF_LOT_02A_A2_PREFLIGHT_EDGE_HAS_ROLE.md`, preuves gitignored `.local-security-evidence/lot2a-a2-phaseb-2026-09-18/`.

---

## 1. HEAD Phase B — confirmation

| Élément | Valeur |
|---|---|
| SHA complet | `e16b03d2c1d6b6d8786061a33eda553829a39afd` |
| Attendu autour de | `e16b03d2…` — **confirmé** |
| Contenu | clôture Phase B 6/6 (`curriculum-adapt` v2) |
| Commit source code A2 | `dc1aeb3dfdbc81630698aff69c50e4c15c716865` (inchangé) |

---

## 2. Versions distantes + `verify_jwt` (relecture A2C)

Source : `list_edge_functions` / `get_edge_function` sur `gudcenhmzlcvhgbgklzw` (2026-09-18).

| Fonction | Version | verify_jwt | `has_role` distant | `updated_at` (UTC) |
|---|---:|---|---|---|
| `approve-student` | **10** | `false` | `uid` / `target_role` | 2026-09-18T19:06:45Z |
| `create-student` | **12** | `true` | `uid` / `target_role` | 2026-09-18T19:17:25Z |
| `reset-student-password` | **12** | `true` | `uid` / `target_role` | 2026-09-18T19:18:44Z |
| `update-student-credentials` | **7** | `true` | `uid` / `target_role` | 2026-09-18T19:19:18Z |
| `curriculum-batch` | **8** | `true` | `uid` / `target_role` (×2) | 2026-09-18T19:33:52Z |
| `curriculum-adapt` | **2** | `true` | `uid` / `target_role` (×2) | 2026-09-18T21:16:44Z |

Aligné avec le handoff Phase B (6/6). Aucune clé legacy `_user_id` / `_role` dans les corps distants relus.

---

## 3. Smokes conçus — charge invalide, après `has_role`, avant écriture

Principe commun : JWT formateur réel → RPC `has_role` **réussit** → payload volontairement invalide → **400 métier** (ou 200 degraded lecture seule) → **aucune** `insert` / `update` / `auth.admin.*`.

Distinction attendue :

| Signal | Interprétation |
|---|---|
| HTTP **403** + « Accès / Réservé … formateurs » | échec / faux négatif `has_role` (régression) |
| HTTP **401** | JWT absent / invalide (hors périmètre smoke formateur) |
| HTTP **400** (message métier listé) | **autorisation OK**, validation métier refuse **avant écriture** |
| HTTP **200** degraded (`curriculum-adapt` UUID fantôme) | authz OK + SELECT vide, **pas d’écriture** |

### 3.1 Analyse no-write (fonction par fonction — code distant exact)

| Fonction | Après `has_role` | Early return no-write | Première écriture évitée |
|---|---|---|---|
| `approve-student` | parse body → `if (!student_id)` → **400** | oui | `profiles.update` / `groups.insert` / `group_members.insert` |
| `create-student` | parse → `!prenom\|\|!nom\|\|!group_id` → **400** | oui | `auth.admin.createUser` / `profiles.upsert` / `group_members.insert` |
| `reset-student-password` | parse → `!eleve_id` → **400** | oui | `auth.admin.updateUserById` / `profiles.update` |
| `update-student-credentials` | parse → `!eleve_id` → **400** | oui | `auth.admin.updateUserById` / `profiles.update` |
| `curriculum-batch` | `action` inconnue → **400** | oui | `resource_generation_batches.insert` / jobs / updates restore |
| `curriculum-adapt` | champs manquants → **400 avant** `assertFormateur` (ne prouve pas has_role) ; UUID fantôme + `sessionCode` → SELECT → **200 degraded** si aucune ressource publiée | oui sur chemin degraded | `session_recommendations.insert` (et `ai_processing_logs` seulement plus loin / si secret manquant au guard) |

### 3.2 Payloads smoke (conçus, non exécutés)

| # | Fonction | Body | Attendu si formateur OK |
|---|---|---|---|
| 1 | `approve-student` | `{}` | **400** `student_id requis` |
| 2 | `create-student` | `{}` | **400** `Prénom, nom et groupe sont obligatoires` |
| 3 | `reset-student-password` | `{}` | **400** `eleve_id requis` |
| 4 | `update-student-credentials` | `{}` | **400** `eleve_id requis` |
| 5 | `curriculum-batch` | `{ "action": "a2c-smoke-invalid" }` | **400** `action inconnue : a2c-smoke-invalid` |
| 6 | `curriculum-adapt` | `{ "trainingSessionId": "00000000-0000-0000-0000-000000000000", "sessionCode": "S99-A2C" }` | **200** `degraded_mode: true` (ou 500 secret pseudo manquant — alors **ne pas** relancer) |

Alternative `curriculum-batch` lecture seule (aussi no-write) : `{ "action": "estimate" }` → 200 stub — moins discriminant pour « payload refusé ».

### 3.3 Exécution

| Condition | Résultat A2C |
|---|---|
| Absence d’écriture démontrée (analyse code) | **oui** pour les 6 payloads §3.2 |
| Jeton formateur sûr déjà disponible (sans MDP / sans créer compte / sans réactiver E2E) | **non** — confirmé Phase B `STATUS.json` + inventaire preuves A2 (aucun artefact jeton formateur) |
| Smokes exécutés | **non — reportés** |

**Décision opérationnelle :** ARRÊT smokes. Pas de demande de mot de passe, pas de création de compte, pas de réactivation E2E, aucune mutation prod.

---

## 4. Journaux expurgés (`has_role` / `_user_id` / `_role`)

Fenêtres `query_logs` (max 24 h API), filtres textuels sur `edge_logs`, `postgres_logs`, `postgrest_logs` :

| Filtre | Résultat |
|---|---|
| `has_role`, `_user_id`, `_role`, `target_role`, `PLACEHOLDER` | **0 ligne** |
| Paths `/functions/v1/{six slugs}` | **0 ligne** |
| Sample `edge_logs` 19:00–20:00Z | trafic REST `resource_generation_batches` (polling), **pas** d’invocation Edge des 6 slugs visible |

**Conclusion logs :** aucune **nouvelle** erreur liée à `_user_id` / `_role` / résolution `has_role` **observée** dans les fenêtres consultées.  
**Limite :** absence de logs ≠ preuve absolue d’absence d’appel ou d’impact (rétention / sampling / sources non exhaustives).

---

## 5. Note PLACEHOLDER — `curriculum-batch` v6

### 5.1 Chronologie reconstituée (artefacts locaux + `updated_at` remote)

| Étape | Horodatage approx. | Preuve |
|---|---|---|
| Préparation / déploiement accidentel **v6** (corps littéral `PLACEHOLDER`) | **~2026-09-18T19:17Z–19:22Z** | dossiers `deploy-payloads/curriculum-batch/` (`_deploy-meta` 21:17 local, `_invoke` 21:20, sources 21:22 = UTC+2) |
| Rollback **v7** = dump préflight (corps réel, legacy has_role) | **~2026-09-18T19:26Z–19:27Z** | `deploy-payloads/curriculum-batch-ROLLBACK/` (`content-only` 21:26, `payload` 21:26 local) |
| Forward **v8** = dump + rename `uid`/`target_role` only | **2026-09-18T19:33:52Z** | `list_edge_functions` `updated_at` ; payload forward 21:32 local |

**Intervalle PLACEHOLDER v6 (fenêtre ouverte) :** environ **2026-09-18T19:17Z → 2026-09-18T19:27Z** (**≤ ~10 minutes**). Bornes reconstruites depuis timestamps fichiers + handoff Phase B (pas d’horodatage plateforme v6 natif exposé).

### 5.2 Appels observés pendant l’intervalle

- `query_logs` sur paths `curriculum-batch` / message `PLACEHOLDER` : **aucun** hit.
- Dans la même heure UTC, `edge_logs` montre surtout des **GET** REST sur `resource_generation_batches` (polling worker/UI) — **hors** Edge Function `curriculum-batch`.

### 5.3 Conséquences éventuelles

| Hypothèse | Statut |
|---|---|
| Client POST `/functions/v1/curriculum-batch` pendant v6 | aurait reçu un échec runtime / corps invalide (fonction non exécutable) — **non observé** dans logs consultés |
| Écritures batch / jobs via cette Edge pendant v6 | **non démontrées** |
| Impact silencieux hors logs | **possible en théorie** — **absence de logs ≠ preuve absolue d’absence d’impact** |

État actuel : **v8** canonique, `verify_jwt=true`, pas de `PLACEHOLDER` dans le dump distant.

---

## 6. Interdits respectés (A2C)

- Pas de déploiement Edge  
- Pas de migration SQL / policy  
- Pas de push Git  
- Pas de création / réactivation de compte  
- Pas de demande de MDP  
- Pas de correction applicative hors documentation  

---

## 7. Verdict coordinateur

| Couche | Statut |
|---|---|
| Validation **technique** (versions, `verify_jwt`, `has_role` canonique distant, HEAD Phase B) | **acquise** |
| Validation **fonctionnelle** (smokes formateur live) | **reportée** (pas de jeton formateur sûr) |
| Production | **non modifiée** par A2C |

**Formulation de clôture :**  
**validation technique acquise, validation fonctionnelle reportée.**

---

## 8. Livrable Git

| Élément | Valeur |
|---|---|
| Handoff | `docs/handoffs/CAPTCF_LOT_02A_A2C_VALIDATION_FONCTIONNELLE.md` |
| Commit | *(SHA après commit documentaire local unique — ce fichier uniquement)* |
| Push | **aucun** |

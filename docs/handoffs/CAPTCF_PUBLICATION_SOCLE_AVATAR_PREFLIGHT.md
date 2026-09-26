# CAPTCF — Préflight publication socle validé + MVP Avatar FAQ

**Date :** 2026-09-26  
**Branche locale :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**HEAD local :** `2083b324` — `docs: preflight publication socle CapTCF + Avatar FAQ`  
**Socle code validé (avant ce doc) :** `7d206a05` — Avatar FAQ MVP  
**Remote Git (sans fetch/push) :** `origin` → `https://github.com/chrisngassa-max/primo-fluency-hub.git`  
**Push / merge / déploiement :** **aucun** (préflight uniquement)

---

## 1. Mécanisme exact de publication captcf.fr

| Élément | Valeur (lecture seule) |
|---|---|
| Hébergeur front | **Vercel** projet `primo-fluency-hub` (`prj_f5SahyaLc07wzhkx6rYv26NfnKRz`) |
| Team | `meme3` (`team_Z09AMuaopVbl5QRjbFGB1IBM`) |
| Domaines prod | `captcf.fr`, `www.captcf.fr` (+ `primo-fluency-hub.vercel.app`) |
| Branche déclenchant la prod | **`main`** (meta Vercel `githubCommitRef: main`) |
| Build | `vercel.json` → `npm install --legacy-peer-deps` + `npm run build` → `dist` (Vite) |
| CI GitHub front | **aucun** workflow deploy ; seul `.github/workflows/curriculum-worker.yml` (batch curriculum, hors front) |
| Backend / auth | Supabase `gudcenhmzlcvhgbgklzw` — `site_url` captcf.fr (déjà aligné B2 / has_role hors ce push) |

Publication front = **push/merge sur `origin/main`** → déploiement Vercel production automatique.

---

## 2. SHA publié actuel vs cache local

| Source | SHA | Note |
|---|---|---|
| **Vercel production READY** | `df7e0698f52dfe460a743828a5a02e1cff41416d` | `chore(ci): enforce test build and lint baseline (#33)` — déploiement `dpl_8uYg8wKXRq2MR7R1URCKjyjyX6FY` |
| Cache local `origin/main` / `main` | `c3870caa891a9a78e73eebf04d6b96d199b39644` | `feat(audio): generate grounded A1-B2 listening variants (#32)` |
| `df7e0698` dans le dépôt local | **absent** | fetch interdit → objet inconnu localement |

**Écart critique :** le remote `main` réel (via Vercel) est **en avance** sur le tracking local `origin/main`. Toute plage `c3870caa..HEAD` est donc **provisoire** jusqu’à un `git fetch` autorisé.

**SHA de retour arrière recommandé (prod live) :** `df7e0698` (redeploy Vercel / revert main sur ce SHA).  
**SHA de retour arrière selon cache local seulement :** `c3870caa` (rollback candidate Vercel précédent encore listé).

---

## 3. Commits requis — présence historique locale

| SHA | Présent | Sujet |
|---|---|---|
| `dc1aeb3d` | oui | security(lot-2a-a2): align Edge has_role callers… |
| `78c2dae2` | oui | docs(lot-2a-a2c): controlled functional validation… |
| `b4dda50c` | oui | fix(ipe): require B2 for naturalisation… |
| `01505c1a` | oui | docs(lot-3a): close Phase B B2 deploy… |
| `b2e9a0bc` | oui | docs(lot-3b): frame avatar Q&A MVP… |
| `7d206a05` | oui | feat(avatar): local CapTCF FAQ Q&A prototype… |

---

## 4. Plage proposée (cache local, sans fetch)

- **From (merge-base local avec `origin/main`) :** `c3870caa`  
- **To (HEAD) :** `2083b324` (inclut ce handoff ; code socle jusqu’à `7d206a05`)  
- **Nombre :** **33** commits (`git log --oneline origin/main..HEAD` après commit handoff)  
- **Branche distante cible :** `origin/main`  
- **Méthode :**  
  1. Autorisation propriétaire : `git fetch origin`  
  2. Rebase ou merge de `codex-captcf-lot-00-protection-cartographie-20260917` **sur `origin/main` réel** (attendu ≈ `df7e0698`)  
  3. Push de la branche feature **ou** PR → merge dans `main`  
  4. Vercel déploie automatiquement captcf.fr  

**Ne pas** force-push `main`. **Ne pas** merger sans intégrer `#33` (`df7e0698`).

---

## 5. Tests & build (préflight)

| Contrôle | Résultat |
|---|---|
| Avatar FAQ (`src/test/avatar-assistant-faq.test.ts`) | **10/10 pass** |
| B2 (`readiness-objectif-b2` + `_shared/readiness.test`) | **15/15 pass** |
| `npm run build` | **OK** (exit 0, warnings chunk size / browserslist uniquement) |
| Lint global / suite entière | **non exécutés** (hors périmètre) |

### Panneau Aide (Avatar)

- Code : `AvatarAssistantPanel` branché dans `EleveLayout` (bouton Aide, ouverture/fermeture, FAQ + refus).  
- Tests unitaires moteur FAQ : ouverture logique via intents (consigne, correction, refus admin/résultats/autre élève, fallback).  
- **Navigateur :** non exercé ce préflight (pas de passage UI live). Non vu : layout mobile réel, focus clavier, chevauchement nav bottom.

Aucune donnée réelle d’élève dans code/tests Avatar.

---

## 6. Fichiers exclus du push (confirmé)

`.gitignore` couvre `.env*`, `.local-security-evidence/`.

**Ne pas stager / pousser :**

| Catégorie | Exemples status actuel |
|---|---|
| Evidence sécurité | `.local-security-evidence/` (gitignored) |
| Temp Supabase | `supabase/.temp/cli-latest` (modifié), `supabase/.temp/linked-project.json` |
| Docs pédagogiques non suivis | `docs/fichiers oral/**`, `docs/seance-*-v2/**`, `docs/seance-1-pilote/**`, audits/specs/plans divers |
| Handoffs non liés à cette pub | `CAPTCF_LOT_00_PROTECTION_CARTOGRAPHIE.md`, `CAPTCF_PLAN_LOTS_BORNES_ACCES_REPRODUCTIBILITE.md` (??) |
| Artefacts build | `dist/` (généré localement, hors commit) |

Seuls les commits **déjà** sur la branche (32 depuis `c3870caa`) + ce handoff sont candidats à publication après réconciliation remote.

---

## 7. Opération exacte nécessitant autorisation propriétaire

1. **`git fetch origin`** (mettre à jour le cache ; aujourd’hui interdit).  
2. Réconciliation branche locale ↔ `origin/main` (rebase/merge sur SHA réel ≈ `df7e0698`).  
3. **`git push -u origin HEAD`** (ou équivalent) de la branche feature.  
4. **Merge PR vers `main`** (déclenche déploiement Vercel → captcf.fr).  
5. Toute promotion / rollback Vercel manuelle.

Sans ces autorisations : **aucun push, aucune fusion, aucun déploiement.**

---

## 8. Git de ce document

Commit local **uniquement** de ce fichier handoff. Aucun autre stage. Aucun push.

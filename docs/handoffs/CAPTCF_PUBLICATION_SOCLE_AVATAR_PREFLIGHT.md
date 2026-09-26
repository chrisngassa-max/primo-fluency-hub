# CAPTCF — Préflight + intégration Git + PR (sans fusion)

**Date :** 2026-09-26  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**Backup local :** `backup/captcf-pre-integration-97408383` → `97408383` (intact)  
**Remote :** `origin` → `https://github.com/chrisngassa-max/primo-fluency-hub.git`

| État | Valeur |
|---|---|
| HEAD branche (après merge) | `1f869bf6` + commit handoff d’intégration (voir log) |
| Socle Avatar | `7d206a05` |
| `origin/main` | `df7e0698f52dfe460a743828a5a02e1cff41416d` |
| Merge-base réel | `df7e0698` (= `origin/main` après merge) |
| Rollback front prod | **`df7e0698` confirmé** (égal à `origin/main` + Vercel prod) |
| Fusion PR / deploy manuel | **NON** |

---

## 1. Publication captcf.fr

Vercel `primo-fluency-hub` (`prj_f5SahyaLc07wzhkx6rYv26NfnKRz`) · domaines `captcf.fr` / `www.captcf.fr` · branche **`main`** · build `vercel.json` (Vite).  
CI GitHub front : `.github/workflows/ci.yml` (introduit par `#33` / `df7e0698`) + `curriculum-worker.yml`.

---

## 2. Fetch & vérifications

| Contrôle | Résultat |
|---|---|
| `git fetch origin` | OK (`main` `c3870caa..df7e0698`) |
| `origin/main` | `df7e0698` exact |
| `df7e0698` dans historique `origin/main` | **oui** (`merge-base --is-ancestor` exit 0 ; SHA = tip) |
| Commits distants absents localement (avant merge) | 1 : `df7e0698` CI baseline |
| Commits locaux absents de main (avant merge) | 34 (lots 0.5→3B + Avatar + préflight) |

---

## 3. Intégration

- Méthode : **`git merge origin/main`** (pas de rebase / rewrite).  
- Merge commit : `1f869bf6` — `merge(main): integrate df7e0698 CI baseline before CapTCF PR`  
- **Conflits :** aucun (ort, auto).  
- Fichiers apportés par main : `.github/workflows/ci.yml`, micro-fixes eslint / Edge directives & source-integrity / analyze-pedagogical-source / get-seance-content.

---

## 4. Plage PR (recalculée)

- **Base :** `origin/main` = `df7e0698`  
- **Head :** branche de travail (après handoff d’intégration)  
- **Commits uniques vs main :** 35 avant handoff final (34 lots + 1 merge) + 1 handoff doc  
- **Synthèse :** confinement sécurité 0.5–0.8b · harness lot 1 · has_role lot 2A · B2 naturalisation 3A · cadrage + MVP Avatar FAQ 3B · docs/handoffs · merge CI `#33`

**Exclus du push (non suivis / gitignore) :** `.local-security-evidence/`, `.env*`, `supabase/.temp/*`, `docs/fichiers oral/`, séances v2/pilote, autres docs ?? hors lots.

Scan `git diff --name-only origin/main...HEAD` : **0** chemin exclu.

---

## 5. Contrôles post-merge

| Contrôle | Résultat |
|---|---|
| Avatar FAQ (10) | **PASS** |
| B2 readiness (15) | **PASS** |
| `npm run security:check` | **PASS** (4 local ; 6 not_tested optionnels) |
| `npm run build` | **PASS** |

---

## 6. Push & PR (sans fusion)

- Push : **uniquement** `codex-captcf-lot-00-protection-cartographie-20260917` (`git push -u origin HEAD`)  
- PR vers `main` via `gh pr create` — **non fusionnée**  
- Pas de déploiement manuel Vercel  
- URL / statut / CI : renseignés ci-dessous après création

### PR

| Champ | Valeur |
|---|---|
| URL | _(à compléter au push)_ |
| Statut | OPEN — **non mergée** |
| CI | _(poll ~2–3 min)_ |

---

## 7. Arrêt volontaire

**STOP avant toute fusion dans `main`.**  
Rollback front si besoin après une future fusion : redeploy / revert à **`df7e0698`**.

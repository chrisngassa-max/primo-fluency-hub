# CAPTCF — LOT 3A — Naturalisation → B2 (IPE)

**Date :** 2026-09-24  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**Projet distant (lecture seule) :** `gudcenhmzlcvhgbgklzw`  
**Push / migration / deploy / mutation données :** **aucun**

Sources confirmées (WebFetch, sans données projet) :
- Service-Public [F11926](https://www.service-public.fr/particuliers/vosdroits/F11926) — vérifié **01/01/2026** : naturalisation / décret / mariage → **B2** CECRL oral + écrit.
- Règle métier CapTCF confirmée : pluriannuelle **A2** ; résident **B1** ; naturalisation **B2**.

---

## 1. Parcours canonique corrigé

| Couche | Fichier | Rôle |
|---|---|---|
| Config IPE | `supabase/functions/_shared/readiness_config_v1.json` | Objectifs + seuils scale |
| Moteur | `supabase/functions/_shared/readiness.ts` | `Objectif` + `isObjectifAtteint` |
| Resolve Edge | `supabase/functions/compute-readiness/gather.ts` | `resolveObjectif` |
| Affichage | `src/lib/readinessDisplay.ts` | `ReadinessObjectif` + resolve + libellés |
| Fiche IPE | `src/hooks/useEleveReadinessFiche.ts` | Libellé fallback |
| Hub formateur | `src/pages/formateur/PreparationExamenHubPage.tsx` | Seuils affichés |
| Onboarding | `src/components/EleveOnboarding.tsx` | Plus de B1 figé |
| Prompts actifs | `tcf-evaluate-answer`, `tcf-generate-exercise` | Naturalisation B2 |

Déjà alignés (non touchés) : `demarche_weights.json` (nat→B2), `system-prompt.ts`, UI Groupes/Exercices/Progression (labels B2).

---

## 2. Règle avant / après

| Objectif | Avant (bug) | Après |
|---|---|---|
| A2 | libellé « Carte de résident » | **Carte de séjour pluriannuelle** (scale 4) |
| B1 | libellé « Naturalisation » | **Carte de résident** (scale 7) |
| B2 | **absent** ; nat mappée → B1 | **Naturalisation** (scale 10) |

`resolveObjectif` / `resolveObjectifFromParcours` :
- `type_demarche=naturalisation` **ou** niveau contenant B2 → **B2** (y compris legacy `niveau_cible=B1`)
- niveau B1 → **B1**
- sinon → **A2**

---

## 3. Tests réellement passés

```
npm run test -- src/test/readiness-objectif-b2.test.ts supabase/functions/_shared/readiness.test.ts
→ 2 files, 15 tests passed
```

Couverture demandée :
- naturalisation B1 scale → insuffisant
- naturalisation B2 scale → atteint
- résident B1 → atteint
- pluriannuelle A2 → atteint
- config A2/B1/B2 présente

Build : `npm run build` OK (2026-09-24). Typecheck global non bloquant (sortie npm warn uniquement).

---

## 4. Données distantes (lecture seule) — stratégie anciens verdicts

| Observation | Valeur |
|---|---|
| `readiness_config` active | algo_version **1**, objectifs **sans B2** (A2=résident, B1=naturalisation) |
| `readiness_snapshots` | **0** lignes |
| Profils `type_demarche=naturalisation` | **2** (hash md5 anonymisés : `b27b0c2f`, `09656727`) |

**Stratégie (aucune mutation sans nouvelle autorisation) :**
1. **Nouveaux calculs** (après deploy Edge + sync config) → règle B2.
2. **Anciens verdicts B1** : aucun snapshot stocké → pas de recalcul silencieux à faire ; si des snapshots apparaissent avant deploy, les signaler UI comme « établis selon ancienne règle (B1) » via `algo_version` / date < cutover.
3. **Profils concernés** : les 2 hash ci-dessus — communication formateur hors bande, pas de rewrite `type_demarche`/`objectif_tcf`.
4. **Remote `readiness_config`** : UPDATE jsonb (ou INSERT algo_version 2) **interdit** tant que non autorisé ; le front utilise déjà un fallback local de libellés.

---

## 5. Limites

- Code local seulement ; Edge `compute-readiness` **non redéployée**.
- Table distante `readiness_config` encore B1 jusqu’à autorisation.
- Pas de migration SQL dans ce lot.
- `demarche_weights.titre_sejour` reste B1 (résident) ; pluriannuelle via `niveau_cible` / défaut A2 du resolve.

---

## 6. Commit

| Élément | Valeur |
|---|---|
| SHA | `b4dda50cc625f8f853b392cc5aad9f65625fb6fb` |
| Court | `b4dda50c` |
| Message | `fix(ipe): require B2 for naturalisation under 2026 IRN rules` |

**Aucun push.**

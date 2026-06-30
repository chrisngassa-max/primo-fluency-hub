# Référentiel V3 — Corrections CapTCF

Patch documentaire appliqué au **Document Maître V3** (juin 2026) avant seed en base (`tcf_routing_rules`, `tcf_score_thresholds`).

Source seed maintenable : `supabase/seeds/tcf_routing_rules_v3.json`

---

## 1. Règle globale — limites EE vs EO

### Texte V3 (erroné)

> Limite stricte de **90 mots pour toutes les tâches EE et EO** du TCF IRN.

### Texte corrigé

> Limite stricte de mots pour l'**Expression Écrite (EE) uniquement** :
>
> | Tâche | EE (mots) | EO (durée) |
> |-------|-----------|------------|
> | Tâche 1 | 30–60 | 3 min |
> | Tâche 2 | 40–90 | 3 min 30 |
> | Tâche 3 | 40–90 | 3 min 30 |
>
> L'EO est évaluée sur la **durée de prise de parole** et les **critères oraux TCF** (phonologie, lexique, grammaire, fluidité, cohérence, interaction) — **jamais** sur un compteur de mots.
>
> Plafond absolu TCF IRN : **90 mots maximum en EE** (tâches 2 et 3). Production EE hors limites → sanction « A1 non atteint » (FEI).

**Ne pas confondre** avec le TCF Canada (limites différentes, ex. 180 mots Tâche 3).

---

## 2. Messages apprenant EO corrigés

Les blocs EO A2, B1 et B2 reprenaient par erreur le rappel « 90 mots » des blocs EE.

| `rule_id` | V3 (erroné) | Corrigé |
|-----------|-------------|---------|
| `A2_EO` | « RAPPEL : 90 mots maximum. » | « RAPPEL : Tâche 2 = 3 min 30 — prenez l'initiative, connecteurs temporels, racontez sans attendre les relances. » |
| `B1_EO` | « RAPPEL IMPÉRATIF : Tâche 3 = limite des 90 mots. » | « RAPPEL : Tâche 3 = 3 min 30 — position + argument + exemple, fluidité avant perfection morphologique. » |
| `B2_EO` | « Calibrez vos réponses autour de la limite des 90 mots TCF IRN. » | « RAPPEL : Tâche 3 = 3 min 30 — débat argumenté avec nuances (concession, doute), spontanéité et diversité stylistique. » |

`A1_EO` était déjà cohérent (durée Tâche 1) ; enrichi avec « RAPPEL : Tâche 1 = 3 min — phrases S-V-C complètes. »

---

## 3. Sentinelle 500 — `hors_perimetre_tcf_irn`

Dans les 4 blocs B2 (`B2_CO`, `B2_CE`, `B2_EO`, `B2_EE`), le champ `bascule_niveau_suivant.condition_quantitative = 500` **n'est pas** un seuil de montée de niveau.

| Champ | Sémantique |
|-------|------------|
| `condition_quantitative: 500` | Valeur **sentinelle** (CO/CE : score /699 ≥ 500 indique un niveau hors périmètre IRN) |
| `hors_perimetre_tcf_irn: true` | Flag applicatif — ne déclenche **aucune** bascule vers C1/C2 |
| `plafond_tcf_irn: true` | Le moteur reste au plafond B2 pour toute génération TCF IRN |
| `bascule_note` | « Valeur sentinelle — flag hors_perimetre_tcf_irn. Le TCF IRN plafonne au B2. » |

Le routeur CapTCF doit traiter 500 comme **détection de dépassement**, pas comme `condition_quantitative` de progression A1→A2→B1→B2.

---

## 4. Niveau A0 — hors matrice TCF IRN

La matrice V3 couvre **A1–B2 × CO/CE/EE/EO** (16 blocs). Le niveau **A0** n'y figure pas :

- A0 = « débutant scolaire intégré » (profil CapTCF, `TCF_SYSTEM_PROMPT`, `profils_eleves.niveau_*`)
- Géré par un **parcours séparé** : gabarits Séances 1–17, test de positionnement, baseline manuelle
- Les seuils officiels TCF IRN (100–699 / 1–13) s'appliquent à partir d'A1

Ne pas seed de règle `A0_*` dans `tcf_routing_rules` sans conception dédiée.

---

## 5. Champs machine ajoutés au seed

Pour chaque règle V3 :

```json
{
  "rule_id": "A2_EO",
  "version": "v3",
  "ee_word_bounds": { "t1": [30, 60], "t2": [40, 90], "t3": [40, 90] },
  "eo_duration_minutes": { "t1": 3, "t2": 3.5, "t3": 3.5 },
  "plafond_tcf_irn": false
}
```

Blocs B2 : `"plafond_tcf_irn": true`.

---

## 6. Échelles de score (rappel intégration)

| Épreuve | Échelle V3 | Table |
|---------|------------|-------|
| CO, CE | /699 (`tcf_699`) | `tcf_score_thresholds` |
| EE, EO | /13 (`tcf_13`) | `tcf_score_thresholds` |

**Travail restant** : mapper l'échelle 0–10 de `tcf-evaluate-answer` vers 1–13 avant branchement du routeur sur ces seuils.

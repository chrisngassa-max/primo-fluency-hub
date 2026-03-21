

## Plan : Section "Ma progression détaillée" avec jauges personnalisées

### Résumé

Remplacement de la carte "Progression globale" (lignes 275-302 de `Dashboard.tsx`) par une section affichant 4 compétences indépendantes avec jauges à 3 indicateurs et badges dynamiques.

### Fichiers

**1. Créer `src/components/CompetencyGauge.tsx`**

Props : `{ label, initialScore, currentScore, completedSessions, totalSessions }`

- Calcul interne : `expectedScore = initialScore + ((80 - initialScore) * (completedSessions / totalSessions))`
- Barre Tailwind `h-3 rounded-full bg-muted relative` avec :
  - Fill coloré à `currentScore%`
  - Trait vertical gris à `initialScore%` (repère de départ)
  - Trait vertical pointillé à `expectedScore%` (cible du moment)
- Légende discrète sous la barre (Initial / Objectif)
- Badge shadcn à droite :
  - `current >= expected + 5` → vert "En avance"
  - `current` entre `expected ± 5` → bleu "Dans les temps"
  - `current < expected - 5` → orange/rouge "À renforcer"

**2. Modifier `src/pages/eleve/Dashboard.tsx` (lignes 275-302)**

Remplacer la carte par une carte "Ma progression détaillée" contenant 4 `CompetencyGauge` avec mock data :

```
CO:         initial=25, current=55, completed=4, total=8
CE:         initial=30, current=40, completed=4, total=8
EE:         initial=15, current=20, completed=4, total=8
Structures: initial=20, current=50, completed=4, total=8
```

Calculs attendus (expectedScore) :
- CO: 25 + (55 * 0.5) = 52.5 → current 55 > 57.5? Non → "Dans les temps"
- CE: 30 + (50 * 0.5) = 55 → current 40 < 50 → "À renforcer"
- EE: 15 + (65 * 0.5) = 47.5 → current 20 < 42.5 → "À renforcer"
- Structures: 20 + (60 * 0.5) = 50 → current 50 ≈ 50 → "Dans les temps" ou "En avance" selon marge

Cela démontre les 3 états de badge.


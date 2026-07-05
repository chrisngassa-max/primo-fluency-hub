# CAP TCF — Intégration Parcours TCF (langue) + Parcours Civique (v1)

**Projet** : primo-fluency-hub (CAP TCF)  
**Date** : juillet 2026  
**Statut** : v1 livrée (hub dual-track + placeholder civique)

---

## 1. Vision produit

Une même plateforme formateur, **un tableau de bord unifié** pour accompagner les apprenants vers le **séjour en France** (TCF IRN) et, le cas échéant, la **naturalisation** (examen civique).

| Principe | Détail |
|----------|--------|
| **Un hub** | Point d'entrée unique : *Préparation séjour / naturalisation* |
| **Deux parcours** | Parcours **Langue (TCF IRN)** et Parcours **Civique** — scores **séparés** |
| **Liens croisés** | Exercices CE/EE à thèmes civiques ; vocabulaire partagé (admin lexique) |
| **Pas de fusion** | IPE Langue ≠ IPE Civique — deux indicateurs distincts |

### Contexte réglementaire

- **TCF IRN** : test de **langue** (CO, CE, EE, EO). Seuils : A2 (carte de résident), B1 (naturalisation).
- **Examen civique** : QCM de **connaissances** (40 questions / 45 min, 32/40 requis). Obligatoire pour naturalisation et certaines démarches de titre de séjour.

Les deux examens sont **complémentaires** mais **indépendants** : dates, centres et critères de réussite distincts.

---

## 2. Architecture hub

```
/formateur/preparation-examen          → Hub dual-track
├── Parcours Langue (TCF)              → IPE existant (readiness_snapshots)
│   ├── /preparation-examen/groupe/:id
│   └── /preparation-examen/eleve/:id  → Fiche IPE Langue + jauge Civique (placeholder v1)
└── Parcours Civique                   → /formateur/preparation-civique (v1 placeholder)
    ├── Sélecteur groupe / élève
    ├── Thèmes officiels (liste statique)
    └── QCM & IPE Civique (v2)
```

### Parcours Langue (TCF) — existant

- **IPE Langue** : score 0–100 par compétence (CO, CE, EE, EO, ST) + global.
- Source : `readiness_snapshots`, recalcul via `useEleveReadinessFiche`.
- Fiches groupe et élève déjà opérationnelles.
- Lien avec le plan-cadre : séances S1–S20 (tronc commun) + enrichissement TCF.

### Parcours Civique — nouveau (v1 → v3)

- **Objectif** : préparer l'examen civique officiel (5 thèmes réglementaires).
- **v1** : page placeholder, thèmes statiques, sélecteur groupe/élève (sans score).
- **v2** : banque QCM, snapshots `civique_snapshots`, IPE Civique calculé.
- **v3** : simulations complètes 40 Q, corrélation avec module optionnel S21–S30 du plan-cadre.

---

## 3. Thèmes officiels — examen civique

Alignés sur le référentiel du plan-cadre (`themes_officiels_civique` dans `plan_cadre_v1_module_optionnel.json`) :

| # | Thème | Contenu indicatif |
|---|-------|-------------------|
| 1 | **Principes et valeurs de la République** | Devise, symboles, laïcité, Marianne, drapeau, hymne |
| 2 | **Système institutionnel et politique** | Constitution, séparation des pouvoirs, élections, démocratie |
| 3 | **Droits et devoirs** | Droits fondamentaux, devoirs du citoyen, égalité femmes-hommes |
| 4 | **Histoire, géographie, culture** | Dates clés (1789, 1914, 1945), territoires, patrimoine |
| 5 | **Vivre dans la société française** | Santé, emploi, école, services publics, vie quotidienne |

---

## 4. Liens croisés pédagogiques

| Canal | Mécanisme | Statut |
|-------|-----------|--------|
| **CE / EE thématiques** | Exercices avec `theme_civique` ou metadata `vie_citoyenne` | Partiel (backfill metadata, séances S21+) |
| **Lexique partagé** | `lexique_noyau` civique dans plan-cadre + carnet de mots élève | Existant côté parcours |
| **Module optionnel S21–S30** | Parcours variante `civique` (90 h) activé si `re_signature_civique` + `examen_civique_obligatoire` | Existant (`ParcoursPage`, `generate-parcours`) |
| **Scores séparés** | IPE Langue (snapshots readiness) vs IPE Civique (à créer) | v1 : placeholder ; v2 : table dédiée |

---

## 5. Modèle de scores

### IPE Langue (existant)

- Table : `readiness_snapshots`
- Compétences : CO, CE, EE, EO, ST + GLOBAL
- Bandes : insuffisant → prêt (calibration en cours)

### IPE Civique (v2 — non implémenté en v1)

Proposition de schéma :

```sql
-- v2 : migration civique_snapshots
CREATE TABLE civique_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES profiles(id),
  theme text NOT NULL,           -- un des 5 thèmes officiels
  score numeric(5,2),            -- 0–100 par thème
  questions_answered int DEFAULT 0,
  computed_at timestamptz DEFAULT now()
);
-- IPE Civique global = moyenne pondérée des 5 thèmes (seuil réussite : 80 % = 32/40)
```

**Règle produit** : ne jamais agréger IPE Langue et IPE Civique en un score unique « TCF ».

---

## 6. Roadmap

### v1 — Hub dual-track (livré)

- [x] Hub `/formateur/preparation-examen` avec cartes **Langue** | **Civique**
- [x] Page placeholder `/formateur/preparation-civique` (groupe, élève, thèmes)
- [x] Jauge « IPE Civique : — » sur fiche élève IPE
- [x] Documentation produit (ce document)
- [ ] Pas de migration DB

### v2 — QCM & IPE Civique

- [ ] Table `civique_snapshots` + edge function de calcul
- [ ] Banque QCM par thème (import depuis plan-cadre `qcm_entrainement_civique`)
- [ ] Passation élève (devoir ou exercice dédié)
- [ ] Fiche élève : radar 5 thèmes + score global civique
- [ ] Onglet Monitoring : colonne IPE Civique à côté de IPE Langue

### v3 — Parcours complet & simulations

- [ ] Simulations 40 Q en conditions réelles (chrono 45 min)
- [ ] Deux banques (Sim 1 / Sim 2) comme dans le plan-cadre S27–S28
- [ ] Rapport formateur : TCF vs Civique, dates d'examen suggérées
- [ ] Vue élève : progression civique dans le dashboard
- [ ] Cross-routing : exercices CE/EE civiques comptabilisés dans IPE Civique

---

## 7. Navigation formateur

| Entrée | URL | Description |
|--------|-----|-------------|
| Sidebar | `/formateur/preparation-examen` | Hub Préparation séjour / naturalisation |
| Monitoring | Onglet « Préparation IPE » | Accès rapide IPE Langue (inchangé v1) |
| Parcours | Variante « Civique 90h » | Génération module S21–S30 |

---

## 8. Références code

| Fichier | Rôle |
|---------|------|
| `src/pages/formateur/PreparationExamenHubPage.tsx` | Hub dual-track |
| `src/pages/formateur/PreparationCiviquePage.tsx` | Placeholder parcours civique |
| `src/pages/formateur/FicheEleveIpePage.tsx` | Fiche IPE Langue + jauge civique |
| `src/lib/civiqueThemes.ts` | Constantes thèmes officiels |
| `src/pages/formateur/ParcoursPage.tsx` | Variante plan civique 90h |
| `supabase/functions/_shared/referential/plan_cadre_v1_module_optionnel.json` | Référentiel séances civiques |

---

*Document maintenu par l'équipe CAP TCF — mise à jour à chaque milestone v2/v3.*

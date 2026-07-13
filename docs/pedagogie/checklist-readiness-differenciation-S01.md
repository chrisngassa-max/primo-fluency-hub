# Checklist de readiness — 12 préalables (extraits de `Rapport_Reference_Differenciation_CapTCF_V2.md`, §18)

> Extraction exacte, sans reformulation ni ajout, des 12 conditions listées en conclusion du rapport
> de référence (`docs/pedagogie/Rapport_Reference_Differenciation_CapTCF_V2.md:484-497`). Cette
> checklist ne remplace pas le rapport ; elle sert de tableau de bord de gouvernance pour la mission
> « parcours interactif S01 » (2026-07-13). Le rapport reste l'autorité pédagogique — voir
> [[differentiation-reference-tension]] pour l'arbitrage retenu par le porteur du projet.

**Arbitrage retenu (décision du 2026-07-13, porteur projet)** : stratégie « implémenter maintenant,
activer progressivement ». Les fonctionnalités techniques ci-dessous peuvent être construites et
testées en sandbox/pilote contrôlé ; aucun contenu (notamment civique) n'est publié comme validé tant
que son préalable bloquant correspondant n'est pas levé.

| # | Préalable exact (rapport §18) | Statut | Preuve | Validateur | Date | Bloquant pour... | Manquant |
|---|---|---|---|---|---|---|---|
| 1 | Validation pédagogique du présent modèle de famille | **Non levé** | Aucune trace de revue formateur sur le schéma de famille dans le repo | Formateur(s) référent(s) CapTCF | — | Déclarer une famille S01 "pédagogiquement validée" | Séance de revue formateur formalisée + trace écrite |
| 2 | Validation des vingt contrats compétence×niveau (5 compétences × 4 niveaux, §7 du rapport) | **Non levé** | Contrats décrits comme recommandation dans le rapport (§7.1-7.5), aucune validation humaine tracée | Formateur(s) référent(s) | — | Considérer les contrats CE/CO/EE/EO/Structures comme normatifs | Revue explicite des 20 cellules du tableau §7 |
| 3 | Choix du statut exact des supports dérivés (annoté/réécrit/segmenté) | **Partiel** | `session_documents.status` existe (`brouillon/a_completer/relu/valide/remplace`, migration `20260708210000_session_documents.sql:34-40`) mais ne code pas explicitement "dérivé de tel support immuable avec tel mode" | Équipe technique + formateur | — | Modéliser `support_mode` (source/annotated/rewritten) dans le modèle canonique | Colonne `support_mode` + `source_document_id` + `content_hash` (ajoutés en Lot B, non encore validés pédagogiquement) |
| 4 | Schéma JSON et enums stabilisés | **En cours (ce lot)** | `differentiation_family_v1.schema.json` cité comme "candidat de spécification" (rapport §17.D.7) — non branché au runtime avant cette mission | Équipe technique | 2026-07-13 | Généraliser le modèle à toutes les séances | Revue et gel du schéma après le pilote S01 |
| 5 | Jeu de familles de référence validé par des formateurs | **Non levé** | `s01-v3-conception-pedagogique.md` propose une matrice de contenu S01 avec GO du porteur projet (2026-07-13) — GO produit, mais pas une "validation formateur" au sens du rapport | Formateur(s) référent(s) | 2026-07-13 (GO porteur projet, pas formateur pédagogique) | Publier S01 comme référence généralisable à S02+ | Relecture pédagogique humaine indépendante du contenu généré |
| 6 | Tests déterministes des douze transformations (matrice §6 du rapport) | **Non levé** | Aucun test dans `generate-s01-interactive.test.mjs` ne teste les 12 transformations A1→A2, A1→B1, etc. nommément | Équipe technique | — | Garantir qu'une transformation ne dérive pas hors contrat | Suite de tests dédiée par transformation (hors périmètre immédiat, cf. rapport de fin de mission) |
| 7 | Neutralisation des revues factices (`fake-content-model` exclu de `publishable`) | **Non levé** | Rapport §1 et §13.1 : `validation-report.json` utilise encore `fake-content-model` à plusieurs lignes ; non corrigé par cette mission | Équipe technique | — | Faire confiance à un `publishable: true` calculé automatiquement | Suppression de `fake-content-model` du calcul + preuve d'un modèle de revue réel |
| 8 | Preuve du flux réellement consommé en production | **Non vérifiable** | Rapport §13.2 : "Non vérifiable — nécessite trace runtime" ; aucune télémétrie de production consultée dans cette mission | Équipe technique + observation terrain | — | Décider quel système (statique/dynamique/pont) est le système canonique définitif | Trace runtime réelle sur un pilote |
| 9 | Décision sur le système canonique (statique / dynamique `session_exercise_variants` / pont) | **Partiel (ce lot)** | Cette mission choisit d'étendre le pont existant (`session_documents`/`session_document_links`/`session_exercices`/`exercices`) plutôt que créer un 4ᵉ moteur — décision technique de portée locale à S01, pas une décision de gouvernance globale | Porteur projet (technique) | 2026-07-13 | Généraliser au-delà de S01 | Arbitrage explicite formateur + produit sur le système cible à moyen terme |
| 10 | Calibration terrain avant blocage temporel (durées, `DIFF_DURATION_UNCALIBRATED`) | **Non levé** | Rapport §1 : S01 annonce 60-180 min sans validation temporelle bloquante ; cette mission n'ajoute pas de blocage strict sur la durée | Formateur(s) en séance réelle | — | Rendre la durée un critère bloquant de publication | Observations terrain sur plusieurs séances S01 réelles |
| 11 | Gouvernance et actualisation de la base officielle (faits civiques, §9 du rapport) | **Non levé** | Le schéma de fait officiel (`fact_id`, `source_url`, `effective_from`, `content_hash`) reste un exemple JSON dans le rapport, non instancié en base avant cette mission | Responsable pédagogique + juridique | — | Autoriser la publication de nouveaux QCM civiques comme "officiellement vérifiés" | Table `civic_facts` versionnée + processus de mise à jour (partiellement posée en Lot B, gouvernance humaine restant à définir) |
| 12 | Règles de revue humaine, versionnement et retour arrière | **Partiel (ce lot)** | Cycle de statut `draft → technical_review → pedagogical_review → factual_review → trainer_approved → publishable → published` introduit en Lot B (migration additive, réversible) ; règles de qui valide quoi restent à formaliser en dehors du schéma | Formateur référent + équipe technique | 2026-07-13 | Autoriser un contenu à passer `publishable` sans revue humaine tracée | Rôles et responsabilités de validation formalisés au-delà du schéma technique |

## Lecture de synthèse

- **Aucun des 12 préalables n'est totalement levé.** Trois sont amorcés techniquement par cette mission
  (#4, #9, #12) sans constituer une validation pédagogique ou de gouvernance au sens où le rapport
  l'entend.
- Conformément à l'arbitrage retenu, la mission construit donc les fonctionnalités techniques listées
  dans le rapport final, mais **aucun contenu S01 n'est déclaré "validé pédagogiquement"**, et le
  contenu civique reste soumis à revue humaine avant toute publication réelle aux apprenants au-delà
  du pilote contrôlé.

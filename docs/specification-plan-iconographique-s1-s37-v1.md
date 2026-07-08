# Spécification du plan iconographique CapTCF — S1 à S37

Version 1 — 5 juillet 2026

## 1. Décision

La génération anticipée est faisable avec l’API Enterprise, à condition de ne pas confondre génération et publication. Le plan fournit les besoins et contrats ; l’API génère les fichiers en lot ; CapTCF les stocke comme brouillons, les contrôle, puis exige une validation humaine.

CapTCF possède déjà le bucket `pedagogical-images`, la table `pedagogical_images`, la recherche associée et les scripts de génération/import. Il faut compléter cette base avec les briefs, les liens aux exercices, les lots, l’idempotence, les versions et la revue.

## 2. Pipeline

```text
plan de formation
  -> besoins par séance
  -> contrats par exercice
  -> dry-run et estimation de coût
  -> génération Enterprise
  -> stockage draft
  -> contrôles automatiques
  -> revue humaine
  -> publication
  -> liaison exercice-image-corrigé
  -> pack hors ligne
```

Une image évaluée n’est jamais générée ou remplacée pendant le cours.

## 3. Mode de production

| Contenu | Méthode |
|---|---|
| Logo, symbole ou document officiel | Récupération depuis une source officielle |
| Carte, frise factuelle, organigramme | SVG ou rendu déterministe depuis des données validées |
| Formulaire, courriel, planning, facture avec texte | Données structurées + gabarit HTML/SVG/PDF |
| Scène fictive générique | Génération autorisée depuis un brief verrouillé |
| Photographie historique ou mémorielle | Source licenciée ; aucune fausse archive |
| Image dont dépend la réponse | Production anticipée, validation et version figée |

Le moteur d’image produit les scènes. CapTCF produit lui-même les textes, chiffres, horaires, formulaires, graphiques et libellés.

## 4. Contrat de séance

```json
{
  "session_code": "S01",
  "support_id": "S01-parcours-objectifs",
  "image_requirements": [{
    "resource_id": "S01_VIS_cinq-themes_v1",
    "required": true,
    "role": "contextual",
    "generation_mode": "deterministic_svg",
    "pedagogical_function": "Identifier les cinq thèmes",
    "exercise_codes": ["S01-CIV-01"],
    "question_depends_on_image": false,
    "required_elements": ["exactement cinq panneaux"],
    "forbidden_elements": ["texte dans l’image", "logo officiel"],
    "output_spec": {"ratio":"16:9","width":1600,"height":900,"formats":["png","webp"]},
    "alt_text": "Cinq panneaux représentent les cinq thèmes civiques.",
    "prompt_version": "iconography-s01-v1",
    "validation_status": "planned"
  }]
}
```

## 5. Contrat image-exercice

Chaque exercice déclare : `image_required`, `image_role`, `question_depends_on_image`, `support_id`, `support_version`, `support_hash`, `required_elements`, `forbidden_elements`, `prompt`, `negative_prompt`, `prompt_version`, `reference_asset_ids`, `alt_text`, `source_ids`, licence, dimensions, contrôles, statut, version et hash publié.

Si la réponse dépend de l’image, toute modification invalide la validation des questions, distracteurs et corrigés.

## 6. Structures applicatives à ajouter

- `pedagogical_image_briefs` : besoin, rôle, mode, fonction, contraintes, prompt, sortie, droits, statut, version, hash et validateur.
- `image_generation_batches` : fournisseur, modèle, paramètres, volumes, estimation/coût, plafond, idempotence, dates, erreurs et manifestes.
- `exercise_image_assets` : liaison exercice-image-brief, rôle, ordre, dépendance de réponse, version, hash et validation.

La table existante `pedagogical_images` reste la banque des fichiers.

## 7. Contrôles automatiques

Mettre en quarantaine : format ou ratio incorrect ; fichier vide ; mauvais nombre d’éléments ; texte interdit détecté ; logo, filigrane ou donnée personnelle ; alt absent ; doublon ; absence de brief, source ou droits ; exercice évalué sans hash ; incohérence image-question-réponse.

La validation humaine pédagogique, civique et culturelle reste obligatoire.

## 8. Générateur Enterprise

```text
--dry-run
--only S01
--from S01 --to S05
--role contextual
--provider enterprise
--model <configuration>
--max-cost <montant>
--concurrency <nombre>
--resume <batch_id>
--validate-only
```

Les secrets restent côté serveur. La clé d’idempotence combine `resource_id + brief_hash + provider + model`.

## 9. Inventaire iconographique minimal

| Séance | Support maître | Mode | Risque |
|---|---|---|---|
| S1 | Repère des cinq thèmes et entretien d’accueil | SVG + illustration générique | Faible |
| S2 | Symboles sourcés et formulaire d’état civil fictif | Source + gabarit déterministe | Élevé si évalué |
| S3 | Numéros d’urgence et scène de soins | Source + illustration générique | Moyen |
| S4 | Parcours scolaire et message d’absence fictif | SVG + gabarit | Moyen |
| S5 | Immeuble, acteurs et médiation | SVG + illustration générique | Moyen |
| S6 | Offre, contrat et fiche de paie cohérents | Gabarit déterministe | Élevé |
| S7 | Notification de préfecture fictive | Gabarit déterministe | Élevé |
| S8 | Carte mentale de la Ve République | SVG déterministe | Moyen |
| S9 | Matrice agent, usager, élève, espace privé | SVG déterministe | Élevé |
| S10 | Schéma local-national et rôles | SVG déterministe | Élevé |
| S11 | Parcours justice et scène de plainte | SVG + illustration générique | Moyen |
| S12 | Parcours de protection | SVG, aucune scène traumatisante | Élevé |
| S13 | Continuum expression et limites | SVG déterministe | Élevé |
| S14 | Flux impôts-services et consignes locales | SVG + source locale | Moyen |
| S15 | Frise 1789-République | SVG déterministe | Élevé |
| S16 | France, territoires et Europe | Données fiables, jamais de carte IA | Élevé |
| S17 | Matrice personnalisée des erreurs E1 | Rendu depuis les résultats | Moyen |
| S18 | Courriel et fil administratif | Gabarit déterministe | Moyen |
| S19 | Échelle de communication et guichet | SVG + illustration générique | Moyen |
| S20 | Frise mémorielle et documents licenciés | Source uniquement | Très élevé |
| S21 | Arbre de décision et scènes civiques | SVG + illustrations figées | Très élevé si évalué |
| S22 | Structure EE et compteurs | SVG déterministe | Faible |
| S23 | Structure EO et cartes de rôles | SVG + gabarits | Faible |
| S24 | Tableau de temps et transitions | Rendu déterministe | Faible |
| S25 | Arbre d’orientation et rapport | Rendu déterministe | Moyen |
| S26 | Séparation des pouvoirs | SVG déterministe | Élevé |
| S27 | Balance droits-limites et cas | SVG déterministe | Élevé |
| S28 | Acteurs du travail et dossier social | SVG + gabarit | Moyen |
| S29 | Frise histoire-Europe-mémoire | Source + SVG | Élevé |
| S30 | Scènes d’implicite CR | Illustrations génériques figées | Très élevé si évalué |
| S31 | Simulation CR | Banque validée et verrouillée | Très élevé |
| S32 | Système constitutionnel | SVG déterministe | Élevé |
| S33 | Carte d’argumentation | SVG déterministe | Moyen |
| S34 | Corpus historique | Sources licenciées | Très élevé |
| S35 | Graphiques contemporains | Données sourcées + rendu | Très élevé |
| S36 | Simulation NAT | Banque validée et verrouillée | Très élevé |
| S37 | Carte de réponse B2 et entretien | SVG + illustration générique | Moyen |

Les évaluations E1-E4 ne déclenchent jamais de génération. Elles utilisent uniquement des images `published` et enregistrent version et hash.

## 10. Interface formateur

Afficher par séance les volumes `planned`, `generated`, `validated`, `published`, les alertes d’images non verrouillées, le brief et l’image côte à côte, la comparaison de versions et les actions Générer, Régénérer en brouillon, Valider, Rejeter et Publier.

Le bouton « Générer le lot du module » montre fournisseur, modèle, volume, coût estimé et plafond avant confirmation.

## 11. Critères d’acceptation

- `--dry-run` simule sans appel API ;
- `--only S01` ne génère que S01 ;
- aucune publication automatique ;
- version et hash obligatoires pour l’évalué ;
- modification d’image = revalidation question/corrigé ;
- A1/A2/B1/B2 partagent l’image maître ;
- textes et chiffres rendus de manière déterministe ;
- sources, droits et alt présents ;
- cohorte épinglée à ses versions ;
- pack hors ligne disponible avant le cours.

## 12. Ordre d’implémentation

1. créer les trois structures et leurs règles RLS ;
2. faire évoluer le plan JSON ;
3. rendre le générateur indépendant du fournisseur ;
4. retirer le texte génératif des images évaluées ;
5. ajouter contrôles, reprise, idempotence et plafond ;
6. construire la file de revue ;
7. relier images publiées, exercices et packs ;
8. tester S01, puis S1-S5, avant S1-S37.
## 13. Batch unique et intégration automatique

### Décision retenue

Une commande unique traite l’intégralité de S1 à S37. Elle génère, contrôle, téléverse et relie automatiquement les images aux séances et exercices. Les images arrivent dans CapTCF au statut `integrated_draft` : elles sont visibles dans la file de revue du formateur, mais jamais exposées aux apprenants avant validation.

```text
planned
  -> preflight_passed
  -> generating
  -> generated
  -> auto_checked
  -> integrated_draft
  -> trainer_validated
  -> published
```

Le batch ne s’arrête pas au premier échec. Il poursuit les autres ressources, réessaie chaque échec avec une consigne corrective et produit un rapport exhaustif. Il n’obtient le statut `ready_for_review` que lorsque 100 % des briefs obligatoires possèdent soit une image intégrée, soit une entrée explicite en quarantaine.

### Précontrôle global avant dépense

Aucun appel API ne démarre avant validation de tout le manifeste :

- 37 séances présentes et identifiants uniques ;
- tous les exercices référencés existent ;
- aucun exercice évalué sans brief iconographique ;
- éléments obligatoires et interdits, rôle, fonction et sortie renseignés ;
- prompt, version et texte alternatif présents ;
- stratégie de source et de droits présente ;
- mode de production autorisé pour le niveau de risque ;
- estimation de coût inférieure au plafond ;
- absence de collision de chemin, `resource_id` ou clé d’idempotence.

Si un contrôle échoue, le lot reste en `preflight_failed` et aucun appel payant n’est lancé.

### Vérification automatique de chaque image

#### Bloquants techniques

- fichier décodable et MIME autorisé ;
- dimensions, ratio et poids conformes ;
- checksum et hash perceptuel calculés ;
- aucun doublon non prévu ;
- chemin Supabase et manifeste cohérents.

#### Bloquants visuels

- nombre exact d’objets ou de panneaux demandé ;
- présence de tous les éléments obligatoires ;
- absence de tout élément interdit ;
- absence de texte lorsque le brief l’interdit ;
- OCR identique aux données structurées lorsqu’un texte déterministe est superposé ;
- absence de logo, filigrane, sceau, signature ou marque non autorisée ;
- absence de donnée personnelle, adresse, téléphone ou identité réelle ;
- absence d’indice révélant involontairement la bonne réponse ;
- cadrage ne coupant aucun élément nécessaire.

#### Bloquants pédagogiques

- cohérence entre image, consigne, question, options et corrigé ;
- une seule réponse défendable ;
- aucun distracteur rendu impossible par un détail parasite ;
- même image maître pour A1, A2, B1 et B2 ;
- niveau de complexité compatible avec la séance ;
- texte alternatif ne donnant pas la réponse ;
- lisibilité écran, mobile et impression.

#### Bloquants sensibles

- aucun document officiel recréé ;
- aucune carte géographique générée librement ;
- aucune fausse archive historique ou mémorielle ;
- aucune représentation traumatisante ;
- aucun stéréotype culturel, religieux, ethnique, professionnel ou de genre ;
- faits civiques, juridiques, historiques, sanitaires et administratifs rattachés à des sources validées.

### Régénération automatique ciblée

Une image en échec est régénérée au maximum trois fois. La nouvelle requête reprend le brief original et ajoute uniquement les motifs d’échec détectés. Tous les autres invariants restent inchangés.

Après trois échecs, l’image passe en `quarantined`. Elle n’est jamais remplacée par une image approximative ou un fichier vide.

### Intégration automatique dans CapTCF

Pour chaque réussite, le batch :

1. téléverse le fichier dans `pedagogical-images` ;
2. crée ou met à jour `pedagogical_images` ;
3. crée le lien dans `exercise_image_assets` ;
4. épingle `image_version`, `image_hash`, `brief_hash` et `prompt_version` ;
5. conserve les contrôles dans `raw.validation_report` ;
6. ajoute l’image au pack hors ligne ;
7. met la ressource au statut `integrated_draft`.

Une relance avec la même clé d’idempotence met à jour le brouillon au lieu de créer un doublon.

### File de revue progressive

Le tableau de bord présente les 37 séances dès la fin du batch avec progression, couverture, aperçu, exercice, réponse attendue, brief, contrôles et historique. Les actions sont `Valider`, `Rejeter`, `Régénérer`, `Remplacer` et `Publier`.

Le formateur peut corriger S1 aujourd’hui, S2 plus tard et conserver le reste en brouillon sans relancer le lot.

### Statut final du lot

- `ready_for_review` : couverture obligatoire à 100 %, aucune erreur silencieuse ;
- `needs_attention` : au moins une quarantaine ou un lien incomplet ;
- `published_partial` : certaines séances publiées, les autres en brouillon ;
- `published_complete` : toutes les séances nécessaires sont publiées.

Le batch unique produit et intègre automatiquement. Il ne publie jamais automatiquement.
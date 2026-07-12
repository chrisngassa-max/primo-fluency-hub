# S01 v3 — Rapport de régénération interactive

**Date :** 12 juillet 2026
**Statut :** régénérée et testée localement ; non publiée en production
**Pivot pédagogique :** A2

## Résultat

La séance 1 dispose désormais de deux sorties cohérentes :

1. un paquet formateur imprimable de 180 minutes en PDF et DOCX ;
2. un parcours apprenant numérique sous forme de playlist interactive.

Le parcours numérique contient **29 exercices** :

| Niveau | Activités |
|---|---:|
| A1 | 8 |
| A2 | 9 |
| B1 | 7 |
| B2 | 5 |

Répartition par compétence :

| Compétence | Exercices |
|---|---:|
| CO | 5 |
| CE | 10 |
| EE | 6 |
| EO | 4 |
| Structures | 4 |

## Améliorations concrètes

- A2 est formalisé comme niveau pivot.
- La famille principale de compréhension orale reste CO de A1 à B2.
- Les productions EO sont des prolongements séparés liés à la famille CO.
- La difficulté distingue repérage, extraction, justification, interprétation, autonomie, guidage et nuance.
- Chaque niveau possède au moins quatre activités interactives.
- Chaque exercice exige un aperçu formateur avant assignation.
- Les formats générés appartiennent tous aux formats compris par l’application.
- Les activités Structures sont présentes aux quatre niveaux.
- La playlist utilise une numérotation stable « Activité X sur N ».
- Les réponses EO utilisent le nouveau parcours : enregistrement, transcription, correction écrite et écoute TTS.

## Comparaison avec la séance historique

| Élément | Ancienne S01 | S01 v3 régénérée |
|---|---|---|
| Atelier différencié | famille CE limitée | famille CE de 5 questions par niveau + parcours numérique complet |
| Parcours apprenant | documents majoritairement PDF | 29 exercices interactifs |
| Niveau A2 | cible implicite | pivot déclaré |
| Expression orale | consignes génériques | 4 exercices EO avec restitution audio/transcription/corrigé |
| Structures | aucune couverture homogène | 1 activité interactive par niveau |
| Pilotage | ordre figé | playlist réordonnable, clonable et testable |
| Validation | booléens et revue factice historique | rapport de règles structuré et tests déterministes |

## Contrôles automatisés

- INTERACTIVE_FORMAT_SUPPORTED : PASS
- MINIMUM_FOUR_ACTIVITIES_PER_LEVEL : PASS
- TRAINER_PREVIEW_REQUIRED : PASS
- COMPETENCE_FAMILY_PRESERVED : PASS
- Tests dédiés S01 interactive : 5/5 PASS
- Tests famille S01 et pont de publication : 18/18 PASS

## Améliorations encore nécessaires avant publication

1. **Audio réel.** Le dialogue est calibré à environ 2 min 29 s, mais le MP3 définitif doit encore être produit et mesuré avec la voix réellement utilisée.
2. **Validation civique officielle.** Les affirmations civiques doivent être reliées à la base officielle structurée avec provenance, version et date d’effet. Le RAG seul ne constitue pas une validation.
3. **Chronométrage terrain.** Les durées des exercices sont initialisées mais doivent être recalibrées à partir des premières tentatives réelles.
4. **Charge B2.** Le parcours B2 comporte cinq activités ; c’est conforme au minimum, mais moins riche que le parcours A2. Une activité CE ou Structures supplémentaire est recommandée après observation terrain.
5. **Publication en banque.** Le fichier interactif est prêt pour le pont, mais aucune écriture en production n’a été faite dans cette régénération.

## Fichiers de référence

- content/curriculum/v2/S01-v3/exercices-interactifs.json
- scripts/curriculum/generate-s01-interactive.mjs
- scripts/curriculum/generate-s01-interactive.test.mjs
- docs/seance-1-v3-validation/

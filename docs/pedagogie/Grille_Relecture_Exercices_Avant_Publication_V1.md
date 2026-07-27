# Grille de relecture des exercices avant publication — CapTCF V1

Statut : **candidat opérationnel — validation pédagogique humaine requise**  
Contrat machine : `supabase/functions/_shared/referential/exercise_coherence_rules_v1.json`  
Validateur : `scripts/curriculum/lib/exercise-coherence-validator.mjs`

## 1. Pourquoi cette grille

La qualité d’une consigne ne suffit pas. Un exercice peut avoir une consigne claire mais rester inutilisable : phrase à trou sans phrase, bonne réponse absente des options, banque de mots incomplète, justification sans critères ou correction impossible à restituer.

Cette grille forme la dernière barrière entre un exercice généré et sa publication apprenant. Chaque contrôle produit un statut, une preuve, le champ concerné et une erreur. Une erreur bloquante conserve le brouillon formateur mais empêche la publication.

## 2. Couches de contrôle

| Couche | Objet | Statut actuel |
|---|---|---|
| Qualité des consignes | objet, action, réponse attendue, jargon, longueur, fuite | Opérationnelle sur S01 |
| Différenciation | niveau, compétence, transformation, support, faits | Opérationnelle sur S01 |
| Cohérence structurelle | relation consigne ↔ items ↔ format ↔ réponses ↔ correction | V1 ajoutée par cette grille |
| Validation humaine | pertinence, authenticité, intérêt pédagogique, exactitude civique | Toujours obligatoire avant validation définitive |

L’ancien `exercise-validator.ts` couvre quelques champs génériques mais n’est pas suffisant : il ne vérifie pas les trous visibles, les banques de mots, la correction riche ou le contrat de justification, et certaines de ses anciennes règles de longueur/support ne correspondent plus au référentiel actuel.

## 3. Grille automatique commune

| Code | Contrôle | Sévérité |
|---|---|---|
| `COHERENCE_ITEMS_PRESENT` | L’exercice contient au moins un item | Bloquant |
| `COHERENCE_QUESTION_PRESENT` | Chaque item possède un énoncé affichable | Bloquant |
| `COHERENCE_DUPLICATE_QUESTION` | Deux items ne répètent pas involontairement la même question | Avertissement |
| `COHERENCE_CLOSED_ANSWER_PRESENT` | Chaque item fermé possède une réponse attendue | Bloquant |
| `COHERENCE_OPTIONS_REQUIRED` | Les formats à choix possèdent assez d’options non vides | Bloquant |
| `COHERENCE_OPTIONS_UNIQUE` | Les options d’un item sont différentes | Bloquant |
| `COHERENCE_ANSWER_IN_OPTIONS` | La bonne réponse appartient aux options affichées | Bloquant |
| `COHERENCE_DISTRACTOR_COUNT` | Le nombre d’autres propositions est suffisant | Avertissement |
| `COHERENCE_TRUE_FALSE_DOMAIN` | Une réponse Vrai/Faux appartient au domaine autorisé | Bloquant |
| `COHERENCE_GAP_COUNT` | Chaque item lacunaire affiche exactement un trou | Bloquant |
| `COHERENCE_GAP_ANSWER_HIDDEN` | Le mot attendu n’est pas déjà visible dans la phrase | Bloquant |
| `COHERENCE_WORD_BANK` | La banque est unique, contient la réponse et au moins deux mots | Bloquant |
| `COHERENCE_DECLARED_COUNT_MATCH` | Les nombres annoncés par la consigne correspondent à ce qui est affiché | Bloquant |
| `COHERENCE_JUSTIFICATION_CONTRACT` | Toute justification demandée possède attentes et critères de correction | Bloquant |
| `COHERENCE_CORRECTION_COMPLETE` | Chaque item fermé possède réponse, preuve, explication et remédiation | Bloquant |
| `COHERENCE_OPEN_RUBRIC` | Toute production possède un modèle ou des critères de réussite | Bloquant |
| `COHERENCE_WORKED_EXAMPLE_REQUIRED` | Un exemple corrigé est présent lorsque la politique de l’exercice l’exige | Bloquant |
| `COHERENCE_WORKED_EXAMPLE_COMPLETE` | L’exemple contient consigne, question, réponse et étapes d’explication | Bloquant |
| `COHERENCE_WORKED_EXAMPLE_FORMAT_MATCH` | L’exemple utilise le même format que l’exercice | Bloquant |
| `COHERENCE_WORKED_EXAMPLE_LEVEL_MATCH` | L'exemple est calibré pour le même niveau que l'exercice | Bloquant |
| `COHERENCE_WORKED_EXAMPLE_DUPLICATE_ITEM` | L’exemple ne reproduit aucune vraie question | Bloquant |
| `COHERENCE_WORKED_EXAMPLE_ANSWER_LEAK` | L’exemple ne révèle aucune réponse des vrais items | Bloquant |

## 4. Contrôles par format

### QCM

- question présente ;
- au moins deux options, trois recommandées ;
- options non vides et non dupliquées ;
- une réponse attendue présente dans les options ;
- explication des autres propositions ;
- preuve issue du support ;
- remédiation exploitable.

### Vrai/Faux

- question ou affirmation présente ;
- choix rendus comme Vrai/Faux ;
- réponse limitée à Vrai/Faux ;
- preuve et explication après libération.

### Appariement

Dans l’interface actuelle, chaque association est rendue comme un choix parmi plusieurs possibilités. La grille vérifie donc les options, l’unicité, la réponse et les explications comme pour un QCM. Une future interface glisser-déposer nécessitera un contrat gauche/droite distinct.

### Texte lacunaire

- exactement un trou visible dans l’item actuellement affiché ;
- phrase support complète autour du trou ;
- réponse absente de la phrase avant validation ;
- banque de mots cohérente lorsqu’elle est utilisée ;
- nombre de trous annoncé cohérent avec l’affichage ;
- phrase corrigée et remédiation disponibles après libération.

### Transformation et Structures

- phrase source présente ;
- résultat attendu non vide ;
- modèle ou règle identifiable ;
- correction structurée avec preuve et remédiation.

### Production écrite

- situation et production attendue explicites ;
- longueur ou contraintes réalistes ;
- critères de réussite ou modèle non exclusif ;
- aucune réponse unique imposée lorsque plusieurs formulations sont recevables.

### Production orale

- question enregistrable et autonome ;
- critères portant sur le contenu et, si prévu, prononciation, fluidité et cohérence ;
- transcription et restitution accessibles après correction ;
- modèle oral présenté comme exemple, jamais comme unique réponse.

## 5. Relecture humaine finale

Pour chaque exercice, le formateur valide :

| Vérification | Oui | Non | Commentaire |
|---|---:|---:|---|
| La consigne correspond exactement à ce qui apparaît à l’écran | ☐ | ☐ | |
| L’élève comprend ce qu’il doit produire sans aide orale | ☐ | ☐ | |
| Le nombre d’items est suffisant pour mesurer la compétence | ☐ | ☐ | |
| Les erreurs proposées sont plausibles et liées au support | ☐ | ☐ | |
| La difficulté correspond au niveau annoncé | ☐ | ☐ | |
| La correction explique réellement l’erreur | ☐ | ☐ | |
| La remédiation permet une nouvelle tentative utile | ☐ | ☐ | |
| Les faits civiques possèdent une provenance officielle valide | ☐ | ☐ | |
| L’affichage mobile a été testé | ☐ | ☐ | |
| L’exemple corrigé montre la méthode sans révéler les vrais items | ☐ | ☐ | |
| L’exercice peut être publié sans modification | ☐ | ☐ | |

## 6. Décision

- `pass` automatique + validation humaine : publication autorisable ;
- avertissement : revue formateur obligatoire ;
- erreur bloquante : publication apprenant interdite, brouillon conservé ;
- aucune IA ne peut lever seule un blocage civique, factuel ou pédagogique.

## 7. Limites de la V1

- La plausibilité sémantique des distracteurs nécessite encore une revue humaine ou un contrôle sémantique non bloquant.
- Les productions ouvertes nécessitent une calibration des grilles sur des réponses réelles.
- La qualité audio et le rendu mobile doivent être testés dans l’application réelle.
- Le contrat est branché au moteur dynamique via `exercise-validator.ts` et la couche L1 de `validation-chain.ts`. Les anomalies structurelles bloquantes empêchent la publication ; les exigences de correction des contenus historiques restent en avertissement dans le profil `legacy_bank`.
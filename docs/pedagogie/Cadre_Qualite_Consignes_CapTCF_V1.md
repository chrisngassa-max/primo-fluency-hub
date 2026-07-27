# Cadre de qualité des consignes — CapTCF V1

Statut : **proposition opérationnelle à valider humainement**
Référence principale : `Rapport_Reference_Differenciation_CapTCF_V2.md`
Contrat machine : `supabase/functions/_shared/referential/instruction_quality_rules_v1.json`

## 1. Objet

Ce cadre définit les règles de rédaction et de validation des textes affichés à l'apprenant : consigne générale, question, demande de justification et indice. Il complète le référentiel de différenciation existant ; il ne modifie ni la compétence de la famille, ni les faits du support, ni les contrats CECRL.

Une consigne valide permet à l'apprenant de comprendre, sans aide du formateur :

1. sur quel objet il travaille ;
2. quelle action il doit réaliser ;
3. où ou comment il doit répondre ;
4. ce qui est attendu s'il doit justifier ;
5. dans quel ordre effectuer plusieurs actions.

## 2. Gabarit minimal

Une consigne comporte au minimum :

> **Objet + action observable + mode de réponse.**

Exemple :

> Dans chaque phrase, un mot manque. Choisissez parmi les quatre propositions le mot qui complète correctement la phrase.

Pour plusieurs actions, les étapes sont séparées par « puis », « ensuite » ou une numérotation :

> Choisissez le mot qui complète correctement la phrase. Ensuite, expliquez quels éléments de la phrase vous ont aidé et pourquoi une autre proposition ne convient pas.

## 3. Principes obligatoires

### 3.1 Action observable

Employer un verbe directement exécutable : choisir, compléter, associer, classer, écouter, écrire, enregistrer, expliquer, justifier, transformer.

Éviter une action vague isolée : analyser, développer, commenter, réfléchir. Si ce verbe est nécessaire en B1/B2, préciser l'objet, les critères et le mode de réponse.

### 3.2 Langage destiné à l'apprenant

Le vocabulaire technique de conception reste invisible pour l'apprenant.

| À éviter | Pourquoi | Formulation destinée à l'apprenant |
|---|---|---|
| distracteur | jargon de conception de QCM | une autre réponse qui pourrait sembler possible |
| exemple d'emploi | « emploi » peut être compris comme travail | phrase |
| mot approprié | critère de réussite abstrait | mot qui complète correctement la phrase |

Un terme disciplinaire nécessaire doit être défini avant son utilisation.

### 3.3 Aucune fuite de réponse

La bonne réponse ne doit apparaître ni dans la question, ni dans la consigne, ni dans la demande de justification, ni dans un indice — sauf présence intentionnelle parmi des options de réponse d'une phrase à trou.

Exemple interdit :

> Justifiez votre choix à partir de la définition de « droit ».

Exemple conforme :

> Expliquez quels éléments de la phrase vous ont aidé et pourquoi une autre proposition ne convient pas.

### 3.4 Cohérence du parcours

Le titre, la consigne, le format interactif, les items et la correction décrivent la même tâche. Un exercice intitulé « Associer un mot à sa définition » ne peut pas demander en réalité de compléter une phrase sans adapter son titre.

### 3.5 Affichage mobile

La consigne principale doit rester lisible sans long défilement. Les plafonds machine sont de 180 caractères en A1, 220 en A2, 280 en B1 et 340 en B2. Un dépassement produit un avertissement, pas une troncature automatique.

## 4. Différenciation des consignes

La langue de la consigne ne doit pas créer artificiellement la difficulté. La progression porte d'abord sur l'opération cognitive, l'autonomie et le type de réponse.

| Niveau | Forme privilégiée |
|---|---|
| A1 | une action à la fois, vocabulaire fréquent, aide visible ou accessible |
| A2 | une ou deux actions explicites, résultat attendu clairement nommé |
| B1 | justification ciblée à partir d'éléments identifiables du support |
| B2 | analyse ou justification structurée, critères explicités, aucune complexité lexicale gratuite |

Une consigne B2 n'est pas meilleure parce qu'elle est plus longue. Elle est plus exigeante si elle demande une opération cognitive réellement différente ou une justification plus précise.

## 5. Règles machine

Chaque contrôle produit un rapport structuré : règle, statut, champ concerné, preuve, erreur et proposition de réécriture lorsqu'elle est déterministe.

Codes principaux :

- `INSTRUCTION_JARGON_UNEXPLAINED`
- `INSTRUCTION_ACTION_MISSING`
- `INSTRUCTION_OUTPUT_UNCLEAR`
- `INSTRUCTION_MULTISTEP_UNMARKED`
- `INSTRUCTION_FORMAT_MISMATCH`
- `INSTRUCTION_ANSWER_LEAK`
- `INSTRUCTION_TOO_COMPLEX`
- `INSTRUCTION_TITLE_MISMATCH`

Une erreur de sévérité `blocking` empêche le lien apprenant mais conserve le brouillon formateur et son rapport. Un avertissement exige une revue sans bloquer automatiquement.

### 5.1 Combinaison avec le référentiel de différenciation

Les deux contrôles sont complémentaires :

- le référentiel de différenciation vérifie la compétence, le niveau, l’opération cognitive, les aides et la correction ;
- le présent cadre vérifie que l’apprenant comprend l’objet, l’action et le mode de réponse.

La décision la plus restrictive s’applique. Une erreur bloquante de l’un ou l’autre référentiel empêche la publication apprenant. Un résultat `pass` ne neutralise jamais un résultat `fail`. Les rapports et les codes restent séparés afin que le formateur connaisse la cause exacte du blocage.

### 5.2 Méthode de détection des fuites

Le contrôle déterministe bloque une réponse littéralement présente dans une consigne, une question, un indice ou une demande de justification, après normalisation de la casse, des accents et de la ponctuation. Des exceptions explicites couvrent les réponses catégorielles courtes, les phrases à trou et les options volontairement affichées.

Ce contrôle ne prétend pas détecter toutes les paraphrases. Une détection sémantique ultérieure ne pourra produire qu’un avertissement accompagné d’une preuve. Elle ne deviendra jamais bloquante sur le seul verdict d’une IA ; les cas ambigus exigent une validation humaine.

### 5.3 Position dans le pipeline

Le contrôle s’applique à deux moments :

1. **préventif**, dans les directives de génération, afin de guider la rédaction ;
2. **détectif**, après génération et avant publication, afin de vérifier chaque texte réellement produit.

Dans la version actuelle, le contrôle détectif est actif sur le corpus statique S01. Le contrat est partagé entre Node et Deno, mais son injection préventive dans `buildPedagogicalDirectives()` et son application complète au moteur dynamique restent à réaliser après validation humaine du corpus candidat.

### 5.4 Corpus candidat S01

Le fichier `instruction_quality_calibration_s01_v1.json` contient vingt cas couvrant les quatre niveaux, les cinq compétences et les principaux formats. Il associe des consignes S01 actuelles à des cas historiques ou volontairement altérés pour tester les erreurs.

Son statut est `candidate_pending_human_validation`. Les verdicts enregistrés sont des attentes machine destinées aux tests ; ils ne constituent pas une validation pédagogique humaine.
## 6. Gouvernance

- Le JSON partagé est la source machine unique pour le générateur statique et, après branchement, le moteur dynamique.
- Toute nouvelle expression interdite doit comporter une raison et une reformulation proposée.
- Une IA ne valide pas seule une règle pédagogique nouvelle.
- La validation humaine de cette V1 doit préciser le responsable, la date et la version approuvée.
- Les changements du contrat sont couverts par des tests négatifs et un audit du corpus avant publication.

## 7. Décisions ouvertes

1. Valider les plafonds de longueur après observation sur téléphone.
2. Maintenir `INSTRUCTION_MULTISTEP_UNMARKED` en avertissement ; toute évolution éventuelle, notamment en A1/A2, exige une calibration terrain et une décision humaine versionnée.
3. Valider la liste initiale des termes interdits et leurs reformulations.
4. Étendre le contrat au moteur dynamique et aux contenus hors S01 après validation de la V1.
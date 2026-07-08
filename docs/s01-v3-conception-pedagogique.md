# S01 v3 — Conception pédagogique détaillée (maquette texte, validable avant génération)

**Statut** : maquette de contenu — **aucun PDF/DOCX généré à ce stade**. Aucune écriture Supabase. Aucun MP3.
**Périmètre** : S01 uniquement. S02–S05 non touchées.
**Date** : 8 juillet 2026
**Base** : audit `docs/s01-v3-conception-pedagogique.md` (ce document) construit à partir de l'inventaire précédent — réutilisation prioritaire de la banque Supabase (`public.exercices`, `public.pedagogical_activities`), complément par création uniquement là où la banque est insuffisante.

---

## 0. Rappel des personnages et invariants (inchangés, conformes à `content/curriculum/v2/S01/brief.json`)

- **Support invariant** : `S01-support-accueil` — Awa Diallo (apprenante primo-arrivante) se présente le premier jour de sa formation à Mme Rossi (formatrice), explique son objectif administratif (carte de séjour pluriannuelle) et découvre l'organisation du parcours.
- **Faits invariants** (ne changent jamais entre niveaux) : parcours CSP = 80 h ; 25 séances collectives de 3 h ; une séance/semaine ; deux évaluations hors séances (E1 après 50 h, E2 à 80 h) ; cinq thèmes civiques officiels ; distinction droit/devoir/règle.
- **Thème civique** : "Droits et devoirs", mention CSP.
- **Support visuel invariant** : `S01-VIS-master` — cinq panneaux SVG (Principes et valeurs de la République / Système institutionnel et politique / Droits et devoirs / Histoire, géographie et culture / Vivre dans la société française). **Conservé tel quel** (pertinent, pas de bug de type "questions hors-sujet" détecté sur ce support pour S01).

---

## 1. Déroulé formateur — 180 minutes détaillé

### Phase 1 — Rituel civique (10 min)

**Objectif** : découvrir les cinq thèmes civiques du parcours sans notation, mise en confiance.

**Consigne formateur** : *"Aujourd'hui, avant de commencer, regardons ensemble les cinq grands thèmes que nous allons voir pendant toute la formation. Ce n'est pas un test, juste une découverte."*

**Activité apprenant** : observation collective du support visuel `S01-VIS-master`, lecture à voix haute des cinq intitulés par des volontaires.

**Questions exactes à poser** :
1. "Combien de panneaux voyez-vous ?" (réponse attendue : cinq)
2. "Quel est le premier thème, à gauche ?" (Principes et valeurs de la République)
3. "Selon vous, que veut dire 'vivre dans la société française' ?" (réponse ouverte, aucune bonne réponse imposée à ce stade)

**Relances possibles** : "Est-ce qu'un de ces mots vous fait déjà penser à quelque chose que vous connaissez dans votre pays ?"

**Correction/feedback** : aucune correction formelle — validation orale bienveillante de toute réponse raisonnable.

**Adaptation** : A1 — pointer du doigt les couleurs plutôt que lire ; B1/B2 — demander une reformulation complète de chaque intitulé.

**Ressource utilisée** : `content/curriculum/v2/S01/brief.json` → `visual` (S01-VIS-master), inchangé.

---

### Phase 2 — Activation + lexique (20 min)

**Objectif** : installer les 10 mots-clés de la séance avant l'écoute du dialogue.

**Consigne formateur** : *"Voici les mots importants d'aujourd'hui. On va les lire, les comprendre, puis les utiliser."*

**Activité apprenant** : lecture silencieuse (3 min) → lecture à voix haute par binômes (5 min) → 3 exercices lexicaux (12 min, détail section 3).

**Questions exactes** : "Que veut dire 'parcours' pour vous ?" / "Connaissez-vous un synonyme de 'progresser' ?"

**Relances** : si blocage sur "démarche" → mimer l'action d'aller d'un point A à un point B.

**Correction/feedback** : correction collective immédiate à l'oral après chaque exercice écrit.

**Adaptation** : A1 — appui sur les exercices Structures les plus simples (pronoms, verbe être) ; B1/B2 — exercice de réemploi oral libre en plus.

**Ressource utilisée** : `lexique-A1-B2.json` (10 mots, inchangé) + 3 exercices détaillés section 3 (`26254e2b-63e0-440e-ae49-9373ea5e9e5a`, `f4fe558a-43dc-4768-b5bb-4d5393557e98`, création nouvelle pour le réemploi oral).

---

### Phase 3 — Support invariant CO/CE (50 min)

**Objectif** : comprendre le dialogue Awa/Mme Rossi à trois niveaux de granularité (globale → ciblée → détaillée).

**Consigne formateur** : *"Nous allons écouter trois fois un dialogue entre une nouvelle apprenante et sa formatrice. Première écoute : ne cherchez pas les détails, juste l'idée générale."*

**Déroulement en sous-étapes** :
- **1ère écoute globale (10 min)** : sans transcription. Questions 1-3 (compréhension globale, section 2).
- **2ème écoute ciblée (15 min)** : repérage des chiffres et mots du lexique. Questions 4-10 (repérage d'info + lexique, section 2).
- **3ème écoute + transcription (10 min)** : distribution du texte, lecture silencieuse, correction phonétique des liaisons ("les_évaluations", "vingt-cinq").
- **Exploitation écrite (15 min)** : questions 11-20 (vrai/faux, reformulation, justification, extension orale, section 2), à l'écrit puis mise en commun orale.

**Relances possibles** : "Pourquoi Mme Rossi demande-t-elle à Awa d'épeler son nom ? Qu'est-ce que ça vous dit sur l'importance de l'orthographe dans les démarches administratives ?"

**Correction/feedback** : corrigé collectif question par question, avec citation exacte de la réplique du dialogue qui contient la réponse (traçabilité pour l'apprenant).

**Adaptation** :
- A1 : questions 1-13 uniquement (globale, repérage, lexique, vrai/faux), avec le texte sous les yeux dès la 2e écoute.
- A2 : questions 1-17 (+ reformulation guidée avec amorces).
- B1 : toutes les questions, reformulation autonome.
- B2 : toutes les questions + question 18 développée à l'écrit (150 mots).

**Ressource utilisée** : dialogue enrichi (section 2), inspiré du script existant `content/curriculum/v2/S01/audio/CO-script.md`, mêmes personnages/faits/invariants.

---

### Phase 4 — Ateliers différenciés A1-B2 (60 min)

**Objectif** : quatre groupes travaillent en autonomie leur variante du même support, avec rotation du formateur.

**Consigne formateur générale** : *"Vous allez travailler en petit groupe selon votre niveau. Je passerai voir chaque groupe. N'hésitez pas à demander de l'aide."*

| Sous-groupe | Durée effective | Contenu | Ressource |
|---|---:|---|---|
| **A1** | ~45-50 min de matériel | Bloc grammaire A1 (être, pronoms, s'appeler/habiter) + 6 exercices banque identité (CO/CE/EO simples) + variante A1 corrigée | `26254e2b`, `f4fe558a`, `19a3f6b2`, `4c983a50` (CO épeler), `77dcd9d8` (carte identité V/F), `4a85ed79` (Q/R identité), variante `cv2:S01:variant:A1` (needs_review, à corriger — voir §11) |
| **A2** | ~45-50 min | Bloc grammaire A2 (possessifs, texte lacunaire présentation) + exercices identité intermédiaires + variante A2 **recréée** (l'originale est `rejected`) | `475e1e27`, `2a162e99`, `afd658af`, `95f4746e` (fiche identité) — variante A2 recréée section 4/11 |
| **B1** | ~40-45 min | Bloc grammaire B1 (nominalisation, discours rapporté simple) + module "se présenter" en approfondissement + variante B1 **recréée** | Création nouvelle (banque B1 pauvre sur ce thème précis) + inspiration `tcf_act1_se_presenter` |
| **B2** | ~40-45 min | Bloc grammaire B2 (connecteurs argumentatifs, nuance) + argumentation sur l'organisation du parcours + variante B2 **recréée** | Création nouvelle + inspiration `sim_glob_phase2_identites` |

**Questions exactes, relances, correction** : voir sections 4 (grammaire) et 11 (traçabilité) pour le détail exercice par exercice.

**Adaptation** : le formateur peut allonger l'atelier de 10 min au détriment de la fixation si le groupe est très hétérogène (règle héritée de `adaptation_rules` existante).

---

### Phase 5 — Production EE/EO (30 min)

**Objectif** : réemploi communicatif — chaque apprenant se présente et explique son propre objectif administratif.

**Consigne formateur** : *"À votre tour maintenant. Vous allez vous présenter comme Awa, avec vos propres informations."*

**Déroulement** : EO (15 min, prompts gradés section 7) → EE (15 min, productions guidées section 8).

**Correction/feedback** : grille de critères par niveau (section 7/8), retour individuel bref pendant la rotation.

**Ressource utilisée** : voir sections 7 et 8.

---

### Phase 6 — Fixation (10 min)

**Objectif** : synthèse, mini-diagnostic civique, devoir personnalisé.

**Consigne formateur** : *"Pour terminer, un petit questionnaire sur ce qu'on a appris aujourd'hui sur les droits, devoirs et règles."*

**Activité apprenant** : QCM civique 10 questions (section 6), correction flash collective (3 min), explication des devoirs différenciés (2 min).

**Ressource utilisée** : QCM civique section 6 (5 questions Supabase `cv2:S01:civic:0-4` + 5 créées) + devoirs section 10.

---

## 2. Dialogue CO enrichi

**Cible** : 2 min 25 s à 2 min 35 s (estimation à ~2 mots/seconde, méthode utilisée pour S02-S05).
**Résultat** : **298 mots → 149 s = 2 min 29 s** ✅ dans la plage, proche de la cible 2 min 30 s.
**Personnages inchangés** : Awa Diallo (apprenante), Mme Rossi (formatrice). **Faits inchangés** : tous ceux de `brief.json.support.faits`.

### Script complet

```
Mme Rossi : Bonjour, bienvenue dans votre nouveau parcours. Comment vous appelez-vous ?
Awa : Bonjour madame. Je m'appelle Awa. Awa Diallo.
Mme Rossi : Enchantée, Awa. Pouvez-vous épeler votre nom de famille, s'il vous plaît ?
Awa : Oui, bien sûr : D-I-A-L-L-O.
Mme Rossi : Merci. Quel est votre objectif aujourd'hui ?
Awa : Je voudrais avoir ma carte de séjour pluriannuelle.
Mme Rossi : Très bien. Pour ça, vous allez suivre un parcours de quatre-vingts heures.
Awa : Quatre-vingts heures ? C'est beaucoup !
Mme Rossi : Oui, mais c'est réparti sur vingt-cinq séances de trois heures, à raison d'une séance par semaine.
Awa : D'accord. Et qu'est-ce qu'on va apprendre exactement ?
Mme Rossi : Vous allez apprendre le français pour la vie quotidienne, et aussi cinq thèmes sur la vie en France : la République, les institutions, les droits et devoirs, l'histoire et la vie en société.
Awa : Il y a un examen à la fin ?
Mme Rossi : Il y a deux évaluations : une évaluation intermédiaire après cinquante heures, et une évaluation finale à la fin des quatre-vingts heures.
Awa : Je comprends. Merci beaucoup madame.
Mme Rossi : Une dernière chose : connaissez-vous la différence entre un droit, un devoir et une règle ?
Awa : Pas très bien, madame.
Mme Rossi : Un droit, c'est quelque chose que vous pouvez demander, comme le droit à la santé. Un devoir, c'est quelque chose que vous devez faire, comme respecter la loi. Une règle, c'est une consigne précise, par exemple arriver à l'heure en formation.
Awa : D'accord, je comprends mieux maintenant.
Mme Rossi : Parfait, nous allons travailler cela ensemble pendant toute la formation. Bienvenue parmi nous, Awa !
Awa : Merci madame, je suis contente de commencer.
```

**Changement vs script actuel** : ajout de l'échange sur l'épellation du nom (ancrage direct avec les exercices banque `Épeler son nom`), légère reformulation de l'exemple de "règle" (passage de "règlement intérieur" à "arriver à l'heure en formation", plus concret et directement réutilisable dans le corrigé civique). Aucun fait, chiffre, date ou personnage modifié.

### 20 questions / micro-tâches

| # | Catégorie | Question exacte | Réponse attendue |
|---|---|---|---|
| 1 | Compréhension globale | Qui sont les deux personnes qui parlent ? | Awa Diallo (apprenante) et Mme Rossi (formatrice) |
| 2 | Compréhension globale | À votre avis, à quel moment de la formation se passe cette scène ? | Le premier jour |
| 3 | Compréhension globale | Quel est l'objectif principal d'Awa ? | Obtenir sa carte de séjour pluriannuelle |
| 4 | Repérage d'information | Combien d'heures dure le parcours d'Awa ? | 80 heures |
| 5 | Repérage d'information | Combien de séances va-t-elle suivre ? | 25 séances |
| 6 | Repérage d'information | Combien de temps dure chaque séance ? | 3 heures |
| 7 | Repérage d'information | À quel rythme ont lieu les séances ? | Une par semaine |
| 8 | Repérage d'information | Après combien d'heures a lieu la première évaluation (E1) ? | 50 heures |
| 9 | Lexique | Que signifie le mot "parcours" dans le dialogue ? | L'ensemble du chemin de formation à suivre |
| 10 | Lexique | Que veut dire "épeler" son nom ? | Dire chaque lettre du nom une par une |
| 11 | Vrai/Faux | Awa connaît déjà bien la différence entre droit, devoir et règle. | Faux ("Pas très bien, madame") |
| 12 | Vrai/Faux | Le parcours couvre cinq thèmes sur la vie en France. | Vrai |
| 13 | Vrai/Faux | Il y a une seule évaluation à la fin du parcours. | Faux — il y en a deux (E1 et E2) |
| 14 | Reformulation | Reformulez avec vos mots ce qu'est un "droit" selon Mme Rossi. | Quelque chose qu'on peut demander (ex. droit à la santé) |
| 15 | Reformulation | Reformulez avec vos mots ce qu'est un "devoir" selon Mme Rossi. | Quelque chose qu'on doit faire (ex. respecter la loi) |
| 16 | Reformulation | Reformulez ce qu'est une "règle", avec l'exemple donné. | Une consigne précise (ex. arriver à l'heure) |
| 17 | Justification | Pourquoi Mme Rossi demande-t-elle à Awa d'épeler son nom ? | Pour bien noter l'orthographe exacte — important dans les démarches administratives |
| 18 | Justification | À votre avis, pourquoi le parcours comprend-il deux évaluations plutôt qu'une seule ? | Réponse ouverte (ex. mesurer la progression à mi-parcours puis valider l'ensemble) |
| 19 | Extension orale | À votre tour : présentez-vous comme Awa (nom, objectif administratif). | Réponse libre, critères section 7 |
| 20 | Extension orale | Imaginez une question supplémentaire qu'Awa pourrait poser à Mme Rossi sur le parcours. | Réponse libre |

**Répartition par niveau** : A1 → items 1-13 ; A2 → 1-17 ; B1/B2 → 1-20 (voir Phase 3, adaptation).

---

## 3. Lexique

**10 mots existants (inchangés)** : parcours, niveau, objectif, démarche, droit, devoir, République, examen, séance, progresser.

### Exercice 1 — Association (nouveau, inspiré du format banque `appariement`)
Associer chaque mot à sa définition simplifiée (format identique à `4a85ed79-4f1a-4c62-98df-18f111e82a73` "Questions/Réponses sur l'identité", adapté au lexique S01).

| Mot | Définition à associer |
|---|---|
| parcours | Ensemble des séances à suivre pour atteindre un objectif |
| démarche | Une action pour obtenir un document ou un droit |
| progresser | Avancer, s'améliorer petit à petit |

### Exercice 2 — Phrase à compléter (texte lacunaire, format `2a162e99`/`c1fa478c`)
*"Awa suit un (........) de 80 heures. Son (........) est d'obtenir sa carte de séjour. Elle doit respecter les (........) du centre de formation, comme arriver à l'heure."*
→ parcours / objectif / règles

### Exercice 3 — Réemploi oral (créé, inspiré de `tcf_oral_guide_task1_act1`)
*"En une phrase, expliquez pourquoi vous suivez ce parcours, en utilisant le mot 'objectif' ou 'démarche'."* — critère : usage correct du mot dans une phrase complète.

**Traçabilité** : Exercice 1 et 2 adaptés de formats banque existants (ids cités), Exercice 3 créé (aucun équivalent direct en banque pour un réemploi oral du lexique spécifique de S01).

---

## 4. Bloc grammaire / structures — se présenter, identité, parcours

| Niveau | Point de grammaire | Exercice | Source |
|---|---|---|---|
| **A1** | Verbe être au présent | "Elle ___ française. / Je ___ marié. / Le dossier ___ complet." | Banque `26254e2b-63e0-440e-ae49-9373ea5e9e5a` (réutilisé tel quel) |
| **A1** | Pronoms personnels d'identité | "___ m'appelle Ahmed. / ___ habite à Marseille. (Sonia)" | Banque `f4fe558a-43dc-4768-b5bb-4d5393557e98` (réutilisé tel quel) |
| **A1** | Verbes s'appeler/habiter au présent | "Comment tu ________ ? / Il ________ à Paris." | Banque `19a3f6b2-58ae-428e-b9d8-fa6ffdfaec2f` (réutilisé tel quel) |
| **A2** | Adjectifs possessifs (identité/papiers) | "Je vous présente ___ passeport. / C'est ___ carte d'identité." | Banque `475e1e27-d7d0-4ecd-b003-b5b84537d530` (réutilisé tel quel) |
| **A2** | Structure "je m'appelle / je suis / j'habite" | Texte à trous complet (Ahmed ou Thomas Martin) | Banque `c1fa478c` ou `2a162e99` (réutilisé, un des deux au choix du formateur) |
| **B1** | Nationalité/pays-ville : "venir de" + "habiter à" + nationalité adjectivée | **Créé** : "Transformez : 'Il est né en Algérie, il vit à Lyon.' → 'C'est un Algérien qui habite à Lyon.'" (3 items sur le modèle) | Création (banque B1 pauvre sur ce point précis) |
| **B1** | Discours rapporté simple (identité) | **Créé** : "Awa a dit qu'elle ________ (s'appeler) Awa Diallo et qu'elle ________ (vouloir) sa carte de séjour." | Création, inspirée de la structure du dialogue |
| **B2** | Nominalisation droits/devoirs ("avoir le droit de" → "le droit à") | **Créé** : "Reformulez : 'Vous pouvez demander l'accès aux soins' → 'Vous avez ___ à ___.'" | Création |
| **B2** | Connecteurs argumentatifs (nuance) | **Créé** : "Complétez avec un connecteur (cependant / par conséquent / en revanche) : un parcours long permet d'apprendre en profondeur, ___ il demande de la disponibilité." | Création |

**Bilan** : 5 exercices A1/A2 réutilisés tels quels depuis la banque (validated_auto), 4 exercices B1/B2 créés faute d'équivalent direct en banque sur "identité + nationalité/pays-ville" à ces niveaux.

---

## 5. QCM TCF — 10 questions (corrigé, sans option inventée)

Format aligné sur le gabarit CapTCF existant (A/B/C/D), toutes les options sont des réponses plausibles et réelles — **aucune option de complément arbitraire type "D. 40"**.

| # | Question | A | B | C | D | Réponse | Justification |
|---|---|---|---|---|---|---|---|
| 1 | Comment s'appelle l'apprenante du dialogue ? | Awa Diallo | Awa Rossi | Fatou Diallo | Awa Camara | **A** | Elle se présente : "Je m'appelle Awa. Awa Diallo." |
| 2 | Quel est l'objectif administratif d'Awa ? | La carte de séjour pluriannuelle | La nationalité française | Un visa touristique | Un titre de travail | **A** | "Je voudrais avoir ma carte de séjour pluriannuelle." |
| 3 | Combien d'heures dure le parcours d'Awa ? | 50 heures | 80 heures | 100 heures | 120 heures | **B** | "Vous allez suivre un parcours de quatre-vingts heures." |
| 4 | Combien de séances collectives sont prévues ? | 18 | 25 | 31 | 37 | **B** | "réparti sur vingt-cinq séances de trois heures" |
| 5 | Combien de temps dure chaque séance ? | 2 heures | 3 heures | 4 heures | 5 heures | **B** | "vingt-cinq séances de trois heures" |
| 6 | À quel rythme les séances ont-elles lieu ? | Une par semaine | Deux par semaine | Une par mois | Tous les jours | **A** | "à raison d'une séance par semaine" |
| 7 | Après combien d'heures a lieu l'évaluation intermédiaire (E1) ? | 25 heures | 50 heures | 80 heures | 100 heures | **B** | "une évaluation intermédiaire après cinquante heures" |
| 8 | Combien de thèmes civiques structurent le parcours ? | Trois | Cinq | Sept | Dix | **B** | "cinq thèmes sur la vie en France" |
| 9 | D'après Mme Rossi, qu'est-ce qu'un "devoir" ? | Quelque chose qu'on peut demander | Quelque chose qu'on doit faire | Une consigne propre à un lieu | Une évaluation finale | **B** | "Un devoir, c'est quelque chose que vous devez faire, comme respecter la loi." |
| 10 | D'après Mme Rossi, qu'est-ce qu'une "règle" ? | Une consigne précise (ex. arriver à l'heure) | Une possibilité garantie par la loi | Une obligation nationale | Un examen final | **A** | "Une règle, c'est une consigne précise, par exemple arriver à l'heure en formation." |

**Traçabilité** : 10 questions créées, toutes ancrées littéralement dans le dialogue enrichi (section 2) — pas d'invention de fait, pas de contenu hors dialogue. Remplace l'ancien gabarit à 1 seule question + option "40".

---

## 6. QCM civique — 10 questions (corrigé avec justification réelle par question)

**5 questions Supabase réutilisées telles quelles** (`validated_auto`/`needs_review`, thème "Droits et devoirs", mention CSP) :

| # | ID Supabase | Question | Réponse | Justification (réécrite, spécifique — remplace le champ `explication` vide en base) |
|---|---|---|---|---|
| 1 | `6388cb45-2648-42d4-b865-38bd5e2661d3` (`cv2:S01:civic:0`) | Respecter le règlement intérieur d'un centre de formation est avant tout : | Un devoir | C'est une obligation à laquelle on doit se conformer pendant la formation, pas une simple option. |
| 2 | `5f6f5af1-f958-4261-9253-395ef0d1708a` (`cv2:S01:civic:1`) | Le droit à la santé signifie que vous pouvez : | Demander l'accès aux soins | Un droit est une possibilité que la loi garantit, comme demander à être soigné — ce n'est pas une obligation. |
| 3 | `ce45893f-649e-4263-8d5f-8a4249466d07` (`cv2:S01:civic:2`) | Un formateur demande à un apprenant d'arriver à l'heure à chaque séance. Il s'agit : | D'une règle du centre de formation | Une règle est une consigne précise, propre à un lieu (ici le centre de formation), différente d'une loi nationale. |
| 4 | `767a328b-8524-49f9-96de-16e813a8ac00` (`cv2:S01:civic:3`) | Le parcours vers la carte de séjour pluriannuelle dure : | 80 heures | Durée officielle du tronc commun A2/CSP telle que présentée à Awa dans le dialogue. |
| 5 | `9032499c-4ede-487f-b042-78f73a95fc8d` (`cv2:S01:civic:4`) | Combien de thèmes civiques officiels structurent le parcours ? | Cinq | Les cinq thèmes sont représentés sur le support visuel de la séance (République, institutions, droits/devoirs, histoire, société). |

**5 questions créées (complément)**, même thème/mention, aucune redite des 5 précédentes :

| # | Question | Options | Réponse | Justification |
|---|---|---|---|---|
| 6 | Un devoir, c'est : | A. Une obligation à respecter / B. Un choix libre sans conséquence / C. Un avantage optionnel | **A** | Un devoir engage la personne à agir, contrairement à un simple choix. |
| 7 | L'évaluation finale (E2) a lieu : | A. Après 25 heures / B. Après 50 heures / C. À la fin des 80 heures | **C** | E2 valide l'ensemble du tronc commun, donc à la fin du parcours complet. |
| 8 | Pourquoi le parcours comprend-il une évaluation intermédiaire (E1) ? | A. Pour sanctionner les absences / B. Pour mesurer la progression à mi-parcours / C. Pour remplacer l'évaluation finale | **B** | E1 permet d'ajuster la suite de la formation selon les besoins de l'apprenant. |
| 9 | Une règle se distingue d'un devoir car : | A. Une règle est propre à un lieu précis, un devoir est une obligation plus générale / B. Une règle est facultative / C. Un devoir n'a aucune conséquence | **A** | Ex. "arriver à l'heure" est une règle du centre ; "respecter la loi" est un devoir général. |
| 10 | Combien d'évaluations rythment le parcours de 80 heures ? | A. Une seule / B. Deux (E1 et E2) / C. Quatre | **B** | Le dialogue mentionne explicitement deux évaluations distinctes. |

**Correction du bug identifié dans l'audit précédent** : chaque justification est désormais **spécifique à sa question** (plus de texte générique copié-collé sur "80h/25 séances" pour toutes les lignes, sans lien avec la question posée).

---

## 7. Expression orale — 8 prompts gradés

| # | Niveau | Prompt | Consigne formateur | Critères de réussite | Source |
|---|---|---|---|---|---|
| 1 | A1 | Dites votre nom et votre ville en une phrase. | Laisser 30 s de préparation silencieuse. | Nom + ville énoncés clairement, phrase simple correcte. | Inspiré `59592128-eec4-4e5a-8786-59750f4f91e7` |
| 2 | A1 | Épelez votre nom de famille lettre par lettre. | Écrire l'alphabet au tableau en support. | Épellation correcte, débit compréhensible. | Banque `7509dee3`/`e0a01c8e` (réutilisés) |
| 3 | A2 | Présentez-vous : nom, nationalité/origine, âge. | Modèle au tableau : "Je m'appelle... Je viens de... J'ai... ans." | 3 informations correctes, verbes conjugués correctement. | Inspiré `67dab702-654c-431c-bc6c-367be1b4e874` (sous-questions 1-3) |
| 4 | A2 | Présentez un camarade du groupe (nom, ville, nationalité). | Binôme : s'interviewer puis se présenter mutuellement. | 3e personne correcte ("il/elle s'appelle..."). | Inspiré `GEF_A1_p23_ex11_parole_groupe` |
| 5 | B1 | Présentez-vous en 1 minute : âge, origine, famille, étude ou travail. | Chronométrer, un seul essai puis feedback. | Enchaînement fluide, connecteurs simples (et, mais, donc). | Inspiré `tcf_act1_se_presenter` |
| 6 | B1 | Décrivez votre parcours personnel et pourquoi vous suivez cette formation. | Amorce : "Je suis venu(e) en France parce que..." | Structure avec au moins un exemple concret. | Inspiré `tcf_oral_guide_task1_act1` |
| 7 | B2 | Présentez-vous en détail : identité, parcours de vie, un trait de personnalité, un projet. | Aucune préparation écrite autorisée. | Richesse lexicale, nuance, cohérence temporelle (passé/présent/futur). | Inspiré `sim_glob_phase2_identites` |
| 8 | B2 | Argumentez : pourquoi est-il utile de bien distinguer droit, devoir et règle dès le début d'un parcours d'intégration ? | Relance possible : "Donnez un exemple concret." | Argumentation structurée, au moins un exemple personnel. | Création (lien direct avec le civique de S01) |

---

## 8. Expression écrite

### Production guidée 1 (A1/A2) — texte à trous
*"Complétez le texte de présentation : Bonjour, je (........) Awa. Je (........) 28 ans. Je (........) du Sénégal. J'(........) à Paris."*
**Source** : format directement inspiré de `c1fa478c-f4ba-4000-b5ef-4084022e576f` ("La présentation d'Ahmed") et `2a162e99` ("Présentation simple"), adapté au personnage Awa.
**Critères de correction** : 4 verbes corrects (m'appelle / ai / viens / habite).

### Production guidée 2 (A2/B1) — à partir d'une fiche
*"À partir de cette fiche, rédigez 5 phrases complètes : NOM : Diallo — PRÉNOM : Awa — NÉE LE : 14/03/1995 — NATIONALITÉ : Sénégalaise — VILLE : Paris."*
**Source** : format inspiré de `vocabulaire_essentiel_du_francais_p14_act2` ("Présentez Sébastien Badou") et `95f4746e` ("Lire une fiche d'identité"), adapté.
**Critères de correction** : 5 phrases complètes, informations toutes exactes et correctement reformulées (pas de recopiage brut).

### Production autonome (B1/B2)
*"Rédigez un texte de 8 à 10 phrases présentant votre propre parcours et votre objectif administratif, sur le modèle d'Awa."*
**Source** : prolongement du devoir A2 existant (`brief.devoirs.A2`), étendu et rendu autonome pour B1/B2.
**Variantes** :
- Niveau bas (B1) : amorces fournies ("Je m'appelle... / Mon objectif est... / Le parcours dure..."), 8 phrases minimum.
- Niveau haut (B2) : sans amorce, 10 phrases minimum, au moins un connecteur argumentatif exigé.
**Critères de correction** : cohérence informationnelle, conjugaison au présent correcte, structure en paragraphe (B2).

---

## 9. Support visuel — 5 questions d'exploitation

Support conservé : `S01-VIS-master` (cinq panneaux civiques).

1. Combien de thèmes sont représentés sur le schéma ?
2. Nommez les cinq thèmes dans l'ordre, de gauche à droite.
3. Quel thème correspond au panneau de couleur rouge clair ? *(Histoire, géographie et culture)*
4. Pourquoi ces cinq thèmes sont-ils réunis sur un même schéma, selon vous ?
5. Lequel de ces cinq thèmes vous semble le plus utile pour votre vie quotidienne en France ? Justifiez votre réponse en une phrase.

**Traçabilité** : support inchangé (déjà pertinent pour S01, aucun bug détecté ici contrairement à S02-S05), questions créées (les questions actuelles de S01 étaient déjà correctement adaptées au support — cf. audit précédent — mais reformulées ici pour atteindre le minimum de 5 questions demandé, contre 2 actuellement).

---

## 10. Devoirs maison (différenciés, faisables sur téléphone)

| Niveau | Consigne | Format téléphone-compatible |
|---|---|---|
| A1 | Réécoutez l'audio (si disponible) ou relisez la transcription, et associez chaque mot du lexique à sa définition. | Note ou message avec les 10 associations |
| A2 | Racontez par écrit (5 phrases) votre propre objectif administratif, sur le modèle d'Awa. | Note ou message texte de 5 phrases |
| B1 | Rédigez un court texte expliquant à un ami la différence entre droit, devoir et règle. | Message ou note vocale transcrite |
| B2 | Rédigez un paragraphe argumenté sur l'intérêt d'un parcours progressif de formation pour un adulte. | Note structurée (paragraphe unique) |

**Traçabilité** : les 4 devoirs sont ceux déjà présents dans `brief.json.devoirs`, conservés à l'identique (déjà clairs, déjà différenciés, déjà réalisables sans matériel).

---

## 11. Tableau de traçabilité complet

| Activité | Source | ID / activity_id | Niveau | Compétence | Durée est. | Phase | Statut |
|---|---|---|---|---|---:|---|---|
| Support visuel 5 thèmes | `content/curriculum/v2/S01` | `S01-VIS-master` | A1-B2 | CIVIQUE | 10 min | 1 | Réutilisé |
| Lexique 10 mots | `content/curriculum/v2/S01` | `lexique-A1-B2.json` | A1-B2 | LEXIQUE | 8 min | 2 | Réutilisé |
| Lexique exercice association | Création | — | A1-B2 | LEXIQUE | 4 min | 2 | Créé |
| Lexique phrase à trous | Adapté format banque | inspiré `2a162e99` | A1-B2 | LEXIQUE | 4 min | 2 | Adapté |
| Lexique réemploi oral | Création | — | A1-B2 | LEXIQUE/EO | 4 min | 2 | Créé |
| Dialogue enrichi 298 mots | `content/curriculum/v2/S01` (base) | `S01-support-accueil` | A1-B2 | CO | 8 min (écoute) | 3 | Adapté (enrichi) |
| 20 questions CO | Création | — | A1-B2 | CO/CE | 40 min | 3 | Créé |
| Grammaire — être présent | Banque exercices | `26254e2b-63e0-440e-ae49-9373ea5e9e5a` | A1 | Structures | 5 min | 4 | Réutilisé |
| Grammaire — pronoms identité | Banque exercices | `f4fe558a-43dc-4768-b5bb-4d5393557e98` | A1 | Structures | 5 min | 4 | Réutilisé |
| Grammaire — verbes s'appeler/habiter | Banque exercices | `19a3f6b2-58ae-428e-b9d8-fa6ffdfaec2f` | A1 | Structures | 5 min | 4 | Réutilisé |
| Grammaire — possessifs identité | Banque exercices | `475e1e27-d7d0-4ecd-b003-b5b84537d530` | A2 | Structures | 5 min | 4 | Réutilisé |
| Grammaire — texte à trous présentation | Banque exercices | `c1fa478c` ou `2a162e99` | A2 | Structures/CE | 8 min | 4 | Réutilisé |
| Grammaire — nationalité/pays-ville (transfo) | Création | — | B1 | Structures | 10 min | 4 | Créé |
| Grammaire — discours rapporté | Création | — | B1 | Structures | 10 min | 4 | Créé |
| Grammaire — nominalisation droits | Création | — | B2 | Structures | 10 min | 4 | Créé |
| Grammaire — connecteurs argumentatifs | Création | — | B2 | Structures | 10 min | 4 | Créé |
| Atelier A1 — épeler son nom (CO) | Banque exercices | `4c983a50-bcce-4b70-b0bf-974c5cb211d5` | A1 | CO | 5 min | 4 | Réutilisé |
| Atelier A1 — carte d'identité V/F | Banque exercices | `77dcd9d8-884b-4186-bad1-52c5872f0a4f` | A1 | CE | 5 min | 4 | Réutilisé |
| Atelier A1 — Q/R identité | Banque exercices | `4a85ed79-4f1a-4c62-98df-18f111e82a73` | A1 | CE | 5 min | 4 | Réutilisé |
| Atelier A1 — variante officielle | `content/curriculum/v2/S01` | `cv2:S01:variant:A1` (Supabase) | A1 | CE | 10 min | 4 | Réutilisé **après correction** (needs_review : consigne trop longue + texte support manquant à ajouter) |
| Atelier A2 — fiche identité | Banque exercices | `95f4746e-6607-4811-92a8-dae81d2ac435` | A1-A2 | CE | 8 min | 4 | Réutilisé |
| Atelier A2 — variante | `content/curriculum/v2/S01` | `cv2:S01:variant:A2` (Supabase) | A2 | CE | — | 4 | **Non réutilisé tel quel** (rejected : `qcm_no_options`) — recréé, voir ci-dessous |
| Atelier A2 — variante recréée | Création | — | A2 | CE | 10 min | 4 | Créé (remplace la version rejetée) |
| Atelier B1 — variante | `content/curriculum/v2/S01` | `cv2:S01:variant:B1` (Supabase) | B1 | CE→EE | — | 4 | **Non réutilisé tel quel** (rejected : format `production_ecrite` incompatible avec compétence `CE`) |
| Atelier B1 — variante recréée | Création | inspiré `tcf_act1_se_presenter` | B1 | EE | 10 min | 4 | Créé (compétence EE cette fois, format valide) |
| Atelier B2 — variante | `content/curriculum/v2/S01` | `cv2:S01:variant:B2` (Supabase) | B2 | CE→EE | — | 4 | **Non réutilisé tel quel** (rejected, même cause que B1) |
| Atelier B2 — variante recréée | Création | inspiré `sim_glob_phase2_identites` | B2 | EE | 10 min | 4 | Créé |
| QCM TCF (10 questions) | Création (ancrée dialogue) | — | A2 cible | CO | 15 min | 5/6 | Créé (remplace la version à 1 question + "D. 40") |
| QCM civique (5 questions) | Banque exercices Supabase | `cv2:S01:civic:0` à `:4` | A2 | CE | 6 min | 6 | Réutilisé |
| QCM civique (5 questions complément) | Création | — | A2 | CE | 4 min | 6 | Créé |
| EO prompts 1-2 (A1) | Banque exercices | `59592128`, `7509dee3`/`e0a01c8e` | A1 | EO | 4 min | 5 | Réutilisé |
| EO prompts 3-4 (A2) | Banque/pedagogical_activities | inspiré `67dab702`, `GEF_A1_p23_ex11_parole_groupe` | A2 | EO | 6 min | 5 | Adapté |
| EO prompts 5-6 (B1) | pedagogical_activities | inspiré `tcf_act1_se_presenter`, `tcf_oral_guide_task1_act1` | B1 | EO | 6 min | 5 | Adapté |
| EO prompts 7-8 (B2) | pedagogical_activities / création | inspiré `sim_glob_phase2_identites` + création | B2 | EO | 6 min | 5 | Adapté + créé |
| EE guidée 1 | Banque (format) | inspiré `c1fa478c`/`2a162e99` | A1-A2 | EE | 6 min | 5 | Adapté |
| EE guidée 2 | pedagogical_activities (format) | inspiré `vocabulaire_essentiel_du_francais_p14_act2` | A2-B1 | EE | 6 min | 5 | Adapté |
| EE autonome | `content/curriculum/v2/S01` (devoir prolongé) | base `brief.devoirs.A2` | B1-B2 | EE | 6 min | 5 | Adapté |
| Support visuel — 5 questions | Création | — | A1-B2 | CIVIQUE | inclus phase 1 | 1/9 | Créé |
| Devoirs A1-B2 | `content/curriculum/v2/S01` | `brief.devoirs` | A1-B2 | Toutes | — | 6 | Réutilisé |

**Synthèse quantitative** : sur ~37 briques identifiées, **13 réutilisées telles quelles** (banque `exercices` + `content/curriculum/v2/S01`), **7 adaptées** (format banque repris, contenu ajusté à Awa/S01), **17 créées** (dont 3 variantes de remplacement pour les exercices rejetés en base, 4 blocs grammaire B1/B2, 20 questions CO, QCM TCF complet, QCM civique complément, questions support visuel).

---

## 12. Estimation réaliste du temps total

| Phase | Cible | Contenu prévu dans cette maquette | Estimation réaliste |
|---|---:|---|---:|
| 1. Rituel civique | 10 min | Support existant + 3 questions | 10 min |
| 2. Activation lexique | 20 min | 10 mots + 3 exercices | 18-20 min |
| 3. Support invariant CO/CE | 50 min | Dialogue 2 min 29 s + 20 questions réparties sur 3 écoutes | 45-50 min |
| 4. Ateliers différenciés | 60 min | 4 blocs grammaire + exercices banque + 3 variantes recréées | 55-60 min (A1/A2 confortables, B1/B2 un peu justes si le formateur approfondit) |
| 5. Production EE/EO | 30 min | 8 prompts EO + 2 EE guidées + 1 EE autonome | 28-32 min |
| 6. Fixation | 10 min | QCM civique 10 questions + devoirs | 10 min |
| **Total** | **180 min** | | **≈ 170-185 min** |

**Conclusion** : contrairement à la version actuelle (diagnostic précédent : ~70-85 min de contenu réel sur 180 annoncées), cette maquette v3 couvre un volume d'activités **cohérent avec les 180 minutes annoncées**, avec une marge raisonnable pour les transitions et la gestion de classe réelle.

---

## 13. Points créés faute de ressource suffisante

1. **20 questions/micro-tâches sur le dialogue CO** — aucune banque n'offre un jeu de questions pré-construit sur ce dialogue précis (support invariant propre à S01) ; entièrement créées, mais strictement ancrées dans le texte du dialogue (traçable réplique par réplique).
2. **QCM TCF 10 questions** — la banque ne contient pas de format "QCM TCF A/B/C/D" prêt sur ce thème ; créées à partir des faits du dialogue.
3. **4 blocs grammaire B1/B2** (nationalité/pays-ville, discours rapporté, nominalisation, connecteurs) — la banque est structurellement pauvre en B1/B2 sur le thème précis "identité" (cf. §"cellules P0" de `lot9-banque-pilotage-report.md` : B1/B2 Structures comptent 0 exercice `validated_auto`).
4. **3 variantes de différenciation A2/B1/B2 recréées** — les originales en base sont `rejected` (erreurs de schéma : QCM sans options, format incompatible avec la compétence déclarée) ; reconstruites avec un format valide plutôt que corrigées ligne à ligne, car les erreurs touchaient la structure même de l'exercice.
5. **5 questions civiques complémentaires** — pour atteindre 8-10 questions sans dupliquer les 5 déjà existantes en base.
6. **5 questions d'exploitation du support visuel** — le support était déjà pertinent, mais ne portait que 2 questions ; complété à 5.
7. **1 prompt EO B2 (argumentation civique)** — aucun équivalent en banque reliant explicitement présentation de soi et thème civique de S01.

## 14. Points à valider humainement avant génération PDF/DOCX

1. **Dialogue enrichi** : valider le naturel de l'échange ajouté (épellation du nom) et la reformulation de l'exemple de "règle" (passage de "règlement intérieur" à "arriver à l'heure en formation").
2. **3 variantes A2/B1/B2 recréées** : à faire re-passer par la chaîne de validation Supabase (`validation-chain.ts`) avant toute réinsertion en base — cette maquette ne les a pas testées automatiquement (aucune écriture Supabase effectuée, conformément à la consigne).
3. **QCM TCF et QCM civique complémentaires** : vérifier qu'aucune question ne recoupe un contenu déjà utilisé dans une évaluation officielle (E1/E2) pour éviter tout effet de mémorisation prématurée.
4. **Charge réelle des ateliers B1/B2** : le temps estimé (55-60 min pour 4 groupes en parallèle) suppose une bonne autonomie ; à tester en conditions réelles, ajustable via la règle d'adaptation déjà existante ("+10 min si groupe hétérogène").
5. **Cohérence de l'atelier A1 `cv2:S01:variant:A1`** : reste `needs_review` (consigne trop longue, texte support manquant) — proposé de le corriger plutôt que le remplacer (contrairement à A2/B1/B2), à confirmer.
6. **Audio réel** : cette maquette ne prépare qu'un texte calibré (298 mots ≈ 2 min 29 s en estimation `fake-tts`) — pas de MP3 généré, conformément à la consigne. La durée réelle restera à reconfirmer une fois la voix de synthèse générée.

---

## 15. Verdict

## **GO pour génération PDF/DOCX de S01 v3**, sous réserve de la validation des points de la section 14

- Le contenu proposé couvre l'intégralité des exigences minimales de la commande (déroulé animable, dialogue + 20 questions, lexique + 3 exercices, bloc grammaire gradé, QCM TCF 10 questions sans option absurde, QCM civique 8-10 questions avec justifications réelles, EO 8 prompts, EE 2+1, support visuel 5 questions, devoirs clairs, variantes A1-B2).
- La réutilisation de la banque est **majoritaire pour A1/A2** (13 réutilisations directes + 7 adaptations), la création reste concentrée sur les zones objectivement pauvres en banque (B1/B2 structures, dialogue propre à S01, QCM TCF).
- Les deux bugs explicitement signalés sont corrigés dans cette maquette : **QCM TCF sans option "D. 40"** (section 5) et **QCM civique avec justifications spécifiques par question** (section 6) — à reporter également sur S01-S05 déjà produites lors d'un correctif ultérieur du générateur (hors périmètre de cette maquette).
- Aucune génération PDF/DOCX, aucune écriture Supabase, aucun MP3, aucun commit n'a été effectué à cette étape.

En attente de ton GO explicite pour lancer la génération PDF/DOCX de S01 v3 à partir de cette maquette.

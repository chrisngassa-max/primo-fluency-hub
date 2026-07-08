# CapTCF — Plan maître de formation et d’implémentation pour Cursor

Version 2.0 — 5 juillet 2026  
Statut : spécification de référence à implémenter  
Périmètre : parcours cumulatif A2/CSP 80 h, B1/CR 100 h et B2/NAT 120 h

## 0. Mode d’emploi pour Cursor

Ce document est la source de vérité fonctionnelle, pédagogique et technique. Cursor doit l’implémenter par migrations additives et lots idempotents, sans détruire les parcours ou ressources déjà utilisés par une cohorte.

Ordre obligatoire :

1. créer les structures de données et les validateurs ;
2. importer le manifeste S1–S37 sans générer de média ;
3. exécuter un dry-run complet ;
4. tester S01 de bout en bout, puis S01–S05 ;
5. lancer un seul batch S01–S37 avec reprise automatique ;
6. publier automatiquement chaque ressource conforme ;
7. mettre en quarantaine les seuls échecs bloquants ;
8. fournir au formateur une revue post-publication et un retour arrière.

« Un seul batch » signifie une commande orchestratrice unique avec 37 sous-jobs persistés et reprenables. Cela ne signifie pas une requête géante envoyée à un modèle.

## 1. Décisions non négociables

### 1.1 Parcours cumulatif

- A2 / carte de séjour pluriannuelle : S1–S25 + E1 + E2 = 80 h.
- B1 / carte de résident : parcours A2 + S26–S31 + E3 = 100 h.
- B2 / naturalisation : parcours B1 + S32–S37 + E4 = 120 h.
- Une cohorte peut être hétérogène A1 à B2 ; la séance utilise un support maître commun et quatre traitements A1/A2/B1/B2.
- Les niveaux ne correspondent jamais à quatre histoires différentes. Personnages, faits, nombres, dates, image et audio restent invariants.

### 1.2 Double rendement langue + civique

Le contenu civique n’est ni une application séparée ni un bloc plaqué à la fin. Les supports de langue portent autant que possible sur une situation civique, sociale ou administrative. Les résultats restent toutefois séparés :

- IPE Langue : CO, CE, EE, EO et structures d’apprentissage ;
- IPE Civique : cinq thèmes, connaissances et mises en situation, par mention CSP/CR/NAT.

Un texte sur la laïcité ne produit une preuve civique que si une question mesure réellement une connaissance ou un jugement civique. Le TCF IRN évalue la langue, pas les connaissances civiques.

### 1.3 Bibliothèque anticipée, IA toujours disponible

- Tous les supports indispensables sont créés, vérifiés, stockés et versionnés avant le cours.
- Pendant la séance, l’IA peut expliquer, simplifier, différencier ou proposer un entraînement supplémentaire à partir des supports publiés.
- Elle ne remplace jamais à la volée un support dont dépend une réponse évaluée.
- Toute adaptation conserve support_id, les faits, les sources et le corrigé de référence.
- Le formateur part d’un document existant ; il ne part jamais d’une page blanche.

### 1.4 Publication automatique

- Chaque ressource conforme est publiée automatiquement après double contrôle.
- Il n’existe pas de validation humaine préalable obligatoire.
- Après trois tentatives en échec, la ressource passe en quarantaine et n’est pas publiée.
- La revue humaine se fait après publication ; elle permet remplacement, régénération, dépublication et restauration.
- Une ancienne version publiée reste disponible jusqu’à la réussite atomique de la nouvelle.

## 2. Références officielles à versionner

Les collecteurs enregistrent l’URL, le titre, la date de consultation, le hash du contenu et la version du référentiel.

- [TCF IRN — France Éducation international](https://www.france-education-international.fr/test/tcf-irn?langue=fr) : CO 25 questions/20 min, CE 25 questions/35 min, EE 3 tâches/30 min, EO 3 tâches/10 min, total 1 h 35.
- [Informations générales — examen civique](https://formation-civique.interieur.gouv.fr/examen-civique/informations-g%C3%A9n%C3%A9rales-sur-lexamen-civique/) : 40 QCM, 45 min, 28 connaissances, 12 mises en situation, réussite à 32/40.
- [Questions officielles CSP](https://formation-civique.interieur.gouv.fr/examen-civique/liste-officielle-des-questions-de-connaissance-csp/).
- [Questions officielles CR](https://formation-civique.interieur.gouv.fr/examen-civique/liste-officielle-des-questions-de-connaissance-cr/).
- [Arrêté du 10 octobre 2025 — Légifrance](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052381620) : mentions CSP, CR et naturalisation.
- [Naturalisation par décret — Service-Public.fr](https://www.service-public.fr/particuliers/vosdroits/F34708).

Les mises en situation officielles ne sont pas publiques. Toute mise en situation créée par CapTCF porte le libellé simulation_pedagogique et n’est jamais présentée comme une question officielle.

## 3. Répartition horaire et rythme

| Palier | Cours collectifs | Évaluations hors séances | Total cumulé |
|---|---:|---:|---:|
| A2 / CSP | S1–S25 : 25 × 3 h = 75 h | E1 : 2 h + E2 : 3 h | 80 h |
| B1 / CR | S26–S31 : 6 × 3 h = 18 h | E3 : 2 h | 100 h |
| B2 / NAT | S32–S37 : 6 × 3 h = 18 h | E4 : 2 h | 120 h |

À raison d’une séance par semaine : A2 25 semaines, B1 31 semaines, B2 37 semaines. À deux séances par semaine : environ 13, 16 et 19 semaines, hors ajustements calendaires.

| Phase ordinaire | Durée | Résultat |
|---|---:|---|
| Rituel civique | 10 min | 5 questions, justification et trace d’erreur |
| Activation + lexique | 20 min | vocabulaire A1–B2 et structures utiles |
| Support invariant CO/CE | 50 min | compréhension commune à partir d’un support publié |
| Ateliers différenciés | 60 min | quatre niveaux de traitement du même support |
| Production EE/EO | 30 min | tâche communicative et préparation TCF |
| Fixation | 10 min | synthèse, métacognition et devoir personnalisé |

Les séances de simulation remplacent cette répartition par les temps officiels et une remédiation immédiate.

## 4. Rôle des moteurs et des API

### 4.1 Anthropic

ANTHROPIC_API_KEY est utilisé côté serveur pour structurer et rédiger les contenus, produire les variantes et corrigés, générer du SVG/HTML déterministe, contrôler les faits fournis avec leurs sources, analyser les images et proposer en classe des adaptations fondées sur les ressources publiées.

Variables : ANTHROPIC_CONTENT_MODEL, ANTHROPIC_REVIEW_MODEL, ANTHROPIC_MAX_TOKENS, ANTHROPIC_MAX_COST_EUR. Les noms de modèles ne sont pas codés en dur.

Claude comprend les images et génère du texte ou du code à partir d’elles. L’API Anthropic ne doit pas être traitée comme un générateur natif de photos ou d’images raster.

### 4.2 Images

1. Voie prioritaire : rendu déterministe SVG/HTML/Canvas depuis des données validées.
2. Voie optionnelle : adaptateur ImageProvider pour une scène générique photoréaliste. Le générateur Gemini existant devient un adaptateur, pas un script isolé.

Variables : IMAGE_PROVIDER=svg|gemini|openai|disabled, IMAGE_MODEL, clé propre au fournisseur. Chaque brief possède un fallback_svg_required. Si seul Anthropic est configuré, le batch produit et publie automatiquement le visuel maître en SVG déterministe puis ses rendus PNG/WebP. Une éventuelle version photoréaliste reste une amélioration facultative et ne bloque jamais le paquet obligatoire.

Interdits à la génération libre : logos et sceaux officiels, cartes géographiques, pièces administratives réelles, données chiffrées, photographies historiques, textes évalués et archives. Ces éléments viennent d’une source autorisée ou d’un rendu déterministe.

### 4.3 Audio et documents

- Google Cloud Text-to-Speech reste le moteur maître existant via GOOGLE_TTS_API_KEY.
- Chaque MP3 conserve script, transcription, voix, vitesse, pauses, durée et hash.
- Le TTS du navigateur n’est qu’un secours, jamais le support maître d’une CO évaluée.
- HTML/CSS imprimable est la source ; PDF en est un rendu.
- JSON est la source des contenus et corrigés ; PNG/WebP sont des dérivés du SVG ou du fournisseur d’images.

## 5. Paquet obligatoire de chaque séance

Chaque dossier content/curriculum/v2/SXX/ contient :

    SXX/
      session.yaml
      sources.json
      support/{support-master.json,support-master.html,support-master.pdf}
      audio/{CO-script.md,CO-transcript.pdf,CO-master.mp3,CO-metadata.json}
      visual/{VIS-brief.json,VIS-master.svg,VIS-master.png,VIS-master.webp,VIS-validation.json}
      lexique/{lexique-A1-B2.json,lexique-A1-B2.pdf}
      formateur/{fiche-formateur.pdf,deroule-180min.json,adaptation-rules.json}
      apprenant/{fiche-A1.pdf,fiche-A2.pdf,fiche-B1.pdf,fiche-B2.pdf}
      exercices/{exercices.json,variantes-A1-A2-B1-B2.json,qcm-civique.json,corrige.json}
      devoirs/{devoir-A1.pdf,devoir-A2.pdf,devoir-B1.pdf,devoir-B2.pdf}
      manifest.json

Si une séance réutilise un support commun, son manifeste référence la version publiée ; il ne crée pas un fichier artificiel. Aucun fichier obligatoire ne peut être vide.

Tous les niveaux partagent support_id, support_version, support_hash, personnages, situation, faits, nombres, dates, audio, image, texte et source. Seuls changent consigne, aides, nombre de questions, implicite, opération cognitive et longueur de réponse.

| Niveau | Traitement attendu |
|---|---|
| A1 fragile | repérer, associer, compléter avec lexique et amorces |
| A2 cible | comprendre, raconter simplement et agir dans la situation |
| B1 | reformuler, justifier, comparer et structurer |
| B2 | analyser, nuancer, objecter et argumenter avec précision |

## 6. Séquençage complet S1–S37

Chaque séance ci-dessous déclenche la création du paquet standard. Les champs CO, CE/VIS, lexique, production et civique définissent les ressources concrètes.
### Module A — Entrer dans le parcours et agir au quotidien

#### S01 — Accueil, objectifs et cinq thèmes

- Type/dominante : mixte, diagnostic non certificatif ; CO + EO.
- Support invariant : entretien d’accueil où un apprenant explique son objectif administratif.
- CO : dialogue 2 min 30, débit A2 naturel, transcription, questions graduées.
- CE/VIS : cinq panneaux SVG représentant les cinq thèmes civiques, sans logo officiel.
- Lexique : parcours, niveau, objectif, démarche, droit, devoir, République, examen, séance, progresser.
- Production : se présenter, expliquer son objectif et reformuler les étapes.
- Civique/preuve : distinguer droit, devoir et règle ; présentation orale + mini-diagnostic A1–B2.

#### S02 — État civil, mairie et symboles

- Type/dominante : mixte ; CE + EE.
- Support invariant : formulaire fictif d’état civil et échange écrit avec une mairie.
- CO : accueil de mairie avec horaires fictifs signalés comme tels.
- CE/VIS : formulaire par gabarit et symboles issus de sources autorisées ; aucun document officiel imité.
- Lexique : nom, prénom, naissance, nationalité, adresse, mairie, devise, drapeau, hymne, Marianne.
- Production : compléter le formulaire et demander une information poliment.
- Civique/preuve : République, devise, langue, fête nationale et symboles ; formulaire + QCM CSP.

#### S03 — Santé et urgences

- Type/dominante : mixte ; CO + EO.
- Support invariant : appel fictif décrivant un problème et choix de l’interlocuteur adapté.
- CO : deux scènes, urgence et situation non urgente, sans dramatisation.
- CE/VIS : tableau sourcé des numéros utiles et illustration générique d’un cabinet ; aucun numéro inventé dans l’image.
- Lexique : symptôme, douleur, urgence, médecin traitant, rendez-vous, ordonnance, carte Vitale, mutuelle.
- Production : décrire des symptômes et demander de l’aide.
- Civique/preuve : accès aux soins, médecin traitant, urgences, carte Vitale ; décisions justifiées.

#### S04 — École, absence et autorité parentale

- Type/dominante : dominante civique intégrée ; CE + EE.
- Support invariant : message d’une école signalant une absence et calendrier fictif.
- CO : message vocal de l’établissement, sans nom ni donnée réelle.
- CE/VIS : parcours scolaire SVG et formulaire d’absence déterministe.
- Lexique : école, classe, absence, justificatif, obligatoire, parent, mixité, règlement.
- Production : expliquer et justifier une absence par écrit.
- Civique/preuve : instruction obligatoire, école publique, autorité parentale, mixité, laïcité ; message + cinq QCM.

#### S05 — Logement, voisinage et discrimination

- Type/dominante : mixte ; CO + EO.
- Support invariant : conflit de voisinage dans un immeuble et recherche d’une solution légale.
- CO : échange entre locataire, voisin et médiateur.
- CE/VIS : plan simple de l’immeuble, acteurs et scène générique de médiation.
- Lexique : bail, locataire, propriétaire, nuisance, voisin, règlement, médiation, discrimination.
- Production : signaler un problème sans agresser et proposer une solution.
- Civique/preuve : égalité, fraternité, associations, respect et recours ; jeu de rôle + qualification.

### Module B — Travail, démarches et institutions

#### S06 — Emploi, contrat et fiche de paie

- Type/dominante : mixte ; CE + structures.
- Support invariant : même emploi fictif décliné en offre, extrait de contrat et fiche de paie cohérente.
- CO : entretien sur horaires et rémunération.
- CE/VIS : documents générés par gabarits depuis un seul jeu de données contrôlé.
- Lexique : offre, candidature, contrat, salaire, brut, net, horaire, déclaré, SMIC, congé.
- Production : vérifier des informations et demander une correction.
- Civique/preuve : travail déclaré, durée légale, rémunération, égalité professionnelle ; tableau + décisions.

#### S07 — Préfecture, notification et rendez-vous

- Type/dominante : mixte ; CE + EE.
- Support invariant : notification fictive demandant une pièce manquante.
- CO : serveur vocal fictif, sans identité sonore d’une administration réelle.
- CE/VIS : notification et liste de pièces par gabarit avec mention « document pédagogique fictif ».
- Lexique : préfecture, titre, dossier, justificatif, échéance, rendez-vous, joindre, transmettre.
- Production : écrire un courriel formel et joindre la bonne pièce.
- Civique/preuve : loi, administration, service public, droits et obligations de l’usager ; courriel + QCM CSP.

#### S08 — Ve République et Constitution

- Type/dominante : dominante civique ; CO + CE.
- Support invariant : capsule sur la Constitution de 1958 et la Ve République.
- CO : capsule de 3 minutes découpée en chapitres.
- CE/VIS : carte mentale SVG issue des sources officielles, sans portrait généré.
- Lexique : Constitution, République, démocratie, loi, pouvoir, institution, citoyen, souveraineté.
- Production : expliquer simplement ce qu’organise une Constitution.
- Civique/preuve : Constitution, régime républicain, symboles, État de droit ; carte mentale + connaissances.

#### S09 — Laïcité en situations

- Type/dominante : dominante civique ; EO + EE.
- Support invariant : quatre situations — agent public, usager, élève et espace privé.
- CO : dialogues courts sans caricature.
- CE/VIS : matrice SVG des contextes ; personnages neutres et diversité non stéréotypée.
- Lexique : laïcité, neutralité, conscience, croire, ne pas croire, culte, agent, usager.
- Production : expliquer une règle et justifier une conduite.
- Civique/preuve : liberté de conscience, neutralité de l’État, règles scolaires ; explication + simulations.

#### S10 — Du local au national : qui fait quoi ?

- Type/dominante : dominante civique ; CO + CE.
- Support invariant : demandes d’habitants à orienter vers la bonne institution.
- CO : trois demandes et réponses d’agents.
- CE/VIS : organigramme SVG commune, Parlement, Gouvernement, présidence et justice.
- Lexique : commune, maire, député, sénateur, ministre, président, juge, élire, nommer.
- Production : orienter et justifier le choix de l’institution.
- Civique/preuve : rôles institutionnels et distinction local/national ; classement + justification.

### Module C — Droits, devoirs, histoire, géographie et culture

#### S11 — Police, gendarmerie et justice

- Type/dominante : mixte ; CE + EO.
- Support invariant : récit fictif d’une personne victime d’un vol.
- CO : déclaration orale et questions de clarification.
- CE/VIS : parcours SVG signalement/plainte/enquête/justice et scène non violente.
- Lexique : plainte, témoin, preuve, infraction, contravention, délit, crime, tribunal.
- Production : raconter les faits et orienter la personne.
- Civique/preuve : police, gendarmerie, justice, droit de se défendre ; orientation argumentée.

#### S12 — Discriminations, violences et protection

- Type/dominante : dominante civique ; CO + EE.
- Support invariant : témoignage sobre d’une discrimination, sans détail traumatisant.
- CO : récit et conseils d’un professionnel.
- CE/VIS : parcours de protection SVG ; contacts sourcés dans du texte déterministe.
- Lexique : victime, témoin, protéger, signaler, égalité, dignité, aide, association.
- Production : rédiger un message de signalement factuel.
- Civique/preuve : égalité femmes-hommes, dignité, non-discrimination, protection ; choix légal + message.

#### S13 — Liberté d’expression et limites

- Type/dominante : dominante civique ; CE + EO.
- Support invariant : publication fictive sur un réseau social et réactions contrastées.
- CO : débat court sans reproduire inutilement de propos haineux.
- CE/VIS : continuum SVG opinion/critique/insulte/menace avec libellés déterministes.
- Lexique : opinion, critique, insulte, diffamation, menace, presse, publier, responsabilité.
- Production : donner son avis et reformuler un désaccord respectueux.
- Civique/preuve : expression, presse, association, limites légales ; opinion guidée puis argumentation.

#### S14 — Impôts, services publics et environnement

- Type/dominante : mixte ; CE + EE.
- Support invariant : budget pédagogique reliant contributions et services collectifs.
- CO : annonce municipale sur une collecte locale fictive.
- CE/VIS : flux SVG impôts/services et consignes locales versionnées.
- Lexique : impôt, taxe, service public, solidarité, déchet, tri, collecte, intérêt général.
- Production : résumer une consigne et écrire à la mairie.
- Civique/preuve : financement public, environnement, solidarité ; synthèse + décisions.

#### S15 — 1789, droits et République

- Type/dominante : dominante civique ; CO + CE.
- Support invariant : récit chronologique de repères validés.
- CO : narration historique de 3 minutes.
- CE/VIS : frise SVG depuis un fichier de données ; aucune fausse photographie historique.
- Lexique : Révolution, monarchie, République, déclaration, citoyen, droit, abolir, adopter.
- Production : raconter un événement et expliquer sa conséquence.
- Civique/preuve : 1789, DDHC, République et ruptures ; chronologie + repères CSP.

#### S16 — France, territoires, Europe et patrimoine

- Type/dominante : dominante civique ; CO + EO.
- Support invariant : déplacement entre métropole, outre-mer et pays européen.
- CO : récit de voyage informatif, sans marque.
- CE/VIS : cartes issues de données fiables et rendues déterministement ; jamais de carte IA libre.
- Lexique : territoire, région, département, commune, outre-mer, frontière, Europe, patrimoine.
- Production : situer un lieu et présenter un élément culturel.
- Civique/preuve : organisation territoriale, Europe, patrimoine, diversité ; présentation + repères.
### E1 — Évaluation intermédiaire à 50 h (2 h)

- CO + CE chronométrées : 55 min ; EE ciblée : 30 min ; EO enregistrée : 10 min ; civique CSP abrégé : 25 min.
- Les médias proviennent exclusivement de la banque publiée et sont épinglés par version et hash.
- Sortie : niveau par compétence, structures fragiles, thèmes civiques fragiles et plan automatique S17–S24.
- L’EO enregistrée permet la passation simultanée ; un entretien humain complète les cas proches d’un seuil.

### Module D — Remédiation adaptative et autonomie

#### S17 — Remédiation fondée sur E1

- Type/dominante : adaptative ; structures.
- Support invariant : une situation civique commune sélectionnée selon les erreurs dominantes de la cohorte.
- CO : extraits publiés réassemblés sans modifier leur contenu.
- CE/VIS : matrice personnelle des erreurs, générée déterministement depuis les résultats.
- Lexique : sélection automatique de 12 mots déjà rencontrés, avec exemples sourcés dans le corpus.
- Production : tâche équivalente avant/après remédiation.
- Civique/preuve : révision pondérée des cinq thèmes ; mesure du gain sans mélanger langue et civique.

#### S18 — Répondre à une administration

- Type/dominante : mixte ; EE.
- Support invariant : fil administratif fictif concernant une pièce justificative.
- CO : rappel vocal du dossier.
- CE/VIS : courriel, pièces et chronologie par gabarit déterministe.
- Lexique : objet, référence, pièce jointe, délai, relancer, accuser réception, incomplet, conforme.
- Production : trois tâches graduées proches de l’EE TCF.
- Civique/preuve : droits de l’usager et obligations documentaires ; productions avec autonomie croissante.

#### S19 — Interagir avec un agent et résoudre un malentendu

- Type/dominante : mixte ; EO.
- Support invariant : échange au guichet autour d’une demande mal comprise.
- CO : dialogue avec implicite progressif, sans accent caricatural.
- CE/VIS : échelle de communication et scène générique de guichet.
- Lexique : reformuler, préciser, vérifier, recours, responsable, courtoisie, neutralité, contestation.
- Production : trois tâches orales TCF avec relances contrôlées.
- Civique/preuve : neutralité des agents, respect de la loi et recours ; résolution du malentendu.

#### S20 — Mémoire nationale et patrimoine

- Type/dominante : dominante civique ; CO + CE.
- Support invariant : dossier documentaire sourcé sur République, guerres, Résistance et Shoah.
- CO : commentaire historique factuel.
- CE/VIS : frise déterministe et documents licenciés ; aucune archive synthétique.
- Lexique : mémoire, commémoration, Résistance, déportation, Shoah, patrimoine, témoignage.
- Production : présenter un repère avec sobriété et contexte.
- Civique/preuve : faits historiques et devoir de mémoire ; compréhension contextualisée.

### Module E — Transfert vers les examens

#### S21 — Mises en situation civiques simulées

- Type/dominante : dominante civique ; CO + CE.
- Support invariant : banque verrouillée de situations fictives reliées aux sources officielles.
- CO : douze capsules au maximum, une seule information utile par item A2.
- CE/VIS : arbre de décision SVG et scènes figées ; l’image ne doit jamais suggérer involontairement la réponse.
- Lexique : situation, règle, conséquence, autorisé, interdit, obligation, recours, intérêt général.
- Production : expliquer pourquoi une conduite est conforme ou non.
- Civique/preuve : distinguer connaissance et mise en situation ; items séparant preuve linguistique et civique.

#### S22 — Expression écrite TCF, trois tâches

- Type/dominante : langue ; EE.
- Support invariant : trois consignes TCF dans des contextes civiques variés.
- CO : aucune nouvelle CO obligatoire ; réutilisation d’une consigne audio d’accessibilité.
- CE/VIS : schéma SVG des trois tâches, compteurs et checklist ; aucune notation civique automatique du contenu.
- Lexique : informer, raconter, décrire, comparer, donner son avis, organiser, conclure.
- Production : trois tâches complètes avec volumes et temps cibles.
- Civique/preuve : exposition contextuelle seulement, sauf question civique distincte ; grille EE.

#### S23 — Expression orale TCF, trois tâches

- Type/dominante : langue ; EO.
- Support invariant : cartes de rôles et relances standardisées.
- CO : modèles audio publiés, jamais utilisés comme réponse à mémoriser.
- CE/VIS : structure EO et cartes de rôles déterministes.
- Lexique : se présenter, demander, préciser, raconter, justifier, nuancer, illustrer.
- Production : entretien dirigé, interaction, point de vue sans préparation.
- Civique/preuve : vie sociale et institutions comme supports ; grille EO par niveau cible.

#### S24 — Gestion du temps et répétition générale

- Type/dominante : simulation partielle ; mixte.
- Support invariant : blocs chronométrés issus d’une banque gelée.
- CO : bloc chronométré avec ordre et écoute verrouillés.
- CE/VIS : tableau de temps et transitions rendu déterministement.
- Lexique : consigne, minuterie, passer, revenir, vérifier, valider, stratégie.
- Production : enchaîner les tâches sans aide.
- Civique/preuve : révision des cinq thèmes et stratégie 32/40 ; plan de dernière révision.

### E2 — Évaluation finale du tronc commun (3 h)

- TCF IRN interne complet : 1 h 35.
- Civique CSP complet : 40 questions, 45 min, sans aide.
- Installation, transitions et autoanalyse : 40 min.
- Une seule version de chaque média est utilisée pendant toute la tentative.
- Orientation : sortie A2/CSP, extension B1/CR ou consolidation supplémentaire.

#### S25 — Consolidation, restitution et orientation

- Type/dominante : remédiation + orientation ; mixte.
- Support invariant : rapport individuel E2 et deux supports publiés correspondant aux fragilités majeures.
- CO/CE/VIS : graphiques déterministes de progression et arbre d’orientation.
- Lexique : sélection personnalisée depuis l’historique, sans création de nouveaux faits.
- Production : refaire deux tâches équivalentes, puis expliquer son plan de travail.
- Civique/preuve : correction des erreurs, restitution séparée langue/civique, contrat personnel.
- Sortie : A2/CSP, B1/CR, consolidation ou objectif B2 identifié.

### Module F — Extension B1 / carte de résident

#### S26 — État de droit et séparation des pouvoirs

- Type/dominante : dominante civique B1 ; CE + EO.
- Support invariant : dossier expliquant une décision publique et ses contrôles.
- CO : capsule institutionnelle de niveau B1.
- CE/VIS : schéma SVG des pouvoirs exécutif, législatif et judiciaire.
- Lexique : État de droit, séparation, contrôle, mandat, suffrage, majorité, opposition.
- Production : synthèse structurée et explication d’un contre-pouvoir.
- Civique/preuve : organisation de l’État et élections ; QCM CR + synthèse.

#### S27 — Argumenter sur droits et libertés

- Type/dominante : dominante civique B1 ; EO + EE.
- Support invariant : trois cas sur laïcité, expression et manifestation.
- CO : échanges contradictoires mais respectueux.
- CE/VIS : balance SVG droit/limite/intérêt général et fiches de cas.
- Lexique : garantir, restreindre, proportionné, dignité, pluralisme, manifester, discriminer.
- Production : opinion justifiée, objection et exemple.
- Civique/preuve : droits, limites et discriminations ; situations simulées CR.

#### S28 — Travail, syndicats, impôts et solidarité

- Type/dominante : mixte B1 ; CE + EE.
- Support invariant : dossier social fictif cohérent, sans donnée personnelle.
- CO : réunion d’information en entreprise.
- CE/VIS : acteurs du travail, réclamation et document social par gabarit.
- Lexique : syndicat, grève, cotisation, allocation, chômage, prud’hommes, solidarité.
- Production : réclamation formelle et interprétation d’un document.
- Civique/preuve : travail, syndicats, impôts, environnement ; décision motivée.

#### S29 — Histoire républicaine, Europe et mémoire

- Type/dominante : dominante civique B1 ; CO + EO.
- Support invariant : trois documents reliés par une chronologie.
- CO : récit d’un événement et de sa portée.
- CE/VIS : frise histoire/Europe/mémoire et documents licenciés.
- Lexique : héritage, régime, résistance, construction européenne, commémorer, transmettre.
- Production : raconter puis expliquer l’importance d’un événement.
- Civique/preuve : repères CR et mise en relation ; récit cohérent.

#### S30 — Implicite et conduite conforme

- Type/dominante : dominante civique B1 ; CO + CE.
- Support invariant : banque transversale de situations CR fictives.
- CO : dialogues avec implicite contrôlé.
- CE/VIS : scènes génériques figées ; chaque distracteur est audité contre l’image.
- Lexique : sous-entendre, déduire, intention, conséquence, approprié, recours.
- Production : expliciter l’indice et justifier la conduite.
- Civique/preuve : priorité principes et droits ; série de situations avec justification.

#### S31 — Simulation CR et remédiation

- Type/dominante : simulation intégrée B1.
- Support invariant : banque CR verrouillée, versionnée et jamais régénérée pendant la passation.
- CO/CE/VIS : médias publiés et hashés avant l’ouverture.
- Langue : bloc ciblé B1 selon les fragilités de la cohorte.
- Civique : simulation 40/45 sans aide, puis analyse des distracteurs.
- Preuve : score chronométré, erreurs par notion et reprise ciblée.

### E3 — Évaluation de sortie B1 / CR (2 h)

- CO + CE : 55 min ; EE : 30 min ; EO enregistrée : 10 min ; civique CR ciblé : 25 min.
- Décision : sortie B1/CR, poursuite B2/NAT si B1 solide, ou volume complémentaire.
- E3 ne rend exam_ready vrai que si les conditions civiques complètes sont déjà satisfaites.
### Module G — Extension B2 / naturalisation

Cible indicative des 20 h : 40 % langue, 40 % examen civique et 20 % entretien d’assimilation.

#### S32 — Système constitutionnel et souveraineté

- Type/dominante : dominante civique B2 ; CE + EO.
- Support invariant : corpus court sur Constitution, souveraineté et contrôles institutionnels.
- CO : conférence pédagogique de niveau B2.
- CE/VIS : système constitutionnel SVG avec liens explicites et sources.
- Lexique : souveraineté, légitimité, promulguer, contrôler, constitutionnalité, responsabilité.
- Production : synthèse nuancée et réponse à des relances.
- Civique/preuve : Constitution, État de droit et pouvoirs ; questions NAT + explication précise.

#### S33 — Libertés, pluralisme et dignité

- Type/dominante : dominante civique B2 ; EE + EO.
- Support invariant : dossier contradictoire sur une liberté et ses limites juridiques.
- CO : deux points de vue argumentés.
- CE/VIS : carte d’argumentation SVG thèse/preuve/limite/objection/réponse.
- Lexique : pluralisme, dignité, concilier, proportionnalité, atteinte, jurisprudence, nuance.
- Production : défendre une position, intégrer une objection et conclure.
- Civique/preuve : expression, laïcité, pluralisme, dignité ; argumentation structurée.

#### S34 — Corpus historique multi-supports

- Type/dominante : dominante civique B2 ; CO + CE.
- Support invariant : corpus licencié sur Lumières, Républiques, guerres, Résistance et Europe.
- CO : commentaire reliant deux documents.
- CE/VIS : documents historiques licenciés et frise déterministe ; aucune fausse archive.
- Lexique : héritage, rupture, continuité, régime, occupation, résistance, intégration européenne.
- Production : synthèse multi-supports avec hiérarchisation.
- Civique/preuve : repères NAT et relations de cause/conséquence.

#### S35 — Citoyenneté et enjeu contemporain

- Type/dominante : mixte B2 ; CE + EE.
- Support invariant : données publiques sourcées sur engagement, environnement ou cohésion sociale.
- CO : interview pédagogique avec données identiques au dossier.
- CE/VIS : graphiques rendus depuis les données ; jamais de chiffres inventés dans l’image.
- Lexique : participation, engagement, cohésion, transition, indicateur, tendance, limite.
- Production : prise de position documentée, prudente sur les limites des données.
- Civique/preuve : citoyenneté, environnement, francophonie et cohésion ; analyse critique.

#### S36 — Simulation NAT sous contrainte

- Type/dominante : simulation civique NAT.
- Support invariant : banque NAT validée, verrouillée et versionnée.
- CO/CE/VIS : médias publiés avant la passation, aucune génération en direct.
- Langue : compréhension des formulations complexes et stratégie de temps.
- Civique : QCM 40/45, 28 connaissances et 12 situations simulées selon le format de référence.
- Preuve : score, durée, erreurs par notion, comparaison avec la simulation précédente.

#### S37 — Parcours, principes et entretien d’assimilation

- Type/dominante : EO B2 + entretien.
- Support invariant : dossier personnel pseudonymisé et carte de réponse structurée.
- CO : modèles d’entretiens variés, jamais à mémoriser mot à mot.
- CE/VIS : carte SVG récit/valeur/exemple/nuance et scène générique d’entretien.
- Lexique : parcours, motivation, adhésion, principe, engagement, expérience, nuance, projet.
- Production : présenter son parcours et répondre à des relances imprévues.
- Civique/preuve : principes républicains et motivation ; entretien simulé, correction linguistique et factuelle.

### E4 — Évaluation de sortie B2 / NAT (2 h)

- Échantillon TCF IRN ciblé : 55 min.
- Examen civique NAT complet : 45 min.
- Entretien d’assimilation simulé et restitution : 20 min.
- Décision : prêt à l’inscription, consolidation ciblée ou volume supplémentaire.
- Aucune promesse de réussite officielle n’est produite par l’application.

## 7. Évaluation, IPE et orientation

### 7.1 Langue

- Afficher CO, CE, EE et EO séparément.
- Les structures servent la remédiation ; elles ne sont pas présentées comme une cinquième épreuve officielle.
- Une moyenne globale ne masque jamais une compétence sous le seuil.
- Les exercices internes sont clairement distingués du TCF IRN officiel.

### 7.2 Civique

Chaque tentative enregistre au minimum :

- mode_passation ;
- avec_aide ;
- chronometree ;
- duree_secondes ;
- complete ;
- score_brut et nombre_questions ;
- mention CSP, CR ou NAT ;
- bank_version ;
- started_at et submitted_at ;
- les versions et hashes des médias.

L’IPE affiche :

- score_apprentissage : entraînements qualifiés, avec ou sans aide ;
- score_simulation : simulations complètes, sans aide et chronométrées ;
- exam_ready : vrai seulement après deux simulations distinctes de 40 questions, terminées en 45 minutes maximum, sans aide, avec au moins 32/40.

Un entraînement non chronométré guide la remédiation mais ne satisfait jamais exam_ready.

### 7.3 Orientation

    E2
      A2/CSP prêt -> sortie possible
      proche B1 -> extension B1
      A2 non stabilisé -> consolidation

    E3
      B1/CR prêt -> sortie possible
      B1 solide + objectif naturalisation -> extension B2
      B1 non stabilisé -> consolidation

    E4
      B2/NAT prêt -> orientation vers les épreuves officielles
      fragilité ciblée -> plan complémentaire

## 8. Contrats de données

Cursor crée des migrations additives. Les tables existantes restent utilisables.

### 8.1 Tables à ajouter ou étendre

- training_plan_versions : identifiant, version, statut, heures, paliers, dates.
- training_sessions : code S01–S37, ordre, palier, type, durée, objectifs, thème civique, compétences.
- invariant_supports : support_id, version, hash, données canoniques, source_ids, statut.
- session_resources : type, chemin, MIME, version, hash, provider, génération, validation, publication.
- exercise_variants : support_id, niveau A1–B2, consigne, aides, questions, corrigé, invariants_hash.
- civic_questions : mention, thème, notion, type, official_status, source_id, referential_version.
- resource_generation_batches : configuration, coûts, état, compteurs, reprise et rapport.
- resource_generation_jobs : session, ressource, tentative, dépendances, erreurs et idempotency_key.
- validation_reports : validateur, modèle, règles, scores, bloquants, rapport JSON.
- exercise_image_assets : exercice, image, rôle, ordre, dépendance de réponse, version et hash.
- curriculum_publications : plan_version, ressource, published_at, published_by, version précédente.
- cohort_resource_pins : cohorte, plan, support et versions figées.

La table pédagogique existante pedagogical_images reste la banque de fichiers. Ajouter les champs de publication et traçabilité nécessaires plutôt que créer une seconde banque concurrente.

### 8.2 Statuts

    planned
    preflight_passed
    generating
    generated
    deterministic_checked
    ai_reviewed
    publishable
    published
    quarantined
    superseded
    unpublished

Aucune ressource ne passe directement de generated à published.

### 8.3 Manifeste de séance minimal

Le schéma exige : session_code, plan_version, support_id, type_seance, objectifs, competences, civic_theme, civic_mention, source_ids, resources, variants, duration_plan, validation_policy et publication_policy.

Chaque ressource exige : resource_id, kind, required, generation_mode, prompt_version, required_elements, forbidden_elements, source_ids, rights_status, output_spec, alt_text, depends_on_answer, expected_hash et dependencies.

## 9. Pipeline du batch unique

### 9.1 Préflight global

Avant tout appel payant, vérifier :

- 37 séances et E1–E4 présentes ;
- identifiants uniques et dépendances résolues ;
- quatre variantes demandées pour chaque support ;
- source et droits pour chaque fait ou actif sensible ;
- briefs audio et visuels complets ;
- aucune collision de chemin ou clé d’idempotence ;
- budget estimé inférieur au plafond ;
- variables obligatoires disponibles ;
- stockage et base accessibles ;
- anciennes cohortes protégées par leurs pins.

Un échec rend le batch preflight_failed et empêche toute dépense.

### 9.2 Génération

Pour chaque séance :

1. créer et valider support-master.json ;
2. figer support_id, support_version et support_hash ;
3. dériver les traitements A1/A2/B1/B2 sans modifier les invariants ;
4. produire HTML puis PDF ;
5. produire ou récupérer le visuel selon generation_mode ;
6. générer le MP3 depuis le script figé ;
7. construire exercices, corrigés, devoirs et fiche formateur ;
8. calculer les hashes et compléter le manifeste.

La concurrence est limitée et configurable. Les appels Anthropic utilisent un schéma local strict ; toute sortie invalide est rejetée avant stockage.

### 9.3 Cadre de recherche et validation factuelle

Pour chaque affirmation civique, juridique, historique, sanitaire ou administrative :

1. chercher uniquement dans la liste blanche de sources ;
2. enregistrer l’extrait de preuve, l’URL, la date et le hash ;
3. demander à Anthropic une proposition à partir de ces extraits, sans connaissance libre ;
4. vérifier automatiquement que chaque fait possède source_id ;
5. faire relire le contenu par un appel séparé de celui qui l’a produit ;
6. bloquer en cas de contradiction, source absente, source périmée ou formulation ambiguë.

Anthropic ne navigue pas librement depuis le navigateur de l’élève. Les sources sont collectées côté serveur, mises en cache et versionnées.

### 9.4 Double contrôle des médias et documents

Contrôle 1, déterministe :

- fichier décodable, MIME, taille, ratio et durée conformes ;
- aucune ressource vide ;
- PDF rendu sans débordement ni page blanche ;
- OCR conforme au texte structuré ;
- compte exact des éléments vérifiable par données ou gabarit ;
- absence de logo, filigrane, donnée personnelle et doublon ;
- hashes, sources, droits, alt et transcription présents ;
- cohérence des identifiants et des liens exercice-corrigé.

Contrôle 2, IA de revue :

- cohérence support, consigne, options et corrigé ;
- une seule réponse défendable ;
- aucune image ne révèle la réponse ;
- absence de détail parasite et de stéréotype ;
- lisibilité A1–B2, accessibilité et neutralité ;
- faits identiques entre texte, audio, image et variantes ;
- quality_score au moins 4/5 ;
- pedagogical_relevance_score au moins 4/5 ;
- zéro bloquant.

Le modèle de revue est configuré séparément du modèle de contenu. Pour une image produite par un fournisseur raster, Anthropic Vision est le vérificateur indépendant. Le comptage exact et la géométrie ne reposent jamais uniquement sur la vision IA.

### 9.5 Nouvelle tentative et quarantaine

- Trois tentatives maximum par ressource.
- Chaque tentative reprend le brief original et ajoute seulement les motifs d’échec.
- Les invariants restent inchangés.
- Après trois échecs : quarantined, rapport détaillé, aucune publication.
- Le reste du batch continue.
- Une relance avec la même idempotency_key reprend le job sans doublon.

### 9.6 Publication automatique

Pour chaque ressource publishable, effectuer atomiquement :

1. téléverser dans le bucket adapté ;
2. upsert de la ligne de ressource ;
3. créer les liaisons séance/exercice ;
4. enregistrer provider, modèles, prompts, sources, versions et hashes ;
5. enregistrer les deux rapports de validation ;
6. créer le pack hors ligne ;
7. publier avec published_by=automation et published_at ;
8. invalider le cache ;
9. conserver previous_published_version_id.

En cas d’échec partiel, la version précédente reste active. Le batch se termine en published_complete si tout est publié, published_partial si les conformes sont publiés mais qu’il existe une quarantaine, ou needs_attention en cas d’incohérence transactionnelle.

### 9.7 Revue humaine post-publication

Le tableau formateur affiche par séance : aperçu, exercice, réponse attendue, sources, brief, scores, rapports, version, hash et historique.

Actions : Remplacer, Régénérer, Dépublier, Restaurer. Toute correction crée une nouvelle version. Une cohorte commencée reste sur sa version tant que le formateur ne demande pas explicitement sa migration.
## 10. Travail demandé à Cursor

### Lot 1 — Fondations

- Ajouter les migrations des tables et statuts.
- Créer les schémas Zod/JSON du plan, des séances, supports, variantes, ressources et rapports.
- Créer content/curriculum/v2/manifest.json listant S01–S37 et E1–E4.
- Ajouter un validateur de cohérence des 80/100/120 h.
- Protéger les secrets dans les fonctions serveur ; aucune clé dans VITE_ ni dans le navigateur.

Critère de sortie : npm run curriculum:preflight réussit sans appel API et détecte volontairement un manifeste incomplet.

### Lot 2 — Orchestrateur indépendant des fournisseurs

Créer une interface commune :

- ContentProvider : génération structurée et revue Anthropic ;
- ImageProvider : SVG, Gemini, OpenAI ou disabled ;
- TtsProvider : Google TTS ;
- Renderer : HTML vers PDF, SVG vers PNG/WebP ;
- StoragePublisher : Supabase Storage et tables ;
- SourceCollector : récupération, snapshot, hash et liste blanche.

Transformer scripts/generate-pedagogical-images-gemini.mjs en adaptateur. Ne pas perdre les plans JSON existants ; fournir un convertisseur vers le nouveau manifeste.

Critère de sortie : les doubles de test produisent un lot complet sans accès réseau.

### Lot 3 — Production d’une séance

Créer un pipeline session qui génère le paquet standard, respecte les dépendances, rend les PDF et médias, puis exécute les deux contrôles.

Commandes attendues :

    npm run curriculum:preflight
    npm run curriculum:generate -- --only S01 --dry-run
    npm run curriculum:generate -- --only S01
    npm run curriculum:validate -- --only S01
    npm run curriculum:publish -- --only S01
    npm run curriculum:batch -- --from S01 --to S37 --publish
    npm run curriculum:resume -- --batch-id <id>
    npm run curriculum:report -- --batch-id <id>

Critère de sortie : S01 est visible dans CapTCF avec ses quatre fiches, audio, transcription, visuel, lexique, exercices, corrigés, devoirs, sources et historique.

### Lot 4 — Contenus S01–S37

- Encoder d’abord les 37 briefs présents dans ce document.
- Générer support-master avant les variantes.
- Ne jamais demander au modèle quatre supports différents.
- Bloquer toute variante qui modifie les faits, dates, nombres, personnes ou médias.
- Créer les évaluations uniquement depuis une banque publiée et gelée.
- Générer tous les visuels déterministes avant d’appeler un fournisseur raster.
- Pré-générer tous les audios ; conserver le script exact.

Critère de sortie : couverture obligatoire 100 % ou quarantaine explicite, aucune erreur silencieuse.

### Lot 5 — Publication et interface

- Ajouter une page formateur « Production du parcours ».
- Afficher progression globale et par séance.
- Autoriser le lancement du batch unique avec estimation de coût et plafond.
- Publier automatiquement les ressources conformes.
- Ajouter la file de revue post-publication et le diff entre versions.
- Ajouter un bouton de restauration atomique.
- Afficher clairement les quarantaines et leur cause.

Critère de sortie : une publication interrompue ne laisse jamais une séance avec un support et un corrigé de versions différentes.

### Lot 6 — IA en séance

L’assistant reçoit uniquement :

- objectifs et niveau cible ;
- ressources publiées de la séance ;
- extraits de sources autorisées ;
- erreurs observées de l’apprenant, pseudonymisées ;
- règles d’adaptation.

Il peut simplifier la consigne, fournir une amorce, expliquer un mot, créer un item supplémentaire non certificatif ou proposer une relance orale. Il ne peut pas modifier support-master, inventer un fait civique, remplacer un média évalué ou republier sans repasser le pipeline.

Critère de sortie : toute réponse de l’assistant indique les resource_ids utilisés et l’adaptation reste traçable.

## 11. Fichiers du dépôt à créer ou modifier

### À créer

- content/curriculum/v2/manifest.json
- content/curriculum/v2/S01 à S37
- scripts/curriculum/preflight.mjs
- scripts/curriculum/generate-batch.mjs
- scripts/curriculum/validate-batch.mjs
- scripts/curriculum/publish-batch.mjs
- scripts/curriculum/resume-batch.mjs
- scripts/curriculum/render-documents.mjs
- scripts/curriculum/providers/anthropic-content.mjs
- scripts/curriculum/providers/svg-image.mjs
- scripts/curriculum/providers/gemini-image.mjs
- scripts/curriculum/providers/google-tts.mjs
- scripts/curriculum/validators/deterministic.mjs
- scripts/curriculum/validators/anthropic-review.mjs
- src/pages/formateur/ProductionParcours.tsx
- src/components/curriculum/BatchProgress.tsx
- src/components/curriculum/ResourceReview.tsx
- src/components/curriculum/VersionHistory.tsx
- supabase/functions/curriculum-batch/
- supabase/functions/curriculum-adapt/
- migrations additives correspondant aux tables de la section 8.

### À modifier

- package.json pour les commandes de la section 10 ;
- le routeur formateur pour la page Production du parcours ;
- le lecteur d’exercice pour épingler support_version et resource hashes ;
- le mode hors ligne pour télécharger le pack de séance ;
- les fonctions Anthropic existantes afin de partager client, journalisation, budget et gestion d’erreurs ;
- le générateur et l’importeur d’images existants pour passer par les nouveaux contrats.

Aucun ancien fichier de contenu n’est supprimé pendant cette implémentation.

## 12. Tests obligatoires

### 12.1 Unitaires

- calcul exact des heures et paliers ;
- hash et idempotency_key stables ;
- détection d’une variante qui modifie le support ;
- validation du schéma de chaque ressource ;
- score exam_ready ;
- trois tentatives puis quarantaine ;
- sélection du bon fournisseur ;
- refus des secrets côté client.

### 12.2 Intégration

- S01 complet avec doubles d’API ;
- S01 réel en environnement de préproduction ;
- S01–S05 en batch ;
- reprise après interruption ;
- échec TTS sans perte du reste ;
- échec image sans faux placeholder ;
- publication transactionnelle et rollback ;
- cohorte ancienne restant épinglée ;
- pack hors ligne contenant toutes les dépendances.

### 12.3 Visuels et documents

- rendu de chaque PDF en images pour détecter débordements et pages blanches ;
- OCR comparé aux données structurées ;
- test mobile, ordinateur et impression ;
- alt text présent et ne donnant pas la réponse ;
- même image maître A1/A2/B1/B2 ;
- cartes et frises comparées aux données sources ;
- aucun logo, filigrane, identité réelle ou marque non autorisée.

### 12.4 Pédagogiques

- une seule réponse défendable par QCM ;
- distracteurs plausibles mais faux pour une raison explicite ;
- correction justifiée ;
- langue adaptée au niveau ;
- montée A1 vers B2 visible dans le traitement, pas dans les faits ;
- séparation des scores langue et civique ;
- simulations complètes réellement limitées à 45 minutes ;
- mention « simulation pédagogique » sur les mises en situation inventées.

## 13. Données, sécurité et coûts

- Les clés restent dans les secrets Supabase ou le coffre du déploiement.
- Les productions d’élèves sont pseudonymisées avant appel à Anthropic.
- L’audio d’un élève n’est envoyé à une IA qu’avec le consentement prévu par l’application.
- Chaque appel journalise fonction, modèle, tokens, coût, statut, finalité et catégories de données.
- Un plafond global et un plafond par ressource arrêtent les nouveaux appels, sans annuler les publications déjà atomiquement réussies.
- Le batch sait reprendre après limitation de débit avec délai exponentiel et jitter.
- Les sources et licences sont auditables.
- La suppression d’une ressource publiée est logique ; le fichier reste conservé tant qu’une cohorte ou une tentative le référence.

## 14. Critères finaux d’acceptation

Le travail est terminé uniquement si :

1. les 37 séances, quatre évaluations et 120 h sont représentées ;
2. chaque séance possède son paquet complet ou une quarantaine explicite ;
3. chaque support possède quatre traitements A1/A2/B1/B2 ;
4. images, textes, audios, questions et corrigés sont cohérents par hash ;
5. tous les contenus sensibles ont une source et une version ;
6. toutes les ressources conformes ont été publiées automatiquement ;
7. aucune ressource ayant un bloquant n’a été publiée ;
8. les anciennes versions peuvent être restaurées ;
9. les cohortes existantes ne sont pas cassées ;
10. le formateur peut travailler sans génération indispensable en direct ;
11. l’IA peut néanmoins adapter à la marge à partir des documents publiés ;
12. les deux scores civiques à 32/40 sont mesurés sur 40 questions, sans aide et en 45 minutes maximum ;
13. un rapport final liste pour chaque séance : ressources prévues, générées, validées, publiées, quarantaines, coûts, sources et hashes.

## 15. Politique finale résumée

CapTCF prépare une fois, vérifie deux fois, publie automatiquement, puis permet au formateur d’améliorer progressivement. Anthropic orchestre les contenus et la revue ; les rendus déterministes sécurisent les documents ; Google TTS prépare les audios ; un fournisseur d’images séparé ne sert qu’aux scènes raster réellement nécessaires. Pendant le cours, l’IA reste active, mais elle travaille toujours depuis une base déjà validée et versionnée.
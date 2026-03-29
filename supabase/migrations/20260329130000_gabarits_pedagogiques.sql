-- Migration: Table gabarits_pedagogiques (référentiel plan v2.0)

CREATE TABLE IF NOT EXISTS public.gabarits_pedagogiques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL UNIQUE,
  titre text NOT NULL,
  bloc text NOT NULL,
  palier_cecrl text NOT NULL,
  niveau_cible text NOT NULL DEFAULT 'A1',
  duree_minutes integer NOT NULL DEFAULT 180,
  competences_cibles text[] NOT NULL DEFAULT '{}',
  objectif_principal text NOT NULL DEFAULT '',
  lexique_cibles text NOT NULL DEFAULT '',
  consignes_generation text NOT NULL DEFAULT '',
  criteres_reussite text NOT NULL DEFAULT '',
  dependances_seances integer[] NOT NULL DEFAULT '{}',
  version text NOT NULL DEFAULT '2.0',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gabarits_pedagogiques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gabarits_select_all" ON public.gabarits_pedagogiques
  FOR SELECT USING (true);

-- Insertion des 20 gabarits du plan TCF IRN v2.0
INSERT INTO public.gabarits_pedagogiques
  (numero, titre, bloc, palier_cecrl, niveau_cible, duree_minutes,
   competences_cibles, objectif_principal, lexique_cibles,
   consignes_generation, criteres_reussite, dependances_seances)
VALUES
  (1, 'Séance 1 — Entrer en contact et saluer', 'Bloc 1 — L''identité et les bases', 'A0 bas', 'A0', 180, '{CO,EO}', 'L''apprenant est capable de saluer, de dire bonjour/au revoir et de comprendre une salutation orale simple dans un contexte d''accueil administratif.', 'bonjour, bonsoir, au revoir, merci, s''il vous plaît, excusez-moi, madame, monsieur, oui, non, pardon, ça va, bien, comment allez-vous, je ne comprends pas, répétez s''il vous plaît', '9.	QCM audio : 6 mini-dialogues 5-10 s, voix lente et articulée, contexte administratif. 3 propositions illustrées. Lexique limité aux 16 mots de la séance.
10.	Appariement : 6 images + 6 étiquettes-mots. Drag & drop mobile.
11.	Répétition orale : audio modèle → 3 s d''attente → enregistrement 5 s max. ASR compare au mot cible avec tolérance élevée.
12.	Vrai/Faux : audio 5 s, 2 boutons VRAI/FAUX. Correction immédiate.
13.	Présentiel : consigne formateur affichée : ''Jouez un agent d''accueil. Dites bonjour, demandez comment ça va.'' Formateur coche OUI/NON.
📚 Adaptations — Profil faible littératie
Profil détecté à cette séance via 3 questions formateur (sait lire ? smartphone ? clavier ?)
Si profil activé : QCM à 2 images seulement, consignes en audio uniquement, pas de frappe clavier', '', '{}'),
  (2, 'Séance 2 — L''identité administrative', 'Bloc 1 — L''identité et les bases', 'A0 bas', 'A0', 180, '{CE,EE,EO}', 'L''apprenant est capable de dire et d''écrire son nom, son prénom, sa nationalité et son pays d''origine.', 'nom, prénom, nationalité, pays, date de naissance, alphabet A-Z, je m''appelle, je suis, mon nom est, comment vous appelez-vous, quelle est votre nationalité, français/française, marocain/marocaine, algérien/algérienne, tunisien/tunisienne, sénégalais/sénégalaise, congolais/congolaise, formulaire, passeport, carte d''identité', '20.	QCM audio : 5 audios 10-15 s. Voix lente. 3 fiches d''identité illustrées (photo, nom, drapeau).
21.	Formulaire : fac-similé OFII avec champs NOM/PRÉNOM/NATIONALITÉ/PAYS/DATE. Glisser des étiquettes.
22.	Épellation : lettre par lettre avec 1 s de pause. Tolérance majuscules/minuscules.
23.	Mini-formulaire : correction IA — vérifier nationalité dans liste francophone. Formateur valide.
24.	Production orale : ASR vérifie ''je m''appelle'' + prénom, ''je suis'' + nationalité.
25.	Drapeaux : Maroc, Algérie, Tunisie, Sénégal, RDC, France. Drag & drop.
📚 Adaptations — Profil faible littératie
Épellation : si faible littératie, l''apprenant dit les lettres à voix haute au lieu de taper', '', '{}'),
  (3, 'Séance 3 — Les chiffres, l''âge et le téléphone', 'Bloc 1 — L''identité et les bases', 'A0 bas', 'A0', 180, '{CO,EE}', 'L''apprenant est capable de dire et comprendre les nombres de 0 à 99, de donner son âge et son numéro de téléphone.', '0 à 99, zéro à quatre-vingt-dix-neuf, j''ai... ans, quel âge avez-vous, numéro de téléphone, 06/07, numéro de dossier, ticket', '32.	Dictée : audio 3-5 s/item. Voix lente. 0-20 (items 1-4), 20-69 (5-7), 70-99 (8-10). Champ numérique.
33.	QCM audio : dialogues 10 s, contexte administratif. 3 propositions en chiffres.
34.	Téléphone : dicter par paires. 10 cases. Rejouer audio 1 fois possible.
35.	Appariement : 8 étiquettes en lettres + 8 en chiffres. Drag & drop aléatoire.
36.	EO : ASR vérifie ''j''ai ... ans'' + séquence de 10 chiffres.
37.	Formulaire : champs ÂGE (numérique) et TÉLÉPHONE (10 chiffres). Validation format.
📚 Adaptations — Profil faible littératie
Dictée de nombres : pour les non-lecteurs, l''apprenant dit le nombre à voix haute (EO) au lieu de taper', '', '{}'),
  (4, 'Séance 4 — La situation familiale', 'Bloc 1 — L''identité et les bases', 'A0 bas', 'A0', 180, '{CE,EE,EO}', 'L''apprenant est capable de décrire sa situation familiale simple (marié, célibataire, enfants) et de comprendre ces informations à l''oral et à l''écrit.', 'marié(e), célibataire, divorcé(e), veuf/veuve, pacsé(e), époux/épouse, mari/femme, enfant, fils, fille, père, mère, frère, sœur, famille, j''ai... enfants, combien d''enfants, situation familiale', '44.	QCM audio : 5 audios 15-20 s. 3 images (famille avec enfants / personne seule / couple sans enfants).
45.	Formulaire CAF : profil textuel court fourni, l''apprenant coche et écrit le nombre d''enfants.
46.	Complétion : menu déroulant 3-4 choix. Correction automatique.
47.	Arbre : schéma simplifié, 6 étiquettes drag & drop.
48.	EO : ASR vérifie ''je suis + statut'', ''j''ai + nombre + enfants''.
49.	EE : correction IA — cohérence statut + enfants, tolérance orthographe élevée.
📚 Adaptations — Profil faible littératie
Arbre généalogique : version image uniquement (photos de personnages, pas de texte)', '', '{}'),
  (5, 'Séance 5 — L''adresse et le logement', 'Bloc 1 — L''identité et les bases', 'A0 bas', 'A0', 180, '{CO,CE,EE}', 'L''apprenant est capable de dire et écrire son adresse complète et de comprendre les termes liés au logement sur un document administratif.', 'adresse, numéro, rue, avenue, boulevard, place, code postal, ville, étage, appartement, maison, immeuble, j''habite à/au, chez, quartier, bâtiment, escalier, digicode, boîte aux lettres, courrier, enveloppe, facteur', '56.	Dictée d''adresse : voix très lente, adresses françaises réalistes. Tolérance accents et casse.
57.	QCM audio : dialogues 15 s, contexte guichet. 3 propositions textuelles.
58.	Enveloppe : gabarit avec 3 lignes, étiquettes drag & drop.
59.	Lecture : courrier simplifié (logo Préfecture, adresses, objet). 4 QCM à 3 choix.
60.	EE : correction IA — vérifier structure (numéro + rue + code postal + ville). Tolérance élevée.
61.	EO : ASR vérifie ''j''habite à/au'' + éléments d''adresse.
📚 Adaptations — Profil faible littératie
Dictée d''adresse : l''apprenant dit l''adresse à voix haute plutôt que de la taper', '', '{}'),
  (6, 'Séance 6 — Comprendre les consignes TCF et de classe', 'Bloc 2 — L''environnement et le temps', 'A0 intermédiaire', 'A0', 180, '{CO,CE}', 'L''apprenant est capable de comprendre et suivre les consignes courantes de l''examen TCF et de la classe.', 'lisez, écoutez, écrivez, parlez, cochez, choisissez, répétez, entourez, soulignez, signez, asseyez-vous, attendez, regardez, ouvrez, fermez, levez la main, tournez la page, vrai, faux, question, réponse, exercice, exemple, consigne', '67.	QCM audio : 8 audios 3-5 s. Une seule consigne par audio. 3 images-icônes.
68.	Appariement : 2 colonnes, verbes en majuscules / pictogrammes. Drag & drop.
69.	Simon dit : fausse interface examen avec 4 cases A/B/C/D. Audio dit ''Cochez la case X''. Clic. Feedback immédiat.
70.	QCM écrit : consigne réaliste. 3 propositions. Correction automatique.
71.	Classement : 12 étiquettes dans 4 boîtes. Correction automatique.
📚 Adaptations — Profil faible littératie
Simon dit : version 100% icônes (sans texte sur les boutons)
QCM écrit : remplacé par QCM audio pour les non-lecteurs', '', '{}'),
  (7, 'Séance 7 — Le calendrier, les jours, les mois et les rendez-vous', 'Bloc 2 — L''environnement et le temps', 'A0 intermédiaire', 'A0', 180, '{CO,CE,EO}', 'L''apprenant est capable de comprendre et dire une date complète (jour, mois, année) et de prendre un rendez-vous simple.', 'lundi à dimanche, janvier à décembre, date, rendez-vous, convocation, le + numéro + mois, quand, quel jour, aujourd''hui, demain, hier, semaine, mois, année, 2024, 2025', '79.	QCM audio : 5 audios 10-15 s, contexte message téléphonique ou accueil. 3 dates en toutes lettres + chiffres.
80.	Jours/mois : étiquettes mélangées, drag & drop. Chronomètre optionnel.
81.	Convocation : document réaliste (en-tête préfecture, logo RF). 4 QCM à 3 choix.
82.	Dictée dates : accepter JJ/MM/AAAA, JJ-MM-AAAA, JJ.MM.AAAA.
83.	EO : ASR vérifie présence d''une date (chiffre + mois).
84.	Jeu de rôle : formateur joue le secrétariat, propose 2 dates. L''apprenant choisit et répète.
📚 Adaptations — Profil faible littératie
Convocation lue à voix haute par l''audio intégré', '', '{3}'),
  (8, 'Séance 8 — L''heure et les horaires d''ouverture', 'Bloc 2 — L''environnement et le temps', 'A0 intermédiaire', 'A0', 180, '{CO,CE}', 'L''apprenant est capable de comprendre et dire l''heure, et de lire des horaires d''ouverture d''un service public ou d''un commerce.', 'heure, minute, il est... heure(s), et quart, et demie, moins le quart, midi, minuit, du matin/de l''après-midi/du soir, à quelle heure, ouvert, fermé, horaires d''ouverture, de... à..., pause déjeuner, lundi au vendredi, fermé le dimanche', '91.	QCM audio : 6 audios 5-8 s. 3 horloges analogiques. Progression : heures rondes → demi-heures → quarts.
92.	Appariement : 6 horloges + 6 étiquettes 24h. Drag & drop.
93.	Horaires : panneau réaliste (Mairie de [ville]). 5 Vrai/Faux.
94.	Dictée : format HH:MM. Accepter avec ou sans ''h''.
95.	EO : ASR vérifie la présence d''un horaire cohérent.
96.	Combiné : audio 15 s (message répondeur). 3 propositions date+heure.
📚 Adaptations — Profil faible littératie
Horloges : version analogique avec grande aiguille et petite aiguille bien visibles', '', '{7}'),
  (9, 'Séance 9 — Faire des achats et comprendre les prix', 'Bloc 2 — L''environnement et le temps', 'A0 intermédiaire', 'A0', 180, '{CO,EO}', 'L''apprenant est capable de comprendre un prix, de demander ''Combien ça coûte ?'' et de réaliser un échange simple dans un commerce.', 'combien, combien ça coûte, ça fait combien, le prix, euro(s), centime(s), c''est cher/pas cher, je voudrais, je prends, l''addition, le ticket, la monnaie, payer, carte, espèces, boulangerie, pharmacie, supermarché, un kilo de, pain, lait, médicament, timbre', '103.	QCM audio : 6 dialogues 10-15 s, contexte boulangerie/supermarché/pharmacie. 3 propositions de prix.
104.	Ticket : 3-5 articles avec prix unitaire et total. 4 QCM.
105.	Appariement : 6 images + 6 prix réalistes France. Drag & drop.
106.	Dictée prix : champ numérique avec virgule. Tolérance point ou virgule.
107.	Jeu de rôle présentiel : grille formateur (salutation, demande correcte, compréhension du prix).
108.	Jeu de rôle webapp : 3 échanges audio (bonjour / prix / merci). ASR vérifie la cohérence.
📚 Adaptations — Profil faible littératie
Ticket de caisse : lu à voix haute par l''audio', '', '{3,8}'),
  (10, 'Séance 10 — S''orienter dans la ville et les lieux administratifs', 'Bloc 2 — L''environnement et le temps', 'A0 intermédiaire', 'A0', 180, '{CO,CE,EO}', 'L''apprenant est capable de comprendre et donner des indications directionnelles simples, et d''identifier les principaux lieux administratifs.', 'où est, pour aller à, tout droit, à gauche, à droite, tournez, continuez, traversez, en face de, à côté de, entre, près de, loin de, ici, là-bas, la préfecture, la mairie, la CAF, Pôle emploi, l''école, l''hôpital, la gare, la poste, la pharmacie, le marché, le supermarché, le plan, le panneau', '115.	QCM audio : 5 audios 15-20 s, voix lente. Plan simplifié avec 4-5 rues. 3 parcours fléchés.
116.	Appariement : 8 pictogrammes simples + 8 noms de lieux. Drag & drop.
117.	Plan : plan de quartier stylisé. 4 QCM (en face de / à côté de / entre).
118.	Complétion : menu déroulant (tournez/continuez/traversez/allez).
119.	EO : ASR vérifie ''où est'' ou ''pour aller à'' + nom de lieu + direction.
120.	Jeu de rôle : formateur avec plan fléché. Grille : directions correctes, utilisation de tournez/continuez.
📚 Adaptations — Profil faible littératie
Plan : pictogrammes grands et colorés, pas de noms de rues en texte', '', '{}'),
  (11, 'Séance 11 — Les transports en commun', 'Bloc 3 — Vie pratique et démarches', 'A0 haut', 'A0', 180, '{CO,CE}', 'L''apprenant est capable de comprendre les informations essentielles pour utiliser les transports en commun et d''acheter un titre de transport.', 'bus, métro, tramway, train, gare, arrêt, station, ligne, direction, correspondance, ticket, carte, abonnement, pass, aller simple, aller-retour, composter, valider, monter, descendre, prochain, suivant, terminus, retard, supprimé, quai, voie, sortie, plan, automate, guichet', '127.	QCM audio : 5 annonces réalistes 8-15 s, avec bruit de fond léger (signal sonore métro). 3 propositions.
128.	Plan métro : plan fictif simplifié (5-6 lignes, 15-20 stations). 4 QCM.
129.	Panneau : tableau d''affichage 4 colonnes (Destination/Heure/Voie/Observations). 4 QCM.
130.	Complétion : menu déroulant (ticket, aller-retour, euros, correspondance).
131.	Vrai/Faux : 5 annonces 8-10 s. 2 boutons.
132.	EO : scénario (''Vous êtes à la gare. Achetez un aller-retour pour Lyon.''). ASR vérifie : je voudrais, aller-retour, nom de ville.
📚 Adaptations — Profil faible littératie
Panneau d''affichage : lu à voix haute par l''audio intégré', '', '{8,10}'),
  (12, 'Séance 12 — La santé, le corps et le médecin', 'Bloc 3 — Vie pratique et démarches', 'A0 haut', 'A0', 180, '{CO,CE,EO}', 'L''apprenant est capable de décrire un problème de santé simple au médecin et de comprendre des consignes médicales de base.', 'tête, ventre, dos, bras, jambe, main, pied, gorge, dent, œil/yeux, oreille, nez, cœur. J''ai mal à, j''ai de la fièvre, je suis malade, je tousse, j''ai froid/chaud, le médecin, l''ordonnance, le comprimé, le sirop, la carte vitale, la mutuelle, avant/après le repas, le matin, le soir', '139.	Appariement : silhouette humaine avec zones cliquables. 10 étiquettes drag & drop.
140.	QCM audio : 5 dialogues médecin/patient 15-20 s. 3 images de symptômes.
141.	Ordonnance : fac-similé (en-tête médecin, médicament, posologie). 4 QCM.
142.	Complétion : menu déroulant (au, à la, à l'', le, chaque).
143.	EO : image du symptôme affichée. ASR vérifie ''j''ai mal à'' + partie du corps.
144.	Formulaire : champs NOM, ÂGE, SYMPTÔMES (texte libre), ALLERGIES (oui/non + texte). Correction IA.
📚 Adaptations — Profil faible littératie
Silhouette du corps : zones cliquables très larges, faciles à toucher sur mobile', '', '{7}'),
  (13, 'Séance 13 — Le travail et les métiers', 'Bloc 3 — Vie pratique et démarches', 'A0 haut', 'A0', 180, '{CE,EO}', 'L''apprenant est capable de dire son métier, de comprendre une offre d''emploi simple, et de parler de ses compétences de base.', 'le travail, le métier, la profession, je travaille, je suis + métier, je cherche un travail, je suis au chômage, Pôle emploi, offre d''emploi, CV, contrat, CDI/CDD, salaire, horaires, temps plein/partiel. Métiers : serveur/serveuse, vendeur/vendeuse, cuisinier/cuisinière, agent de nettoyage, aide-soignant(e), chauffeur, livreur, ouvrier, boulanger, coiffeur, maçon, électricien, baby-sitter', '151.	Appariement : 10 images réalistes + 10 étiquettes. Drag & drop.
152.	QCM audio : 5 dialogues 15-20 s. Contexte inscription Pôle emploi. 3 métiers illustrés.
153.	Annonce : style Pôle emploi (poste, lieu, horaires, salaire, contact). 4 QCM.
154.	Complétion : menu déroulant. Correction automatique.
155.	EO : ASR vérifie ''je suis + métier'' ou ''je travaille + lieu'' ou ''je cherche + travail''.
156.	EE : 3 phrases : métier, lieu de travail, horaires. Correction IA, tolérance orthographe élevée.
📚 Adaptations — Profil faible littératie
Appariement : images de métiers en très grand format', '', '{}'),
  (14, 'Séance 14 — L''école, les enfants et le carnet de liaison', 'Bloc 3 — Vie pratique et démarches', 'A0 haut', 'A0', 180, '{CE,EE}', 'L''apprenant est capable de comprendre un mot d''école (absence, réunion, sortie) et de rédiger un mot court pour l''école de son enfant.', 'l''école, la maternelle, le primaire, le collège, le maître/la maîtresse, l''enseignant(e), le directeur/la directrice, la classe, la cantine, la récréation, les vacances scolaires, le carnet de liaison, un mot, une absence, une réunion, une sortie scolaire, une autorisation, signer, absent(e), malade, excuser, cordialement, mon fils/ma fille, est absent(e) parce que', '163.	Lecture : 2 fac-similés de mots du carnet de liaison. 4 QCM par mot.
164.	QCM audio : 4 messages 15-20 s (réunion, changement horaire, sortie). 3 propositions.
165.	Mot à trous : gabarit formel, 4 champs (prénom enfant, date, raison, signature).
166.	EE absence : 30-60 mots. Correction IA : structure (destinataire + corps + signature), motif, longueur.
167.	EE autorisation : 30-60 mots. Même grille de correction IA.
168.	Appariement : 8 images + 8 étiquettes. Drag & drop.
📚 Adaptations — Profil faible littératie
Mots d''école : lus à voix haute par l''audio intégré', '', '{}'),
  (15, 'Séance 15 — Écrire un message court (SMS, mot, email simple)', 'Bloc 3 — Vie pratique et démarches', 'A0 haut', 'A0', 180, '{CE,EE}', 'L''apprenant est capable de rédiger un message court (SMS, email, mot) pour répondre à une situation de la vie quotidienne (30 à 60 mots).', 'SMS, message, email, objet, destinataire, Bonjour, Cher/Chère, Cordialement, À bientôt, Merci, je vous écris pour, je voudrais, est-ce que, pouvez-vous, s''il vous plaît, confirmer, annuler, demander, informer, répondre, envoyer, problème, question, rendez-vous, document', '175.	Lecture : 3 interfaces réalistes (bulle SMS, interface email, feuille manuscrite). 2 QCM par message.
176.	Classement : 8 étiquettes → 2 colonnes formel/informel. Correction automatique.
177.	Remise en ordre : 4-5 blocs de texte, drag & drop. 3 messages de difficulté croissante.
178.	EE SMS : SMS reçu affiché. Champ 30-60 mots. Compteur en direct. Correction IA.
179.	EE email : champs objet + corps. Correction IA : formules ouverture/clôture, demande claire, registre formel.
180.	EE mot : champ texte. Correction IA : 3 parties, cohérence, longueur.
📚 Adaptations — Profil faible littératie
SMS et email : dictée vocale au lieu de frappe clavier', '', '{14,4}'),
  (16, 'Séance 16 — Entraînement compréhension orale — format TCF', 'Bloc 4 — Préparation TCF IRN', 'A1', 'A1', 180, '{CO}', 'L''apprenant est capable de répondre correctement à au moins 60 % des questions de compréhension orale de niveau A1 au format exact du TCF IRN.', 'Tous les thèmes Blocs 1-3 : identité, famille, adresse, temps, achats, ville, transports, santé, travail, école, messages. Ajout : météo, loisirs, événements simples.', '185.	Mini-test : 10 QCM. Audio unique (bouton grisé après lecture). Chrono visible. Au moins 5 domaines différents. Score /10.
186.	Test complet : 25 items, 20 min. Items 1-10 : très simple, voix lente. Items 11-20 : débit normal. Items 21-25 : 2-3 informations à extraire. Score /25 + niveau estimé.
187.	Stratégie : afficher question + 4 choix 15 s avant l''audio. Comparer score avec/sans lecture anticipée.
188.	Correction présentiel : transcription + bonne réponse + explication erreur type pour le formateur.
📚 Adaptations — Profil faible littératie
Mode faible littératie non applicable au Bloc 4 (format TCF ne peut pas être simplifié)
Le formateur accompagne davantage les apprenants à profil faible littératie pendant ce bloc
✅ Critères de réussite', '', '{}'),
  (17, 'Séance 17 — Entraînement compréhension écrite — format TCF', 'Bloc 4 — Préparation TCF IRN', 'A1', 'A1', 180, '{CE}', 'L''apprenant est capable de répondre correctement à au moins 60 % des questions de compréhension écrite de niveau A1 au format exact du TCF IRN.', 'Tous les thèmes Blocs 1-3. Documents : panneaux, étiquettes, menus, horaires, formulaires CAF/OFII, petites annonces, emails/SMS, courriers (convocation, confirmation, information).', '193.	Mini-test : 10 QCM. Document court + question + 4 propositions. Chrono 14 min. Score /10.
194.	Test complet : 25 items, 35 min. Items 1-10 : visuels (panneaux, affiches, 1-2 phrases). Items 11-20 : courts (SMS, emails, menus, 3-5 lignes). Items 21-25 : longs (courriers, 5-8 lignes). Score /25 + niveau.
195.	Repérage : surlignage sur mobile (tap). Comparer taux de réussite avec/sans surlignage.
196.	Correction présentiel : texte + bonne réponse + mots-clés en surbrillance + explication.
📚 Adaptations — Profil faible littératie
Profil faible littératie : accompagnement formateur renforcé — pas de simplification possible au format TCF réel
Le formateur peut lire les consignes à voix haute pendant l''entraînement (pas à l''examen réel)
✅ Critères de réussite', '', '{}'),
  (18, 'Séance 18 — Entraînement expression écrite — format TCF', 'Bloc 4 — Préparation TCF IRN', 'A1', 'A1', 180, '{EE}', 'L''apprenant est capable de produire 3 textes courts au format exact de l''épreuve EE du TCF IRN dans le temps imparti.', 'Tous les thèmes Blocs 1-3. Sujets fréquents : décrire son logement, raconter une journée, parler de son quartier, donner son avis sur un lieu/activité.', '202.	Tâche 1 : message d''un ami 2-3 lignes + consigne. Compteur en direct. Indicateur : rouge <30, vert 30-60, orange >60. Chrono 10 min.
203.	Tâche 2 : consigne de récit. Même interface. 40-90 mots. Chrono 10 min.
204.	Tâche 3 : consigne d''opinion. 40-90 mots. Chrono 10 min.
205.	Simulation : 3 tâches sans pause. Chrono global 30 min. Score global /20.
206.	Correction formateur : productions + correction IA affichées. Formateur modifie score et commente.
📚 Adaptations — Profil faible littératie
Dictée vocale autorisée pour les apprenants ayant un profil faible littératie — le formateur valide que la production est bien de l''apprenant
Compteur de mots visible et grand sur mobile', '', '{}'),
  (19, 'Séance 19 — Entraînement expression orale — format TCF', 'Bloc 4 — Préparation TCF IRN', 'A1', 'A1', 180, '{EO}', 'L''apprenant est capable de réaliser les 3 tâches de l''épreuve d''expression orale du TCF IRN dans le temps imparti.', 'Tous les thèmes Blocs 1-3. T1 : identité, famille, travail, logement, loisirs. T2 : situations quotidiennes. T3 : sujets d''opinion simples.', '212.	Tâche 1 webapp : ''Présentez-vous : nom, famille, travail, logement, loisirs.'' Chrono 3 min. ASR vérifie 5 thèmes, fluidité, longueur.
213.	Tâche 2 webapp : scénario (texte + image). 3-4 réponses audio du réceptionniste virtuel. ASR vérifie présence de questions.
214.	Tâche 3 webapp : sujet affiché. Chrono 3 min 30. ASR vérifie : opinion, argument (parce que), durée >1 min.
215.	Simulation présentiel : 3 consignes + grille évaluation TCF pour le formateur (phonologie, lexique, grammaire, fluidité, cohérence, interaction). Score /20.
216.	Entraînement autonome : 10 sujets par tâche en boucle. Feedback IA après chaque enregistrement.
📚 Adaptations — Profil faible littératie
Profil faible littératie : focus EO renforcé depuis le début — ces apprenants ont généralement plus d''aisance à l''oral qu''à l''écrit
Tâche 2 et 3 simplifiées en entraînement (2 choix au lieu de libre) mais format TCF respecté à l''examen blanc', '', '{}'),
  (20, 'Séance 20 — Examen blanc complet — simulation TCF IRN A1', 'Bloc 4 — Préparation TCF IRN', 'A1', 'A1', 180, '{CO,CE,EE,EO}', 'L''apprenant réalise un examen blanc complet TCF IRN dans les conditions réelles et obtient un score correspondant au niveau A1 minimum.', 'Tous les thèmes de la formation. Sujets inédits non vus en entraînement.', '222.	CO : 25 items inédits. Écoute unique stricte. Chrono 20 min. Pas de retour en arrière. Score /25 + niveau CECRL.
223.	CE : 25 items inédits. Chrono 35 min. Navigation entre questions possible. Score /25 + niveau CECRL.
224.	EE : 3 tâches inédites. Champs texte + compteur de mots. Chrono 30 min global. Correction IA + validation formateur. Score /20.
225.	EO : formateur conduit avec 3 consignes inédites + grille notation TCF officielle. Score /20.
226.	Bilan automatique : score par épreuve, niveau CECRL par compétence, points forts, points faibles, recommandation (prêt / pas prêt). Formateur peut ajuster et commenter.
227.	⚠️ MODE EXAMEN : pas de retour arrière (CO), pas d''aide, pas de dictionnaire, pas de traduction. Interface épurée. Zéro feedback pendant l''épreuve.
📚 Adaptations — Profil faible littératie
Le bilan post-examen blanc inclut une note spécifique sur la progression des apprenants à profil faible littératie', '', '{}');

-- Index
CREATE INDEX IF NOT EXISTS gabarits_numero_idx ON public.gabarits_pedagogiques(numero);
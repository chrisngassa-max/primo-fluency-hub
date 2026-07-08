-- ============================================================
-- CapTCF — Seed S01 v3 dans session_documents (MVP "Documents de séance")
-- Contenu extrait de content/curriculum/v2/S01-v3/s01-v3-data.json,
-- déjà validé (GO) dans docs/seance-1-v3-validation/. Statut initial
-- 'a_completer' : socle de travail, pas un contenu final.
-- Idempotent : ne réinsère pas si déjà présent (session_code, document_type, version).
-- ============================================================

BEGIN;

INSERT INTO public.session_documents
  (session_code, document_type, title, level, competence, status, content_html, source_file_path, version)
VALUES
(
  'S01',
  'fiche_formateur',
  $doc$Fiche Formateur — Déroulé Pédagogique S01 (v3 dense)$doc$,
  'A1-B2',
  ARRAY['CO','CE','EO','EE','CIVIQUE']::text[],
  'a_completer',
  $doc$<p>Séance d'accueil dense : chaque apprenant repart avec (1) la compréhension complète de son parcours (durée, séances, évaluations), (2) la capacité à se présenter et présenter un tiers, (3) la distinction claire entre droit, devoir et règle, étayée par 20 questions sur le dialogue, un bloc grammaire gradé, un QCM TCF de 10 questions et un QCM civique de 10 questions avec justifications réelles.</p>
<h3>Objectifs opérationnels</h3>
<ul>
<li>Comprendre son parcours de formation et ses modalités (durée, séances, évaluations)</li>
<li>Se présenter et présenter un tiers (identité, nationalité, parcours)</li>
<li>Distinguer droit, devoir et règle</li>
<li>Découvrir les cinq thèmes civiques officiels du parcours</li>
</ul>
<h3>Déroulé détaillé (180 minutes)</h3>
<ol>
<li><strong>Rituel civique</strong> (10 min) — Observation collective du support visuel (5 thèmes civiques), 3 questions d'amorce, sans notation.</li>
<li><strong>Activation + lexique</strong> (20 min) — 10 mots-clés + 3 exercices (association, texte à trous, réemploi oral).</li>
<li><strong>Support invariant CO/CE</strong> (50 min) — Dialogue Awa/Mme Rossi (2 min 29 s) en 3 écoutes progressives + 20 questions/micro-tâches réparties par niveau.</li>
<li><strong>Ateliers différenciés</strong> (60 min) — 4 groupes A1/A2/B1/B2 : bloc grammaire gradé + exercices banque + variantes corrigées.</li>
<li><strong>Production EE/EO</strong> (30 min) — 8 prompts EO gradés + 2 productions EE guidées + 1 autonome.</li>
<li><strong>Fixation</strong> (10 min) — QCM civique 10 questions, correction flash, devoirs différenciés.</li>
</ol>
<h3>Règles d'adaptation &amp; vigilance</h3>
<ul>
<li>Si plus de la moitié du groupe confond droit et devoir, reprendre le lexique avant l'atelier B1.</li>
<li>Si le groupe est très hétérogène, prolonger l'atelier différencié de 10 minutes au détriment de la fixation.</li>
<li>Ne jamais remplacer le dialogue audio publié par une improvisation en direct : l'IA peut seulement l'expliquer ou le simplifier.</li>
<li>Les 3 variantes A2/B1/B2 ont été recréées (les originales étaient rejetées en base pour non-conformité de schéma) — vérifier leur validation avant réinsertion Supabase.</li>
</ul>$doc$,
  'seance-1-v3-validation/S01_FOR_FI_ALL_deroule-180min',
  1
),
(
  'S01',
  'fiche_apprenant',
  $doc$Fiche Apprenant Dense — Ateliers différenciés S01 (v3)$doc$,
  'A1-B2 gradué',
  ARRAY['Structures','CE','EE']::text[],
  'a_completer',
  $doc$<p>Travaillez les exercices correspondant à votre niveau. Le formateur passera vous aider.</p>
<h3>Bloc grammaire / structures — se présenter, identité, parcours</h3>

<div>
  <p><strong>A1 — Verbe être au présent</strong></p>
  <p>Conjuguez le verbe être.</p>
  <ul><li>Elle ___ française.</li><li>Je ___ marié.</li><li>Le dossier ___ complet.</li></ul>
</div>

<div>
  <p><strong>A1 — Pronoms personnels d'identité</strong></p>
  <p>Complétez avec le pronom correct (Je, Tu, Il, Elle).</p>
  <ul><li>___ m'appelle Ahmed.</li><li>___ habite à Marseille. (Sonia)</li><li>___ est né en 1985. (Marc)</li></ul>
</div>

<div>
  <p><strong>A1 — Verbes s'appeler / habiter au présent</strong></p>
  <p>Choisissez la forme correcte.</p>
  <ul><li>Comment tu ________ ? (t'appelles / t'appelle)</li><li>Il ________ à Paris. (habite / habitent)</li></ul>
</div>

<div>
  <p><strong>A2 — Adjectifs possessifs (identité/papiers)</strong></p>
  <p>Complétez avec 'mon', 'ma' ou 'mes'.</p>
  <ul><li>Je vous présente ___ passeport.</li><li>C'est ___ carte d'identité.</li><li>Je cherche ___ papiers.</li></ul>
</div>

<div>
  <p><strong>A2 — Structure « je m'appelle / je suis / j'habite »</strong></p>
  <p>Complétez le texte de présentation.</p>
  <ul><li>Bonjour, je (1)________ Thomas Martin. Je (2)________ boulanger. J'(3)________ à Lyon. J'ai 34 (4)________.</li></ul>
</div>

<div>
  <p><strong>B1 — Nationalité / pays-ville (« venir de » + « habiter à »)</strong></p>
  <p>Transformez sur le modèle donné.</p>
  <ul><li>Il est né en Algérie, il vit à Lyon. → C'est un Algérien qui habite à Lyon.</li><li>Elle est née au Sénégal, elle vit à Paris. → ?</li><li>Il est né au Maroc, il vit à Nice. → ?</li></ul>
</div>

<div>
  <p><strong>B1 — Discours rapporté simple (identité)</strong></p>
  <p>Complétez au discours rapporté.</p>
  <ul><li>Awa a dit qu'elle ________ (s'appeler) Awa Diallo et qu'elle ________ (vouloir) sa carte de séjour.</li></ul>
</div>

<div>
  <p><strong>B2 — Nominalisation droits/devoirs</strong></p>
  <p>Reformulez avec une nominalisation.</p>
  <ul><li>Vous pouvez demander l'accès aux soins. → Vous avez ___ à ___.</li></ul>
</div>

<div>
  <p><strong>B2 — Connecteurs argumentatifs (nuance)</strong></p>
  <p>Complétez avec un connecteur (cependant / par conséquent / en revanche).</p>
  <ul><li>Un parcours long permet d'apprendre en profondeur, ___ il demande de la disponibilité.</li></ul>
</div>
<h3>Ateliers différenciés — repères par niveau (60 min)</h3>
<p><strong>A1</strong> (45 min) — Grammaire du verbe être et des pronoms d'identité. Puis trois exercices : épeler un nom de famille à l'oral, lire une carte d'identité officielle, associer une question et sa réponse. Enfin, un exercice de compréhension sur le dialogue d'ouverture.</p>
<p><strong>A2</strong> (45 min) — Grammaire des adjectifs possessifs et de la présentation. Puis un texte à compléter et deux fiches à lire pour répondre à des questions. Enfin, un exercice sur l'objectif administratif d'Awa.</p>
<p><strong>B1</strong> (40 min) — Grammaire de la nationalité et du discours rapporté. Puis un exercice de lecture sur le parcours d'Awa, et un exercice d'association sur droit / devoir / règle.</p>
<p><strong>B2</strong> (40 min) — Grammaire de la nominalisation et des connecteurs. Puis un exercice de lecture argumentative sur l'organisation du parcours.</p>
<h3>Travail à la maison (Devoir)</h3>
<p><strong>A1 :</strong> À la maison : relisez la transcription et associez chaque mot du lexique à sa définition.</p>
<p><strong>A2 :</strong> À la maison : racontez par écrit (5 phrases) votre propre objectif administratif, sur le modèle d'Awa.</p>
<p><strong>B1 :</strong> À la maison : rédigez un court texte expliquant à un ami la différence entre droit, devoir et règle.</p>
<p><strong>B2 :</strong> À la maison : rédigez un paragraphe argumenté sur l'intérêt d'un parcours progressif de formation pour un adulte.</p>$doc$,
  'seance-1-v3-validation/S01_APP_CO_A2_fiche-activites',
  1
),
(
  'S01',
  'dialogue_transcription',
  $doc$Transcription Audio + 20 Questions — Séance S01 (v3)$doc$,
  'A1-B2 Invariant',
  ARRAY['CO','CE']::text[],
  'a_completer',
  $doc$<p><em>Awa Diallo, apprenante primo-arrivante, se présente le premier jour de sa formation. Elle explique à sa formatrice, Mme Rossi, son objectif administratif (la carte de séjour pluriannuelle) et découvre l'organisation du parcours.</em></p>
<p><strong>Mme Rossi :</strong> Bonjour, bienvenue dans votre nouveau parcours. Comment vous appelez-vous ?</p>
<p><strong>Awa :</strong> Bonjour madame. Je m'appelle Awa. Awa Diallo.</p>
<p><strong>Mme Rossi :</strong> Enchantée, Awa. Pouvez-vous épeler votre nom de famille, s'il vous plaît ?</p>
<p><strong>Awa :</strong> Oui, bien sûr : D-I-A-L-L-O.</p>
<p><strong>Mme Rossi :</strong> Merci. Quel est votre objectif aujourd'hui ?</p>
<p><strong>Awa :</strong> Je voudrais avoir ma carte de séjour pluriannuelle.</p>
<p><strong>Mme Rossi :</strong> Très bien. Pour ça, vous allez suivre un parcours de quatre-vingts heures.</p>
<p><strong>Awa :</strong> Quatre-vingts heures ? C'est beaucoup !</p>
<p><strong>Mme Rossi :</strong> Oui, mais c'est réparti sur vingt-cinq séances de trois heures, à raison d'une séance par semaine.</p>
<p><strong>Awa :</strong> D'accord. Et qu'est-ce qu'on va apprendre exactement ?</p>
<p><strong>Mme Rossi :</strong> Vous allez apprendre le français pour la vie quotidienne, et aussi cinq thèmes sur la vie en France : la République, les institutions, les droits et devoirs, l'histoire et la vie en société.</p>
<p><strong>Awa :</strong> Il y a un examen à la fin ?</p>
<p><strong>Mme Rossi :</strong> Il y a deux évaluations : une évaluation intermédiaire après cinquante heures, et une évaluation finale à la fin des quatre-vingts heures.</p>
<p><strong>Awa :</strong> Je comprends. Merci beaucoup madame.</p>
<p><strong>Mme Rossi :</strong> Une dernière chose : connaissez-vous la différence entre un droit, un devoir et une règle ?</p>
<p><strong>Awa :</strong> Pas très bien, madame.</p>
<p><strong>Mme Rossi :</strong> Un droit, c'est quelque chose que vous pouvez demander, comme le droit à la santé. Un devoir, c'est quelque chose que vous devez faire, comme respecter la loi. Une règle, c'est une consigne précise, par exemple arriver à l'heure en formation.</p>
<p><strong>Awa :</strong> D'accord, je comprends mieux maintenant.</p>
<p><strong>Mme Rossi :</strong> Parfait, nous allons travailler cela ensemble pendant toute la formation. Bienvenue parmi nous, Awa !</p>
<p><strong>Awa :</strong> Merci madame, je suis contente de commencer.</p>
<h3>Questions de compréhension (20 items)</h3>

<h4>Compréhension globale</h4>
<ol><li>Qui sont les deux personnes qui parlent ? <em>(niveaux : A1, A2, B1, B2)</em></li><li>À votre avis, à quel moment de la formation se passe cette scène ? <em>(niveaux : A1, A2, B1, B2)</em></li><li>Quel est l'objectif principal d'Awa ? <em>(niveaux : A1, A2, B1, B2)</em></li></ol>

<h4>Repérage d'information</h4>
<ol><li>Combien d'heures dure le parcours d'Awa ? <em>(niveaux : A1, A2, B1, B2)</em></li><li>Combien de séances va-t-elle suivre ? <em>(niveaux : A1, A2, B1, B2)</em></li><li>Combien de temps dure chaque séance ? <em>(niveaux : A1, A2, B1, B2)</em></li><li>À quel rythme ont lieu les séances ? <em>(niveaux : A1, A2, B1, B2)</em></li><li>Après combien d'heures a lieu la première évaluation (E1) ? <em>(niveaux : A1, A2, B1, B2)</em></li></ol>

<h4>Lexique</h4>
<ol><li>Que signifie le mot « parcours » dans le dialogue ? <em>(niveaux : A1, A2, B1, B2)</em></li><li>Que veut dire « épeler » son nom ? <em>(niveaux : A1, A2, B1, B2)</em></li></ol>

<h4>Vrai/Faux</h4>
<ol><li>Awa connaît déjà bien la différence entre droit, devoir et règle. <em>(niveaux : A1, A2, B1, B2)</em></li><li>Le parcours couvre cinq thèmes sur la vie en France. <em>(niveaux : A1, A2, B1, B2)</em></li><li>Il y a une seule évaluation à la fin du parcours. <em>(niveaux : A1, A2, B1, B2)</em></li></ol>

<h4>Reformulation</h4>
<ol><li>Reformulez avec vos mots ce qu'est un « droit » selon Mme Rossi. <em>(niveaux : A2, B1, B2)</em></li><li>Reformulez avec vos mots ce qu'est un « devoir » selon Mme Rossi. <em>(niveaux : A2, B1, B2)</em></li><li>Reformulez ce qu'est une « règle », avec l'exemple donné. <em>(niveaux : A2, B1, B2)</em></li></ol>

<h4>Justification</h4>
<ol><li>Pourquoi Mme Rossi demande-t-elle à Awa d'épeler son nom ? <em>(niveaux : A2, B1, B2)</em></li><li>À votre avis, pourquoi le parcours comprend-il deux évaluations plutôt qu'une seule ? <em>(niveaux : B1, B2)</em></li></ol>

<h4>Extension orale</h4>
<ol><li>À votre tour : présentez-vous comme Awa (nom, objectif administratif). <em>(niveaux : B1, B2)</em></li><li>Imaginez une question supplémentaire qu'Awa pourrait poser à Mme Rossi sur le parcours. <em>(niveaux : B1, B2)</em></li></ol>$doc$,
  'seance-1-v3-validation/S01_APP_CO_ALL_dialogue-transcription',
  1
),
(
  'S01',
  'qcm_tcf',
  $doc$Préparation TCF — 10 Questions Compréhension Orale (v3)$doc$,
  'A2 Cible',
  ARRAY['CO']::text[],
  'a_completer',
  $doc$<p>Écoutez attentivement le document sonore et cochez la case de l'option correcte sur votre grille de réponse.</p>

<div>
  <p><strong>Question 1 :</strong> Comment s'appelle l'apprenante du dialogue ?</p>
  <ul><li>A. Awa Diallo</li><li>B. Awa Rossi</li><li>C. Fatou Diallo</li><li>D. Awa Camara</li></ul>
</div>

<div>
  <p><strong>Question 2 :</strong> Quel est l'objectif administratif d'Awa ?</p>
  <ul><li>A. La carte de séjour pluriannuelle</li><li>B. La nationalité française</li><li>C. Un visa touristique</li><li>D. Un titre de travail</li></ul>
</div>

<div>
  <p><strong>Question 3 :</strong> Combien d'heures dure le parcours d'Awa ?</p>
  <ul><li>A. 50 heures</li><li>B. 80 heures</li><li>C. 100 heures</li><li>D. 120 heures</li></ul>
</div>

<div>
  <p><strong>Question 4 :</strong> Combien de séances collectives sont prévues ?</p>
  <ul><li>A. 18</li><li>B. 25</li><li>C. 31</li><li>D. 37</li></ul>
</div>

<div>
  <p><strong>Question 5 :</strong> Combien de temps dure chaque séance ?</p>
  <ul><li>A. 2 heures</li><li>B. 3 heures</li><li>C. 4 heures</li><li>D. 5 heures</li></ul>
</div>

<div>
  <p><strong>Question 6 :</strong> À quel rythme les séances ont-elles lieu ?</p>
  <ul><li>A. Une par semaine</li><li>B. Deux par semaine</li><li>C. Une par mois</li></ul>
</div>

<div>
  <p><strong>Question 7 :</strong> Après combien d'heures a lieu l'évaluation intermédiaire (E1) ?</p>
  <ul><li>A. 25 heures</li><li>B. 50 heures</li><li>C. 80 heures</li><li>D. 100 heures</li></ul>
</div>

<div>
  <p><strong>Question 8 :</strong> Combien de thèmes civiques structurent le parcours ?</p>
  <ul><li>A. Trois</li><li>B. Cinq</li><li>C. Sept</li><li>D. Dix</li></ul>
</div>

<div>
  <p><strong>Question 9 :</strong> D'après Mme Rossi, qu'est-ce qu'un « devoir » ?</p>
  <ul><li>A. Quelque chose qu'on peut demander</li><li>B. Quelque chose qu'on doit faire</li><li>C. Une consigne propre à un lieu</li><li>D. Une évaluation finale</li></ul>
</div>

<div>
  <p><strong>Question 10 :</strong> D'après Mme Rossi, qu'est-ce qu'une « règle » ?</p>
  <ul><li>A. Une consigne précise (ex. arriver à l'heure)</li><li>B. Une possibilité garantie par la loi</li><li>C. Une obligation nationale</li><li>D. Un examen final</li></ul>
</div>$doc$,
  'seance-1-v3-validation/S01_APP_QC_ALL_qcm-tcf',
  1
),
(
  'S01',
  'qcm_civique',
  $doc$Diagnostic Civique — 10 Questions (CSP) (v3)$doc$,
  'A1-B2',
  ARRAY['CIVIQUE']::text[],
  'a_completer',
  $doc$<p>Thème : Droits et devoirs | Mention officielle : CSP</p>

<div>
  <p><strong>1.</strong> Respecter le règlement intérieur d'un centre de formation est avant tout :</p>
  <ul><li>A. Un droit</li><li>B. Un devoir</li><li>C. Une démarche</li></ul>
</div>

<div>
  <p><strong>2.</strong> Le droit à la santé signifie que vous pouvez :</p>
  <ul><li>A. Demander l'accès aux soins</li><li>B. Être obligé de vous soigner</li><li>C. Payer une amende</li></ul>
</div>

<div>
  <p><strong>3.</strong> Un formateur demande à un apprenant d'arriver à l'heure à chaque séance. Il s'agit :</p>
  <ul><li>A. D'une règle du centre de formation</li><li>B. D'un droit de l'apprenant</li><li>C. D'une loi nationale</li></ul>
</div>

<div>
  <p><strong>4.</strong> Le parcours vers la carte de séjour pluriannuelle dure :</p>
  <ul><li>A. 50 heures</li><li>B. 80 heures</li><li>C. 120 heures</li></ul>
</div>

<div>
  <p><strong>5.</strong> Combien de thèmes civiques officiels structurent le parcours ?</p>
  <ul><li>A. Trois</li><li>B. Cinq</li><li>C. Sept</li></ul>
</div>

<div>
  <p><strong>6.</strong> Un devoir, c'est :</p>
  <ul><li>A. Une obligation à respecter</li><li>B. Un choix libre sans conséquence</li><li>C. Un avantage optionnel</li></ul>
</div>

<div>
  <p><strong>7.</strong> L'évaluation finale (E2) a lieu :</p>
  <ul><li>A. Après 25 heures</li><li>B. Après 50 heures</li><li>C. À la fin des 80 heures</li></ul>
</div>

<div>
  <p><strong>8.</strong> Pourquoi le parcours comprend-il une évaluation intermédiaire (E1) ?</p>
  <ul><li>A. Pour sanctionner les absences</li><li>B. Pour mesurer la progression à mi-parcours</li><li>C. Pour remplacer l'évaluation finale</li></ul>
</div>

<div>
  <p><strong>9.</strong> Une règle se distingue d'un devoir car :</p>
  <ul><li>A. Une règle est propre à un lieu précis, un devoir est une obligation plus générale</li><li>B. Une règle est facultative</li><li>C. Un devoir n'a aucune conséquence</li></ul>
</div>

<div>
  <p><strong>10.</strong> Combien d'évaluations rythment le parcours de 80 heures ?</p>
  <ul><li>A. Une seule</li><li>B. Deux (E1 et E2)</li><li>C. Quatre</li></ul>
</div>$doc$,
  'seance-1-v3-validation/S01_APP_QC_ALL_qcm-civique',
  1
),
(
  'S01',
  'corrige_formateur',
  $doc$Corrigé Formateur — Séance S01 (v3)$doc$,
  'A1-B2',
  ARRAY['CORRECTION']::text[],
  'a_completer',
  $doc$<h3>Corrigé QCM TCF (10 questions)</h3>
<ol>
<li>Comment s'appelle l'apprenante du dialogue ? → <strong>Awa Diallo</strong><br><em>Justification : Elle se présente : « Je m'appelle Awa. Awa Diallo. »</em></li>
<li>Quel est l'objectif administratif d'Awa ? → <strong>La carte de séjour pluriannuelle</strong><br><em>Justification : « Je voudrais avoir ma carte de séjour pluriannuelle. »</em></li>
<li>Combien d'heures dure le parcours d'Awa ? → <strong>80 heures</strong><br><em>Justification : « Vous allez suivre un parcours de quatre-vingts heures. »</em></li>
<li>Combien de séances collectives sont prévues ? → <strong>25</strong><br><em>Justification : « réparti sur vingt-cinq séances de trois heures »</em></li>
<li>Combien de temps dure chaque séance ? → <strong>3 heures</strong><br><em>Justification : « vingt-cinq séances de trois heures »</em></li>
<li>À quel rythme les séances ont-elles lieu ? → <strong>Une par semaine</strong><br><em>Justification : « à raison d'une séance par semaine »</em></li>
<li>Après combien d'heures a lieu l'évaluation intermédiaire (E1) ? → <strong>50 heures</strong><br><em>Justification : « une évaluation intermédiaire après cinquante heures »</em></li>
<li>Combien de thèmes civiques structurent le parcours ? → <strong>Cinq</strong><br><em>Justification : « cinq thèmes sur la vie en France »</em></li>
<li>D'après Mme Rossi, qu'est-ce qu'un « devoir » ? → <strong>Quelque chose qu'on doit faire</strong><br><em>Justification : « Un devoir, c'est quelque chose que vous devez faire, comme respecter la loi. »</em></li>
<li>D'après Mme Rossi, qu'est-ce qu'une « règle » ? → <strong>Une consigne précise (ex. arriver à l'heure)</strong><br><em>Justification : « Une règle, c'est une consigne précise, par exemple arriver à l'heure en formation. »</em></li>
</ol>
<h3>Corrigé QCM Civique</h3>
<ol>
<li>Respecter le règlement intérieur d'un centre de formation est avant tout : → <strong>Un devoir</strong><br><em>Justification : C'est une obligation à laquelle on doit se conformer pendant la formation, pas une simple option.</em></li>
<li>Le droit à la santé signifie que vous pouvez : → <strong>Demander l'accès aux soins</strong><br><em>Justification : Un droit est une possibilité que la loi garantit, comme demander à être soigné — ce n'est pas une obligation.</em></li>
<li>Un formateur demande à un apprenant d'arriver à l'heure à chaque séance. Il s'agit : → <strong>D'une règle du centre de formation</strong><br><em>Justification : Une règle est une consigne précise, propre à un lieu (ici le centre de formation), différente d'une loi nationale.</em></li>
<li>Le parcours vers la carte de séjour pluriannuelle dure : → <strong>80 heures</strong><br><em>Justification : Durée officielle du tronc commun A2/CSP telle que présentée à Awa dans le dialogue.</em></li>
<li>Combien de thèmes civiques officiels structurent le parcours ? → <strong>Cinq</strong><br><em>Justification : Les cinq thèmes sont représentés sur le support visuel de la séance (République, institutions, droits/devoirs, histoire, société).</em></li>
<li>Un devoir, c'est : → <strong>Une obligation à respecter</strong><br><em>Justification : Un devoir engage la personne à agir, contrairement à un simple choix.</em></li>
<li>L'évaluation finale (E2) a lieu : → <strong>À la fin des 80 heures</strong><br><em>Justification : E2 valide l'ensemble du tronc commun, donc à la fin du parcours complet.</em></li>
<li>Pourquoi le parcours comprend-il une évaluation intermédiaire (E1) ? → <strong>Pour mesurer la progression à mi-parcours</strong><br><em>Justification : E1 permet d'ajuster la suite de la formation selon les besoins de l'apprenant.</em></li>
<li>Une règle se distingue d'un devoir car : → <strong>Une règle est propre à un lieu précis, un devoir est une obligation plus générale</strong><br><em>Justification : Ex. « arriver à l'heure » est une règle du centre ; « respecter la loi » est un devoir général.</em></li>
<li>Combien d'évaluations rythment le parcours de 80 heures ? → <strong>Deux (E1 et E2)</strong><br><em>Justification : Le dialogue mentionne explicitement deux évaluations distinctes.</em></li>
</ol>$doc$,
  'seance-1-v3-validation/S01_COR_ALL_corrige-formateur',
  1
),
(
  'S01',
  'lexique',
  $doc$Glossaire + 3 Exercices — Lexique S01 (v3)$doc$,
  'A1-B2',
  ARRAY['LEXIQUE']::text[],
  'a_completer',
  $doc$<table>
<thead><tr><th>Mot</th><th>Définition</th><th>Exemple</th></tr></thead>
<tbody>
<tr><td>parcours</td><td>Ensemble des séances à suivre pour atteindre un objectif.</td><td><em>Awa suit un parcours de 80 heures.</em></td></tr>
<tr><td>niveau</td><td>Le degré de connaissance d'une langue (A1, A2, B1, B2).</td><td><em>Son niveau de français progresse.</em></td></tr>
<tr><td>objectif</td><td>Le but que l'on veut atteindre.</td><td><em>Son objectif est d'avoir sa carte de séjour.</em></td></tr>
<tr><td>démarche</td><td>Une action pour obtenir un document ou un droit.</td><td><em>Elle fait une démarche à la préfecture.</em></td></tr>
<tr><td>droit</td><td>Quelque chose qu'on peut demander, garanti par la loi.</td><td><em>Le droit à la santé permet de se soigner.</em></td></tr>
<tr><td>devoir</td><td>Une obligation, quelque chose qu'on doit faire.</td><td><em>Respecter la loi est un devoir.</em></td></tr>
<tr><td>République</td><td>La forme de gouvernement de la France.</td><td><em>La République française a une devise.</em></td></tr>
<tr><td>examen</td><td>Une épreuve qui évalue les connaissances.</td><td><em>L'examen final a lieu après 80 heures.</em></td></tr>
<tr><td>séance</td><td>Une réunion de formation à une date précise.</td><td><em>Chaque séance dure 3 heures.</em></td></tr>
<tr><td>progresser</td><td>Avancer, s'améliorer petit à petit.</td><td><em>Elle progresse en français chaque semaine.</em></td></tr>
</tbody>
</table>
<h3>Exercices de réemploi</h3>
<p><strong>Exercice 1 — Association :</strong> Associez chaque mot à sa définition simplifiée.</p>
<p><strong>Exercice 2 — Phrase à compléter :</strong> Complétez le texte avec les mots manquants.</p>
<p><strong>Exercice 3 — Réemploi oral :</strong> En une phrase, expliquez pourquoi vous suivez ce parcours, en utilisant le mot « objectif » ou « démarche ».</p>$doc$,
  'seance-1-v3-validation/S01_APP_LX_ALL_lexique',
  1
),
(
  'S01',
  'support_visuel',
  $doc$Fiche Activité — Exploitation du Support Visuel (v3)$doc$,
  'A1-B2',
  ARRAY['CIVIQUE']::text[],
  'a_completer',
  $doc$<p>Observez attentivement le schéma (fichier PDF/DOCX joint), puis répondez aux questions.</p>
<p><strong>Figure :</strong> Cinq thèmes civiques du parcours CapTCF</p>
<h3>Questions d'observation (5 questions)</h3>
<ol><li>Combien de thèmes sont représentés sur le schéma ?</li><li>Nommez les cinq thèmes dans l'ordre, de gauche à droite.</li><li>Quel thème correspond au panneau de couleur rouge clair ?</li><li>Pourquoi ces cinq thèmes sont-ils réunis sur un même schéma, selon vous ?</li><li>Lequel de ces cinq thèmes vous semble le plus utile pour votre vie quotidienne en France ? Justifiez votre réponse en une phrase.</li></ol>$doc$,
  'seance-1-v3-validation/S01_APP_VI_ALL_support-visuel',
  1
),
(
  'S01',
  'document_transforme',
  $doc$Notice d'Accueil — Structure du Parcours d'Intégration$doc$,
  'A1-B2 Invariant',
  ARRAY['LECTURE']::text[],
  'a_completer',
  $doc$<p>Ce document est un extrait de la notice officielle d'accueil, restructuré selon la charte d'impression CapTCF pour une lisibilité maximale.</p>
<h3>1. Bienvenue dans votre parcours d'intégration</h3>
<p>Chaque primo-arrivant signataire du contrat d'intégration républicaine s'engage dans un parcours de formation linguistique et civique de 80 heures (réparties sur 25 séances de trois heures).</p>
<h3>2. Les Objectifs d'Apprentissage</h3>
<p>La formation vise l'acquisition de repères sur la société française à travers cinq thèmes civiques :</p>
<ul>
<li>Principes et valeurs de la République</li><li>Système institutionnel et politique</li>
<li>Droits et devoirs en France</li><li>Histoire, géographie et culture</li>
<li>Vie en société et démarches quotidiennes</li>
</ul>
<h3>3. Présence et Assiduité</h3>
<p>La présence à chaque séance est obligatoire et contrôlée par émargement. Deux évaluations nationales hors séances mesurent vos progrès : l'évaluation intermédiaire et l'évaluation finale.</p>$doc$,
  'seance-1-v3-validation/S01_APP_CV_ALL_document-transforme',
  1
)
ON CONFLICT (session_code, document_type, version) DO NOTHING;

COMMIT;

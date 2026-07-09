-- ============================================================
-- CapTCF — Lot 7 : recalibrage pédagogique dense S02-S05
-- ("v3 socle à compléter"), sur le modèle S01 v3. UPDATE
-- uniquement (les 36 lignes existent déjà, seedées au Lot 6).
-- status reste 'a_completer' partout (non modifié ici).
-- Sources : docs/plan-maitre-cursor-formation-80-100-120-v2.md,
-- docs/plan-formation-80-100-120-civique-v1.md.
-- ============================================================

BEGIN;

UPDATE public.session_documents SET content_html = $doc$<p><strong>Guide pédagogique — v3 socle à compléter.</strong> Karim Benslimane, primo-arrivant, se rend à l'accueil de la mairie pour demander un extrait d'acte de naissance et découvre au passage les symboles de la République affichés dans le hall.</p>
<h3>Objectifs opérationnels</h3>
<ul>
<li>Comprendre la situation invariante de la séance (CE/EE/CIVIQUE).</li>
<li>Mobiliser le lexique et les structures nécessaires à la situation.</li>
<li>Distinguer les repères civiques du thème « Principes et valeurs de la République ».</li>
</ul>
<h3>Déroulé détaillé (180 minutes)</h3>
<ol>
<li><strong>Rituel civique</strong> (10 min) — Observation du support visuel (drapeau, Marianne, devise) : « Que représente chaque symbole ? » Pas de notation.</li>
<li><strong>Activation + lexique</strong> (20 min) — Lecture des 10 mots clés (nom, prénom, mairie, devise...), puis 3 exercices lexicaux (association, texte à trous, réemploi oral).</li>
<li><strong>Support invariant CE/EE (50 min)</strong> (50 min) — 1ère lecture du dialogue mairie sans transcription → 2ème lecture ciblée (repérage des informations d'état civil) → 3ème lecture avec transcription → exploitation écrite (8 questions).</li>
<li><strong>Ateliers différenciés</strong> (60 min) — 4 groupes A1/A2/B1/B2 : formulaire d'état civil gradué + symboles de la République, cf. tableau ci-dessous.</li>
<li><strong>Production EE/EO</strong> (30 min) — EE (20 min) : compléter un formulaire de mairie + rédiger une demande écrite. EO (10 min) : jeu de rôle accueil de mairie en binôme.</li>
<li><strong>Fixation</strong> (10 min) — QCM civique 8 questions sur les symboles de la République, correction flash collective.</li>
</ol>
<h3>Ateliers différenciés — détail par niveau</h3>
<table><thead><tr><th>Niveau</th><th>Contenu</th></tr></thead><tbody>
<tr><td><strong>A1</strong></td><td>Repérer les mots clés du formulaire d'état civil (nom, prénom, date de naissance) sur un modèle simplifié ; épeler son propre nom à l'oral avec l'alphabet français.</td></tr>
<tr><td><strong>A2</strong></td><td>Compléter un formulaire d'état civil complet à partir d'une carte d'identité fictive ; associer chaque symbole de la République (drapeau, Marianne, devise, hymne) à sa description.</td></tr>
<tr><td><strong>B1</strong></td><td>Rédiger une demande écrite polie à une mairie (extrait d'acte, changement d'adresse) en respectant les formules de politesse administratives.</td></tr>
<tr><td><strong>B2</strong></td><td>Comparer la devise « Liberté, Égalité, Fraternité » à un principe équivalent dans le pays d'origine de l'apprenant, à l'oral, avec justification argumentée.</td></tr>
</tbody></table>
<h3>Note de statut</h3>
<p><em>Socle à compléter : ce déroulé est une base réaliste (180 min réparties en 6 phases), pas une version finalisée. Le formateur peut l'ajuster directement ici.</em></p>$doc$ WHERE session_code = 'S02' AND document_type = 'fiche_formateur';

UPDATE public.session_documents SET content_html = $doc$<p>Travaillez les activités correspondant à votre niveau. Le formateur passera vous aider.</p>
<h3>Situation de la séance</h3>
<p>Karim Benslimane, primo-arrivant, se rend à l'accueil de la mairie pour demander un extrait d'acte de naissance et découvre au passage les symboles de la République affichés dans le hall.</p>
<h3>Lexique clé (à connaître avant l'activité)</h3>
<ul><li>nom</li><li>prénom</li><li>naissance</li><li>nationalité</li><li>adresse</li></ul>
<p><em>Liste complète des 10 mots dans la fiche Lexique.</em></p>
<h3>Ateliers différenciés — repères par niveau</h3>
<table><thead><tr><th>Niveau</th><th>Activité</th></tr></thead><tbody>
<tr><td><strong>A1</strong></td><td style="font-size:9pt;">Repérer les mots clés du formulaire d'état civil (nom, prénom, date de naissance) sur un modèle simplifié ; épeler son propre nom à l'oral avec l'alphabet français.</td></tr>
<tr><td><strong>A2</strong></td><td style="font-size:9pt;">Compléter un formulaire d'état civil complet à partir d'une carte d'identité fictive ; associer chaque symbole de la République (drapeau, Marianne, devise, hymne) à sa description.</td></tr>
<tr><td><strong>B1</strong></td><td style="font-size:9pt;">Rédiger une demande écrite polie à une mairie (extrait d'acte, changement d'adresse) en respectant les formules de politesse administratives.</td></tr>
<tr><td><strong>B2</strong></td><td style="font-size:9pt;">Comparer la devise « Liberté, Égalité, Fraternité » à un principe équivalent dans le pays d'origine de l'apprenant, à l'oral, avec justification argumentée.</td></tr>
</tbody></table>
<h3>Note de statut</h3>
<p><em>Socle à compléter : cette fiche pose la structure de l'activité, à enrichir avec des exercices écrits complets.</em></p>$doc$ WHERE session_code = 'S02' AND document_type = 'fiche_apprenant';

UPDATE public.session_documents SET content_html = $doc$<p><em>Karim Benslimane, primo-arrivant, se rend à l'accueil de la mairie pour demander un extrait d'acte de naissance et découvre au passage les symboles de la République affichés dans le hall.</em></p>
<p><strong>Mme Lambert :</strong> Bonjour, vous désirez ?</p>
<p><strong>Karim :</strong> Bonjour madame. Je voudrais un extrait d'acte de naissance, s'il vous plaît.</p>
<p><strong>Mme Lambert :</strong> Très bien. Vous avez une pièce d'identité ?</p>
<p><strong>Karim :</strong> Oui, voici mon passeport.</p>
<p><strong>Mme Lambert :</strong> Merci. Quel est votre nom de naissance ?</p>
<p><strong>Karim :</strong> Benslimane. B-E-N-S-L-I-M-A-N-E.</p>
<p><strong>Mme Lambert :</strong> Et votre prénom, votre date et votre lieu de naissance ?</p>
<p><strong>Karim :</strong> Karim, né le 14 mars 1990 à Casablanca.</p>
<p><strong>Mme Lambert :</strong> Merci. Je dois aussi vérifier votre adresse actuelle.</p>
<p><strong>Karim :</strong> J'habite au 8 rue des Lilas, à Nantes, depuis six mois.</p>
<p><strong>Mme Lambert :</strong> Parfait. L'extrait sera prêt sous cinq jours ouvrés. Vous pouvez venir le récupérer ou je vous l'envoie par courrier.</p>
<p><strong>Karim :</strong> Je viendrai le chercher, merci. Une question : la mairie est ouverte le samedi ?</p>
<p><strong>Mme Lambert :</strong> Oui, le samedi matin de neuf heures à midi, sauf pendant les vacances scolaires.</p>
<p><strong>Karim :</strong> Très bien. J'ai remarqué la devise sur le fronton du bâtiment : « Liberté, Égalité, Fraternité ». Elle est écrite dans toutes les mairies ?</p>
<p><strong>Mme Lambert :</strong> Oui, c'est la devise de la République française. Elle est obligatoire sur tous les bâtiments publics, avec le drapeau tricolore.</p>
<p><strong>Karim :</strong> Et le buste de femme dans le hall d'entrée, qui est-ce ?</p>
<p><strong>Mme Lambert :</strong> C'est Marianne, le symbole de la République. On la retrouve dans toutes les mairies de France.</p>
<p><strong>Karim :</strong> L'hymne national, c'est bien la Marseillaise ?</p>
<p><strong>Mme Lambert :</strong> Exactement. Elle est jouée lors des cérémonies officielles, comme le 14 juillet, notre fête nationale.</p>
<p><strong>Karim :</strong> Merci pour toutes ces explications, madame, c'est très utile.</p>
<p><strong>Mme Lambert :</strong> Avec plaisir. Voici une brochure sur les symboles de la République si vous voulez approfondir chez vous.</p>
<p><strong>Karim :</strong> Parfait, merci beaucoup madame.</p>
<h3>Questions de compréhension</h3>
<ol><li>Quel document Karim demande-t-il à la mairie ?</li><li>Quelle pièce d'identité Karim présente-t-il ?</li><li>Comment Karim épelle-t-il son nom de famille ?</li><li>Quelle est la date de naissance de Karim ?</li><li>Où habite Karim depuis six mois ?</li><li>Sous combien de temps l'extrait sera-t-il prêt ?</li><li>Quand la mairie est-elle ouverte le samedi ?</li><li>Que remet Mme Lambert à Karim à la fin de l'échange ?</li></ol>
<p style="font-size:8pt;color:#94a3b8;">Estimation : 304 mots (~152 s à un débit A2 naturel).</p>$doc$ WHERE session_code = 'S02' AND document_type = 'dialogue_transcription';

UPDATE public.session_documents SET content_html = $doc$<p>10 questions de type TCF sur le dialogue invariant. Choisissez la bonne réponse pour chaque question.</p>

<div>
<p><strong>Question 1 :</strong> Quel document Karim demande-t-il à la mairie ?</p>
<ul><li>A. Un extrait d'acte de naissance</li><li>B. Une carte d'identité</li><li>C. Un passeport</li></ul>
</div>

<div>
<p><strong>Question 2 :</strong> Quelle pièce d'identité Karim présente-t-il ?</p>
<ul><li>A. Son passeport</li><li>B. Sa carte de séjour</li><li>C. Son permis de conduire</li></ul>
</div>

<div>
<p><strong>Question 3 :</strong> Comment Karim épelle-t-il son nom de famille ?</p>
<ul><li>A. B-E-N-S-L-I-M-A-N-E</li><li>B. B-E-N-S-L-A-M-A-N-E</li><li>C. B-E-N-S-L-I-M-A-N</li></ul>
</div>

<div>
<p><strong>Question 4 :</strong> Quelle est la date de naissance de Karim ?</p>
<ul><li>A. Le 14 mars 1990</li><li>B. Le 4 mars 1990</li><li>C. Le 14 mai 1990</li></ul>
</div>

<div>
<p><strong>Question 5 :</strong> Où habite Karim depuis six mois ?</p>
<ul><li>A. 8 rue des Lilas, à Nantes</li><li>B. 8 rue des Lilas, à Rennes</li><li>C. 18 rue des Lilas, à Nantes</li></ul>
</div>

<div>
<p><strong>Question 6 :</strong> Sous combien de temps l'extrait sera-t-il prêt ?</p>
<ul><li>A. Cinq jours ouvrés</li><li>B. Deux jours</li><li>C. Un mois</li></ul>
</div>

<div>
<p><strong>Question 7 :</strong> Quand la mairie est-elle ouverte le samedi ?</p>
<ul><li>A. De 9h à midi, sauf vacances scolaires</li><li>B. Toute la journée</li><li>C. Elle est fermée le samedi</li></ul>
</div>

<div>
<p><strong>Question 8 :</strong> Que remet Mme Lambert à Karim à la fin de l'échange ?</p>
<ul><li>A. Une brochure sur les symboles de la République</li><li>B. Un formulaire de changement d'adresse</li><li>C. Une convocation</li></ul>
</div>$doc$ WHERE session_code = 'S02' AND document_type = 'qcm_tcf';

UPDATE public.session_documents SET content_html = $doc$<p>Thème : Principes et valeurs de la République | Mention : CSP</p>

<div>
<p><strong>1.</strong> Quelle est la devise de la République française ?</p>
<ul><li>A. Liberté, Égalité, Fraternité</li><li>B. Unité, Travail, Progrès</li><li>C. Paix, Justice, Liberté</li></ul>
</div>

<div>
<p><strong>2.</strong> Qui est Marianne ?</p>
<ul><li>A. Le symbole de la République française</li><li>B. Une ancienne présidente de la République</li><li>C. La patronne des mairies</li></ul>
</div>

<div>
<p><strong>3.</strong> Quel est l'hymne national français ?</p>
<ul><li>A. La Marseillaise</li><li>B. Le Chant du Départ</li><li>C. La Carmagnole</li></ul>
</div>

<div>
<p><strong>4.</strong> Quelle est la date de la fête nationale française ?</p>
<ul><li>A. Le 14 juillet</li><li>B. Le 1er mai</li><li>C. Le 11 novembre</li></ul>
</div>

<div>
<p><strong>5.</strong> Quelle est la langue officielle de la République française ?</p>
<ul><li>A. Le français</li><li>B. Le français et l'anglais</li><li>C. Il n'y a pas de langue officielle</li></ul>
</div>

<div>
<p><strong>6.</strong> Quelles sont les couleurs du drapeau français ?</p>
<ul><li>A. Bleu, blanc, rouge</li><li>B. Bleu, blanc, vert</li><li>C. Rouge, blanc, noir</li></ul>
</div>

<div>
<p><strong>7.</strong> Où doit-on obligatoirement afficher la devise de la République ?</p>
<ul><li>A. Sur les bâtiments publics</li><li>B. Uniquement dans les écoles</li><li>C. Uniquement dans les préfectures</li></ul>
</div>

<div>
<p><strong>8.</strong> Que signifie le mot « Fraternité » dans la devise républicaine ?</p>
<ul><li>A. La solidarité et l'entraide entre tous les citoyens</li><li>B. L'obligation de vote</li><li>C. Le droit à la propriété</li></ul>
</div>
<p style="font-size:8pt;font-style:italic;color:#64748b;">Simulation pédagogique CapTCF. Les questions présentées ne préjugent pas des questions officielles de l'examen d'État.</p>$doc$ WHERE session_code = 'S02' AND document_type = 'qcm_civique';

UPDATE public.session_documents SET content_html = $doc$<h3>Corrigé QCM TCF</h3>
<ol>
<li>Quel document Karim demande-t-il à la mairie ? → <strong>Un extrait d'acte de naissance</strong><br><em>Justification : Karim dit dès le début : « Je voudrais un extrait d'acte de naissance, s'il vous plaît. »</em></li>
<li>Quelle pièce d'identité Karim présente-t-il ? → <strong>Son passeport</strong><br><em>Justification : Il répond « Oui, voici mon passeport » à la question de Mme Lambert.</em></li>
<li>Comment Karim épelle-t-il son nom de famille ? → <strong>B-E-N-S-L-I-M-A-N-E</strong><br><em>Justification : Karim épelle exactement « Benslimane. B-E-N-S-L-I-M-A-N-E. »</em></li>
<li>Quelle est la date de naissance de Karim ? → <strong>Le 14 mars 1990</strong><br><em>Justification : Karim précise « né le 14 mars 1990 à Casablanca. »</em></li>
<li>Où habite Karim depuis six mois ? → <strong>8 rue des Lilas, à Nantes</strong><br><em>Justification : Il déclare : « J'habite au 8 rue des Lilas, à Nantes, depuis six mois. »</em></li>
<li>Sous combien de temps l'extrait sera-t-il prêt ? → <strong>Cinq jours ouvrés</strong><br><em>Justification : Mme Lambert annonce : « L'extrait sera prêt sous cinq jours ouvrés. »</em></li>
<li>Quand la mairie est-elle ouverte le samedi ? → <strong>De 9h à midi, sauf vacances scolaires</strong><br><em>Justification : Mme Lambert précise : « le samedi matin de neuf heures à midi, sauf pendant les vacances scolaires. »</em></li>
<li>Que remet Mme Lambert à Karim à la fin de l'échange ? → <strong>Une brochure sur les symboles de la République</strong><br><em>Justification : Elle propose : « Voici une brochure sur les symboles de la République si vous voulez approfondir chez vous. »</em></li>
</ol>
<h3>Corrigé QCM Civique</h3>
<ol>
<li>Quelle est la devise de la République française ? → <strong>Liberté, Égalité, Fraternité</strong><br><em>Justification : Cette devise, citée dans le dialogue, est inscrite sur le fronton de tous les bâtiments publics français, dont les mairies.</em></li>
<li>Qui est Marianne ? → <strong>Le symbole de la République française</strong><br><em>Justification : Marianne est une figure allégorique représentant la République ; son buste est présent dans chaque mairie de France, comme le remarque Karim.</em></li>
<li>Quel est l'hymne national français ? → <strong>La Marseillaise</strong><br><em>Justification : La Marseillaise est l'hymne national depuis 1795 ; elle est jouée lors des cérémonies officielles, notamment le 14 juillet.</em></li>
<li>Quelle est la date de la fête nationale française ? → <strong>Le 14 juillet</strong><br><em>Justification : Le 14 juillet commémore la prise de la Bastille (1789) et la Fête de la Fédération (1790) ; la Marseillaise y est jouée lors des cérémonies officielles.</em></li>
<li>Quelle est la langue officielle de la République française ? → <strong>Le français</strong><br><em>Justification : Depuis la révision constitutionnelle de 1992 (article 2 de la Constitution), le français est la seule langue officielle de la République.</em></li>
<li>Quelles sont les couleurs du drapeau français ? → <strong>Bleu, blanc, rouge</strong><br><em>Justification : Le drapeau tricolore bleu-blanc-rouge est affiché obligatoirement, avec la devise, sur tous les bâtiments publics comme la mairie.</em></li>
<li>Où doit-on obligatoirement afficher la devise de la République ? → <strong>Sur les bâtiments publics</strong><br><em>Justification : Mme Lambert le confirme explicitement : la devise « est obligatoire sur tous les bâtiments publics ».</em></li>
<li>Que signifie le mot « Fraternité » dans la devise républicaine ? → <strong>La solidarité et l'entraide entre tous les citoyens</strong><br><em>Justification : La Fraternité désigne le lien de solidarité qui unit les citoyens au-delà de leurs différences, complément de la Liberté et de l'Égalité.</em></li>
</ol>
<h3>Grille d'évaluation</h3>
<p style="font-size:9pt;color:#475569;">A1/A2 : tolérer les fautes de grammaire si le sens communicatif est préservé. B1/B2 : attendre une structure textuelle fluide et une argumentation développée.</p>$doc$ WHERE session_code = 'S02' AND document_type = 'corrige_formateur';

UPDATE public.session_documents SET content_html = $doc$<table><thead><tr><th>Mot</th><th>Définition simplifiée</th><th>Exemple</th></tr></thead><tbody>
<tr><td><strong>nom</strong></td><td>Le nom de famille, transmis à la naissance.</td><td><em>« Mon nom de famille est Benslimane. »</em></td></tr>
<tr><td><strong>prénom</strong></td><td>Le ou les prénoms qui précèdent le nom de famille.</td><td><em>« Mon prénom est Karim. »</em></td></tr>
<tr><td><strong>naissance</strong></td><td>Le moment où une personne vient au monde.</td><td><em>« Je suis né le 14 mars 1990. »</em></td></tr>
<tr><td><strong>nationalité</strong></td><td>Le pays dont une personne est citoyenne.</td><td><em>« Ma nationalité est marocaine. »</em></td></tr>
<tr><td><strong>adresse</strong></td><td>Le lieu où l'on habite, avec numéro et rue.</td><td><em>« Mon adresse est 8 rue des Lilas. »</em></td></tr>
<tr><td><strong>mairie</strong></td><td>Le bâtiment administratif d'une commune.</td><td><em>« Je vais à la mairie pour un document. »</em></td></tr>
<tr><td><strong>devise</strong></td><td>Une formule qui résume les valeurs d'un pays.</td><td><em>« La devise de la France est « Liberté, Égalité, Fraternité ». »</em></td></tr>
<tr><td><strong>drapeau</strong></td><td>Un tissu de couleurs qui représente un pays.</td><td><em>« Le drapeau français est bleu, blanc, rouge. »</em></td></tr>
<tr><td><strong>hymne</strong></td><td>Le chant officiel d'un pays.</td><td><em>« L'hymne national français est la Marseillaise. »</em></td></tr>
<tr><td><strong>Marianne</strong></td><td>Le buste qui symbolise la République française.</td><td><em>« Marianne est présente dans toutes les mairies. »</em></td></tr>
</tbody></table>$doc$ WHERE session_code = 'S02' AND document_type = 'lexique';

UPDATE public.session_documents SET content_html = $doc$<p>Schéma des symboles de la République présents dans le hall d'une mairie : le drapeau tricolore, le buste de Marianne, la devise « Liberté, Égalité, Fraternité » et une partition de la Marseillaise, chacun légendé simplement.</p>
<h3>Questions d'observation</h3>
<ol>
<li>Que représente chaque élément du schéma ?</li>
<li>Quel élément est directement lié à la situation du dialogue ?</li>
<li>Pourquoi ce thème est-il important dans la vie quotidienne en France ?</li>
</ol>
<p><em>Socle à compléter : l'illustration SVG définitive reste à produire ; ce texte décrit la scène cible.</em></p>$doc$ WHERE session_code = 'S02' AND document_type = 'support_visuel';

UPDATE public.session_documents SET content_html = $doc$<h3>Extrait de formulaire d'état civil (modèle pédagogique)</h3>
<p>Ce document est un modèle pédagogique de formulaire de demande d'extrait d'acte de naissance, restructuré selon la charte CapTCF. Il ne remplace aucun document officiel.</p>
<h3>1. Renseignements sur le demandeur</h3>
<p>Nom de naissance : ……………………… Prénom(s) : ………………………<br>Date de naissance : …… / …… / …… Lieu de naissance : ………………………</p>
<h3>2. Adresse actuelle</h3>
<p>Numéro et rue : ……………………… Commune : ……………………… Code postal : ………</p>
<h3>3. Motif de la demande</h3>
<p>☐ Extrait simple ☐ Extrait avec filiation ☐ Copie intégrale</p>
<p style="background-color:#fffbeb;border-left:3px solid #f59e0b;padding:10px;border-radius:4px;">Document fictif à usage pédagogique uniquement — modèle CapTCF, aucune valeur administrative.</p>$doc$ WHERE session_code = 'S02' AND document_type = 'document_transforme';

UPDATE public.session_documents SET content_html = $doc$<p><strong>Guide pédagogique — v3 socle à compléter.</strong> Deux situations de santé pour Aïcha : un appel au SAMU pour son fils blessé (urgence), puis une prise de rendez-vous chez son médecin traitant pour un mal de gorge (situation non urgente).</p>
<h3>Objectifs opérationnels</h3>
<ul>
<li>Comprendre la situation invariante de la séance (CO/EO/CIVIQUE).</li>
<li>Mobiliser le lexique et les structures nécessaires à la situation.</li>
<li>Distinguer les repères civiques du thème « Vivre dans la société française ».</li>
</ul>
<h3>Déroulé détaillé (180 minutes)</h3>
<ol>
<li><strong>Rituel civique</strong> (10 min) — Observation du support visuel (numéros utiles : 15, 17, 18, pharmacie de garde) : « Quel numéro pour quelle situation ? » Pas de notation.</li>
<li><strong>Activation + lexique</strong> (20 min) — Lecture des 10 mots clés de santé, puis 3 exercices lexicaux (association symptôme/partie du corps, texte à trous, réemploi oral).</li>
<li><strong>Support invariant CO (50 min)</strong> (50 min) — 1ère écoute globale sans transcription (scène 1 et 2) → 2ème écoute ciblée (repérage des informations) → 3ème écoute avec transcription → exploitation écrite (8 questions).</li>
<li><strong>Ateliers différenciés</strong> (60 min) — 4 groupes A1/A2/B1/B2 : distinction urgence/non-urgence graduée, cf. tableau ci-dessous.</li>
<li><strong>Production EO/EE</strong> (30 min) — EO (20 min) : jeu de rôle appel au SAMU ou prise de rendez-vous en binôme. EE (10 min) : rédiger un message de symptômes.</li>
<li><strong>Fixation</strong> (10 min) — QCM civique 8 questions sur l'accès aux soins, correction flash collective.</li>
</ol>
<h3>Ateliers différenciés — détail par niveau</h3>
<table><thead><tr><th>Niveau</th><th>Contenu</th></tr></thead><tbody>
<tr><td><strong>A1</strong></td><td>Associer des pictogrammes de symptômes (mal de tête, fièvre, blessure) à leur nom ; répéter la phrase « J'ai mal à… » avec des parties du corps illustrées.</td></tr>
<tr><td><strong>A2</strong></td><td>Compléter un dialogue de prise de rendez-vous médical à trous ; distinguer sur des exemples une situation urgente d'une situation non urgente.</td></tr>
<tr><td><strong>B1</strong></td><td>Rédiger un message décrivant précisément des symptômes pour un médecin (SMS ou message vocal transcrit).</td></tr>
<tr><td><strong>B2</strong></td><td>Débattre à l'oral : pourquoi limiter l'appel au SAMU aux situations réellement vitales ? Argumenter avec des exemples du dialogue.</td></tr>
</tbody></table>
<h3>Note de statut</h3>
<p><em>Socle à compléter : ce déroulé est une base réaliste (180 min réparties en 6 phases), pas une version finalisée. Le formateur peut l'ajuster directement ici.</em></p>$doc$ WHERE session_code = 'S03' AND document_type = 'fiche_formateur';

UPDATE public.session_documents SET content_html = $doc$<p>Travaillez les activités correspondant à votre niveau. Le formateur passera vous aider.</p>
<h3>Situation de la séance</h3>
<p>Deux situations de santé pour Aïcha : un appel au SAMU pour son fils blessé (urgence), puis une prise de rendez-vous chez son médecin traitant pour un mal de gorge (situation non urgente).</p>
<h3>Lexique clé (à connaître avant l'activité)</h3>
<ul><li>symptôme</li><li>douleur</li><li>urgence</li><li>médecin traitant</li><li>rendez-vous</li></ul>
<p><em>Liste complète des 10 mots dans la fiche Lexique.</em></p>
<h3>Ateliers différenciés — repères par niveau</h3>
<table><thead><tr><th>Niveau</th><th>Activité</th></tr></thead><tbody>
<tr><td><strong>A1</strong></td><td style="font-size:9pt;">Associer des pictogrammes de symptômes (mal de tête, fièvre, blessure) à leur nom ; répéter la phrase « J'ai mal à… » avec des parties du corps illustrées.</td></tr>
<tr><td><strong>A2</strong></td><td style="font-size:9pt;">Compléter un dialogue de prise de rendez-vous médical à trous ; distinguer sur des exemples une situation urgente d'une situation non urgente.</td></tr>
<tr><td><strong>B1</strong></td><td style="font-size:9pt;">Rédiger un message décrivant précisément des symptômes pour un médecin (SMS ou message vocal transcrit).</td></tr>
<tr><td><strong>B2</strong></td><td style="font-size:9pt;">Débattre à l'oral : pourquoi limiter l'appel au SAMU aux situations réellement vitales ? Argumenter avec des exemples du dialogue.</td></tr>
</tbody></table>
<h3>Note de statut</h3>
<p><em>Socle à compléter : cette fiche pose la structure de l'activité, à enrichir avec des exercices écrits complets.</em></p>$doc$ WHERE session_code = 'S03' AND document_type = 'fiche_apprenant';

UPDATE public.session_documents SET content_html = $doc$<p><em>Deux situations de santé pour Aïcha : un appel au SAMU pour son fils blessé (urgence), puis une prise de rendez-vous chez son médecin traitant pour un mal de gorge (situation non urgente).</em></p>
<p><strong>Standardiste SAMU :</strong> SAMU, j'écoute.</p>
<p><strong>Aïcha :</strong> Bonjour, mon fils est tombé, il ne bouge plus le bras et il a très mal !</p>
<p><strong>Standardiste SAMU :</strong> Quel âge a-t-il ?</p>
<p><strong>Aïcha :</strong> Il a huit ans.</p>
<p><strong>Standardiste SAMU :</strong> Où êtes-vous exactement ?</p>
<p><strong>Aïcha :</strong> Au parc Delacroix, rue des Peupliers.</p>
<p><strong>Standardiste SAMU :</strong> Restez calme, ne le déplacez pas. J'envoie une ambulance immédiatement. Est-ce qu'il saigne ?</p>
<p><strong>Aïcha :</strong> Non, il ne saigne pas, mais il pleure beaucoup et il dit que son bras lui fait très mal.</p>
<p><strong>Standardiste SAMU :</strong> Très bien, l'ambulance arrive dans cinq minutes. Restez en ligne avec moi et parlez-lui calmement pour le rassurer en attendant.</p>
<p><strong>Aïcha :</strong> D'accord, je reste avec lui. Merci.</p>
<p><strong>Standardiste SAMU :</strong> L'ambulance est arrivée. Les secouristes s'occupent de votre fils, vous pouvez raccrocher. Bon courage.</p>
<p><strong>Secrétaire médicale :</strong> Cabinet du docteur Fabre, bonjour.</p>
<p><strong>Aïcha :</strong> Bonjour, je voudrais un rendez-vous, s'il vous plaît. J'ai mal à la gorge depuis trois jours et un peu de fièvre.</p>
<p><strong>Secrétaire médicale :</strong> D'accord, ce n'est pas urgent. Le docteur Fabre est bien votre médecin traitant ?</p>
<p><strong>Aïcha :</strong> Oui, c'est bien lui.</p>
<p><strong>Secrétaire médicale :</strong> Je peux vous proposer un rendez-vous demain à quatorze heures.</p>
<p><strong>Aïcha :</strong> Parfait, merci. Je dois apporter ma carte Vitale ?</p>
<p><strong>Secrétaire médicale :</strong> Oui, et votre carte de mutuelle si vous en avez une.</p>
<p><strong>Secrétaire médicale :</strong> Le docteur vous fera une ordonnance si nécessaire. La pharmacie en bas de l'immeuble est ouverte jusqu'à vingt heures.</p>
<p><strong>Aïcha :</strong> Très bien, merci pour ces informations. Je peux payer directement avec ma carte Vitale ou je dois avancer les frais ?</p>
<p><strong>Secrétaire médicale :</strong> Avec la carte Vitale et la mutuelle à jour, vous n'avez généralement rien à avancer, sauf le ticket modérateur selon votre contrat.</p>
<p><strong>Aïcha :</strong> D'accord, je vérifierai avec ma mutuelle. Merci beaucoup pour ces explications.</p>
<p><strong>Secrétaire médicale :</strong> Je vous en prie, à demain quatorze heures.</p>
<h3>Questions de compréhension</h3>
<ol><li>Pourquoi Aïcha appelle-t-elle le SAMU ?</li><li>Quel âge a le fils d'Aïcha ?</li><li>Où se trouve Aïcha lors de l'accident ?</li><li>Que demande le standardiste de ne pas faire ?</li><li>Depuis combien de temps Aïcha a-t-elle mal à la gorge ?</li><li>Quand est fixé le rendez-vous chez le docteur Fabre ?</li><li>Que doit apporter Aïcha au rendez-vous ?</li><li>Jusqu'à quelle heure la pharmacie est-elle ouverte ?</li></ol>
<p style="font-size:8pt;color:#94a3b8;">Estimation : 324 mots (~162 s à un débit A2 naturel).</p>$doc$ WHERE session_code = 'S03' AND document_type = 'dialogue_transcription';

UPDATE public.session_documents SET content_html = $doc$<p>10 questions de type TCF sur le dialogue invariant. Choisissez la bonne réponse pour chaque question.</p>

<div>
<p><strong>Question 1 :</strong> Pourquoi Aïcha appelle-t-elle le SAMU ?</p>
<ul><li>A. Son fils est tombé et ne bouge plus le bras</li><li>B. Elle a mal à la gorge</li><li>C. Elle a besoin d'une ordonnance</li></ul>
</div>

<div>
<p><strong>Question 2 :</strong> Quel âge a le fils d'Aïcha ?</p>
<ul><li>A. Huit ans</li><li>B. Cinq ans</li><li>C. Dix ans</li></ul>
</div>

<div>
<p><strong>Question 3 :</strong> Où se trouve Aïcha lors de l'accident ?</p>
<ul><li>A. Au parc Delacroix, rue des Peupliers</li><li>B. À la pharmacie</li><li>C. Chez le docteur Fabre</li></ul>
</div>

<div>
<p><strong>Question 4 :</strong> Que demande le standardiste de ne pas faire ?</p>
<ul><li>A. Déplacer l'enfant</li><li>B. Appeler une ambulance</li><li>C. Aller à la pharmacie</li></ul>
</div>

<div>
<p><strong>Question 5 :</strong> Depuis combien de temps Aïcha a-t-elle mal à la gorge ?</p>
<ul><li>A. Trois jours</li><li>B. Une semaine</li><li>C. Un jour</li></ul>
</div>

<div>
<p><strong>Question 6 :</strong> Quand est fixé le rendez-vous chez le docteur Fabre ?</p>
<ul><li>A. Demain à quatorze heures</li><li>B. Aujourd'hui à quatorze heures</li><li>C. Demain à quatre heures</li></ul>
</div>

<div>
<p><strong>Question 7 :</strong> Que doit apporter Aïcha au rendez-vous ?</p>
<ul><li>A. Sa carte Vitale et sa carte de mutuelle</li><li>B. Uniquement son passeport</li><li>C. Une ordonnance déjà signée</li></ul>
</div>

<div>
<p><strong>Question 8 :</strong> Jusqu'à quelle heure la pharmacie est-elle ouverte ?</p>
<ul><li>A. Vingt heures</li><li>B. Dix-huit heures</li><li>C. Vingt-deux heures</li></ul>
</div>$doc$ WHERE session_code = 'S03' AND document_type = 'qcm_tcf';

UPDATE public.session_documents SET content_html = $doc$<p>Thème : Vivre dans la société française | Mention : CSP</p>

<div>
<p><strong>1.</strong> Quel numéro appelle-t-on en France pour une urgence médicale grave ?</p>
<ul><li>A. Le 15 (SAMU)</li><li>B. Le 17</li><li>C. Le 18</li></ul>
</div>

<div>
<p><strong>2.</strong> Qu'est-ce qu'un médecin traitant ?</p>
<ul><li>A. Le médecin habituel qui suit le parcours de soins</li><li>B. Un médecin uniquement pour les urgences</li><li>C. Un médecin réservé aux enfants</li></ul>
</div>

<div>
<p><strong>3.</strong> À quoi sert la carte Vitale ?</p>
<ul><li>A. Elle permet le remboursement des soins par l'Assurance Maladie</li><li>B. Elle sert de pièce d'identité</li><li>C. Elle donne accès à la pharmacie uniquement</li></ul>
</div>

<div>
<p><strong>4.</strong> Que rembourse une mutuelle ?</p>
<ul><li>A. La part des soins non prise en charge par l'Assurance Maladie</li><li>B. La totalité de tous les frais médicaux</li><li>C. Uniquement les médicaments sans ordonnance</li></ul>
</div>

<div>
<p><strong>5.</strong> Une personne sans papiers peut-elle accéder aux soins d'urgence en France ?</p>
<ul><li>A. Oui, les urgences vitales sont toujours prises en charge</li><li>B. Non, seuls les résidents réguliers y ont droit</li><li>C. Seulement si elle paie en avance</li></ul>
</div>

<div>
<p><strong>6.</strong> Que doit-on faire face à une urgence non vitale (fièvre légère, mal de gorge) ?</p>
<ul><li>A. Contacter son médecin traitant pour un rendez-vous</li><li>B. Appeler systématiquement le SAMU</li><li>C. Se rendre directement aux urgences hospitalières</li></ul>
</div>

<div>
<p><strong>7.</strong> Qui peut délivrer une ordonnance pour des médicaments soumis à prescription ?</p>
<ul><li>A. Un médecin</li><li>B. N'importe qui à la pharmacie</li><li>C. Un membre de la famille</li></ul>
</div>

<div>
<p><strong>8.</strong> Pourquoi le standardiste du SAMU demande-t-il le lieu exact de l'accident ?</p>
<ul><li>A. Pour envoyer l'ambulance rapidement au bon endroit</li><li>B. Pour remplir un dossier administratif plus tard</li><li>C. Ce n'est pas une information utile en urgence</li></ul>
</div>
<p style="font-size:8pt;font-style:italic;color:#64748b;">Simulation pédagogique CapTCF. Les questions présentées ne préjugent pas des questions officielles de l'examen d'État.</p>$doc$ WHERE session_code = 'S03' AND document_type = 'qcm_civique';

UPDATE public.session_documents SET content_html = $doc$<h3>Corrigé QCM TCF</h3>
<ol>
<li>Pourquoi Aïcha appelle-t-elle le SAMU ? → <strong>Son fils est tombé et ne bouge plus le bras</strong><br><em>Justification : Aïcha dit : « mon fils est tombé, il ne bouge plus le bras et il a très mal ! »</em></li>
<li>Quel âge a le fils d'Aïcha ? → <strong>Huit ans</strong><br><em>Justification : Elle répond directement « Il a huit ans » à la question du standardiste.</em></li>
<li>Où se trouve Aïcha lors de l'accident ? → <strong>Au parc Delacroix, rue des Peupliers</strong><br><em>Justification : Elle précise : « Au parc Delacroix, rue des Peupliers. »</em></li>
<li>Que demande le standardiste de ne pas faire ? → <strong>Déplacer l'enfant</strong><br><em>Justification : Le standardiste dit clairement : « Restez calme, ne le déplacez pas. »</em></li>
<li>Depuis combien de temps Aïcha a-t-elle mal à la gorge ? → <strong>Trois jours</strong><br><em>Justification : Elle précise à la secrétaire : « J'ai mal à la gorge depuis trois jours et un peu de fièvre. »</em></li>
<li>Quand est fixé le rendez-vous chez le docteur Fabre ? → <strong>Demain à quatorze heures</strong><br><em>Justification : La secrétaire propose : « un rendez-vous demain à quatorze heures. »</em></li>
<li>Que doit apporter Aïcha au rendez-vous ? → <strong>Sa carte Vitale et sa carte de mutuelle</strong><br><em>Justification : La secrétaire répond : « Oui, et votre carte de mutuelle si vous en avez une. »</em></li>
<li>Jusqu'à quelle heure la pharmacie est-elle ouverte ? → <strong>Vingt heures</strong><br><em>Justification : La secrétaire précise : « La pharmacie en bas de l'immeuble est ouverte jusqu'à vingt heures. »</em></li>
</ol>
<h3>Corrigé QCM Civique</h3>
<ol>
<li>Quel numéro appelle-t-on en France pour une urgence médicale grave ? → <strong>Le 15 (SAMU)</strong><br><em>Justification : Le 15 est le numéro du SAMU, service médical d'urgence, illustré dans la première scène du dialogue.</em></li>
<li>Qu'est-ce qu'un médecin traitant ? → <strong>Le médecin habituel qui suit le parcours de soins</strong><br><em>Justification : Le médecin traitant, comme le docteur Fabre pour Aïcha, coordonne le suivi médical régulier du patient.</em></li>
<li>À quoi sert la carte Vitale ? → <strong>Elle permet le remboursement des soins par l'Assurance Maladie</strong><br><em>Justification : La carte Vitale atteste des droits à l'Assurance Maladie et permet le remboursement automatique des consultations et médicaments.</em></li>
<li>Que rembourse une mutuelle ? → <strong>La part des soins non prise en charge par l'Assurance Maladie</strong><br><em>Justification : La mutuelle est une assurance complémentaire qui vient s'ajouter au remboursement de base de l'Assurance Maladie.</em></li>
<li>Une personne sans papiers peut-elle accéder aux soins d'urgence en France ? → <strong>Oui, les urgences vitales sont toujours prises en charge</strong><br><em>Justification : L'accès aux soins d'urgence est garanti à toute personne présente sur le territoire, indépendamment de sa situation administrative.</em></li>
<li>Que doit-on faire face à une urgence non vitale (fièvre légère, mal de gorge) ? → <strong>Contacter son médecin traitant pour un rendez-vous</strong><br><em>Justification : Comme Aïcha pour son mal de gorge, une situation non urgente relève du médecin traitant, pas du SAMU, pour ne pas saturer les urgences.</em></li>
<li>Qui peut délivrer une ordonnance pour des médicaments soumis à prescription ? → <strong>Un médecin</strong><br><em>Justification : Seul un médecin peut rédiger une ordonnance, document nécessaire pour obtenir certains médicaments à la pharmacie.</em></li>
<li>Pourquoi le standardiste du SAMU demande-t-il le lieu exact de l'accident ? → <strong>Pour envoyer l'ambulance rapidement au bon endroit</strong><br><em>Justification : La localisation précise permet une intervention rapide des secours, élément décisif dans la gestion d'une urgence vitale.</em></li>
</ol>
<h3>Grille d'évaluation</h3>
<p style="font-size:9pt;color:#475569;">A1/A2 : tolérer les fautes de grammaire si le sens communicatif est préservé. B1/B2 : attendre une structure textuelle fluide et une argumentation développée.</p>$doc$ WHERE session_code = 'S03' AND document_type = 'corrige_formateur';

UPDATE public.session_documents SET content_html = $doc$<table><thead><tr><th>Mot</th><th>Définition simplifiée</th><th>Exemple</th></tr></thead><tbody>
<tr><td><strong>symptôme</strong></td><td>Un signe qui montre qu'on est malade.</td><td><em>« Mon symptôme principal est le mal de gorge. »</em></td></tr>
<tr><td><strong>douleur</strong></td><td>Une sensation physique désagréable.</td><td><em>« Il a une douleur au bras après sa chute. »</em></td></tr>
<tr><td><strong>urgence</strong></td><td>Une situation grave qui demande une aide immédiate.</td><td><em>« En cas d'urgence, on appelle le 15. »</em></td></tr>
<tr><td><strong>médecin traitant</strong></td><td>Le médecin habituel qui suit un patient.</td><td><em>« Le docteur Fabre est mon médecin traitant. »</em></td></tr>
<tr><td><strong>rendez-vous</strong></td><td>Un moment fixé pour rencontrer quelqu'un.</td><td><em>« J'ai un rendez-vous demain à 14 heures. »</em></td></tr>
<tr><td><strong>ordonnance</strong></td><td>Un document du médecin listant les médicaments.</td><td><em>« Le docteur m'a donné une ordonnance. »</em></td></tr>
<tr><td><strong>carte Vitale</strong></td><td>La carte d'assurance maladie française.</td><td><em>« N'oubliez pas votre carte Vitale au cabinet. »</em></td></tr>
<tr><td><strong>mutuelle</strong></td><td>Une assurance complémentaire qui rembourse une partie des soins.</td><td><em>« Ma mutuelle rembourse une partie de la consultation. »</em></td></tr>
<tr><td><strong>pharmacie</strong></td><td>Le magasin où l'on achète des médicaments.</td><td><em>« La pharmacie est ouverte jusqu'à vingt heures. »</em></td></tr>
<tr><td><strong>SAMU</strong></td><td>Le service médical d'urgence, joignable au 15.</td><td><em>« En cas d'urgence grave, on appelle le SAMU. »</em></td></tr>
</tbody></table>$doc$ WHERE session_code = 'S03' AND document_type = 'lexique';

UPDATE public.session_documents SET content_html = $doc$<p>Tableau des numéros utiles (15 SAMU, 17 Police, 18 Pompiers, 112 urgence européenne) et illustration générique d'un cabinet médical, sans donnée réelle inventée.</p>
<h3>Questions d'observation</h3>
<ol>
<li>Que représente chaque élément du schéma ?</li>
<li>Quel élément est directement lié à la situation du dialogue ?</li>
<li>Pourquoi ce thème est-il important dans la vie quotidienne en France ?</li>
</ol>
<p><em>Socle à compléter : l'illustration SVG définitive reste à produire ; ce texte décrit la scène cible.</em></p>$doc$ WHERE session_code = 'S03' AND document_type = 'support_visuel';

UPDATE public.session_documents SET content_html = $doc$<h3>Fiche pratique : qui appeler selon la situation ?</h3>
<p>Ce document est une fiche pratique récapitulant les numéros et interlocuteurs de santé utiles, restructurée selon la charte CapTCF.</p>
<h3>1. Urgence vitale</h3>
<p>15 (SAMU) : problème grave, accident, perte de connaissance.<br>18 (Pompiers) : incendie, accident, personne en danger.<br>112 : numéro d'urgence européen, valable partout en Europe.</p>
<h3>2. Situation non urgente</h3>
<p>Médecin traitant : rendez-vous pour un symptôme léger ou un suivi régulier.<br>Pharmacie : conseil et médicaments sans ordonnance.</p>
<p style="background-color:#fffbeb;border-left:3px solid #f59e0b;padding:10px;border-radius:4px;">Document pédagogique CapTCF — en cas de doute réel, appelez toujours le 15.</p>$doc$ WHERE session_code = 'S03' AND document_type = 'document_transforme';

UPDATE public.session_documents SET content_html = $doc$<p><strong>Guide pédagogique — v3 socle à compléter.</strong> L'école Jules-Ferry laisse un message vocal signalant l'absence de Lina, une élève de CE2. Son parent répond par écrit pour justifier l'absence, puis échange avec le directeur sur le règlement de l'école.</p>
<h3>Objectifs opérationnels</h3>
<ul>
<li>Comprendre la situation invariante de la séance (CE/EE/CIVIQUE).</li>
<li>Mobiliser le lexique et les structures nécessaires à la situation.</li>
<li>Distinguer les repères civiques du thème « Droits et devoirs ».</li>
</ul>
<h3>Déroulé détaillé (180 minutes)</h3>
<ol>
<li><strong>Rituel civique</strong> (10 min) — Observation du support visuel (parcours scolaire, obligation d'instruction) : « À partir de quel âge va-t-on à l'école ? » Pas de notation.</li>
<li><strong>Activation + lexique</strong> (20 min) — Lecture des 10 mots clés de la vie scolaire, puis 3 exercices lexicaux (association, texte à trous, réemploi oral).</li>
<li><strong>Support invariant CE/EE (50 min)</strong> (50 min) — 1ère lecture du message sans transcription → 2ème lecture ciblée (motif, justificatif, délai) → 3ème lecture avec transcription → exploitation écrite (8 questions).</li>
<li><strong>Ateliers différenciés</strong> (60 min) — 4 groupes A1/A2/B1/B2 : rédaction d'un mot d'absence gradué, cf. tableau ci-dessous.</li>
<li><strong>Production EE/EO</strong> (30 min) — EE (20 min) : rédiger un message d'absence complet. EO (10 min) : simuler un appel à l'école pour prévenir d'une absence.</li>
<li><strong>Fixation</strong> (10 min) — QCM civique 8 questions sur l'instruction obligatoire et la laïcité, correction flash collective.</li>
</ol>
<h3>Ateliers différenciés — détail par niveau</h3>
<table><thead><tr><th>Niveau</th><th>Contenu</th></tr></thead><tbody>
<tr><td><strong>A1</strong></td><td>Associer des pictogrammes scolaires (cahier, cartable, horloge) à leur nom ; compléter un mot d'absence très simple avec amorces.</td></tr>
<tr><td><strong>A2</strong></td><td>Compléter un modèle de mot d'absence à l'école à partir d'un motif donné (maladie, rendez-vous médical).</td></tr>
<tr><td><strong>B1</strong></td><td>Rédiger un message complet justifiant une absence, avec formules de politesse adaptées à un directeur d'école.</td></tr>
<tr><td><strong>B2</strong></td><td>Argumenter à l'oral sur l'articulation entre laïcité et liberté religieuse à l'école publique, à partir des explications de M. Dupuis.</td></tr>
</tbody></table>
<h3>Note de statut</h3>
<p><em>Socle à compléter : ce déroulé est une base réaliste (180 min réparties en 6 phases), pas une version finalisée. Le formateur peut l'ajuster directement ici.</em></p>$doc$ WHERE session_code = 'S04' AND document_type = 'fiche_formateur';

UPDATE public.session_documents SET content_html = $doc$<p>Travaillez les activités correspondant à votre niveau. Le formateur passera vous aider.</p>
<h3>Situation de la séance</h3>
<p>L'école Jules-Ferry laisse un message vocal signalant l'absence de Lina, une élève de CE2. Son parent répond par écrit pour justifier l'absence, puis échange avec le directeur sur le règlement de l'école.</p>
<h3>Lexique clé (à connaître avant l'activité)</h3>
<ul><li>école</li><li>classe</li><li>absence</li><li>justificatif</li><li>obligatoire</li></ul>
<p><em>Liste complète des 10 mots dans la fiche Lexique.</em></p>
<h3>Ateliers différenciés — repères par niveau</h3>
<table><thead><tr><th>Niveau</th><th>Activité</th></tr></thead><tbody>
<tr><td><strong>A1</strong></td><td style="font-size:9pt;">Associer des pictogrammes scolaires (cahier, cartable, horloge) à leur nom ; compléter un mot d'absence très simple avec amorces.</td></tr>
<tr><td><strong>A2</strong></td><td style="font-size:9pt;">Compléter un modèle de mot d'absence à l'école à partir d'un motif donné (maladie, rendez-vous médical).</td></tr>
<tr><td><strong>B1</strong></td><td style="font-size:9pt;">Rédiger un message complet justifiant une absence, avec formules de politesse adaptées à un directeur d'école.</td></tr>
<tr><td><strong>B2</strong></td><td style="font-size:9pt;">Argumenter à l'oral sur l'articulation entre laïcité et liberté religieuse à l'école publique, à partir des explications de M. Dupuis.</td></tr>
</tbody></table>
<h3>Note de statut</h3>
<p><em>Socle à compléter : cette fiche pose la structure de l'activité, à enrichir avec des exercices écrits complets.</em></p>$doc$ WHERE session_code = 'S04' AND document_type = 'fiche_apprenant';

UPDATE public.session_documents SET content_html = $doc$<p><em>L'école Jules-Ferry laisse un message vocal signalant l'absence de Lina, une élève de CE2. Son parent répond par écrit pour justifier l'absence, puis échange avec le directeur sur le règlement de l'école.</em></p>
<p><strong>M. Dupuis (directeur) :</strong> Bonjour, ici Monsieur Dupuis, directeur de l'école Jules-Ferry. Je vous appelle car votre fille Lina n'était pas présente ce matin en classe de CE2.</p>
<p><strong>M. Dupuis (directeur) :</strong> Merci de nous contacter pour expliquer son absence et de nous transmettre un justificatif si nécessaire.</p>
<p><strong>M. Dupuis (directeur) :</strong> L'instruction est obligatoire pour tous les enfants à partir de trois ans, et nous devons signaler toute absence non justifiée.</p>
<p><strong>M. Dupuis (directeur) :</strong> Vous pouvez me joindre au bureau entre huit heures et dix-sept heures, ou envoyer un mot dans le carnet de correspondance. Bonne journée.</p>
<p><strong>Le parent :</strong> Bonjour Monsieur Dupuis, je vous écris pour excuser l'absence de Lina ce matin.</p>
<p><strong>Le parent :</strong> Elle avait de la fièvre et j'ai préféré la garder à la maison. Voici le certificat médical en pièce jointe.</p>
<p><strong>Le parent :</strong> Elle sera présente demain. Je vous remercie de votre compréhension. Cordialement.</p>
<p><strong>M. Dupuis (directeur) :</strong> Merci pour votre message et le certificat.</p>
<p><strong>M. Dupuis (directeur) :</strong> Je vous rappelle que l'école est mixte : filles et garçons suivent exactement le même règlement et les mêmes enseignements, conformément aux principes de l'école publique.</p>
<p><strong>Le parent :</strong> Merci beaucoup. Une question : est-ce que Lina peut porter un signe religieux visible à l'école ?</p>
<p><strong>M. Dupuis (directeur) :</strong> Non, dans les établissements publics, les signes religieux ostensibles ne sont pas autorisés, conformément au principe de laïcité. C'est une règle qui s'applique à tous les élèves, sans exception.</p>
<p><strong>Le parent :</strong> Je comprends, merci pour cette précision.</p>
<p><strong>M. Dupuis (directeur) :</strong> Le règlement intérieur complet est disponible sur le site de l'école si vous souhaitez le consulter.</p>
<p><strong>Le parent :</strong> D'accord, je vais le lire. Merci encore pour votre patience.</p>
<p><strong>M. Dupuis (directeur) :</strong> C'est normal, n'hésitez pas à nous contacter à chaque fois que nécessaire. Bonne journée à vous et à Lina.</p>
<h3>Questions de compréhension</h3>
<ol><li>Pourquoi Monsieur Dupuis appelle-t-il le parent de Lina ?</li><li>En quelle classe est Lina ?</li><li>Que doit transmettre le parent à l'école ?</li><li>Pourquoi Lina était-elle absente ?</li><li>Que joint le parent à son message ?</li><li>Quand Lina sera-t-elle de nouveau présente ?</li><li>Comment le parent peut-il contacter l'école selon M. Dupuis ?</li><li>Où le règlement intérieur de l'école est-il disponible ?</li></ol>
<p style="font-size:8pt;color:#94a3b8;">Estimation : 311 mots (~156 s à un débit A2 naturel).</p>$doc$ WHERE session_code = 'S04' AND document_type = 'dialogue_transcription';

UPDATE public.session_documents SET content_html = $doc$<p>10 questions de type TCF sur le dialogue invariant. Choisissez la bonne réponse pour chaque question.</p>

<div>
<p><strong>Question 1 :</strong> Pourquoi Monsieur Dupuis appelle-t-il le parent de Lina ?</p>
<ul><li>A. Lina était absente ce matin en classe</li><li>B. Lina a eu un problème de discipline</li><li>C. Il veut organiser une réunion</li></ul>
</div>

<div>
<p><strong>Question 2 :</strong> En quelle classe est Lina ?</p>
<ul><li>A. CE2</li><li>B. CM1</li><li>C. CP</li></ul>
</div>

<div>
<p><strong>Question 3 :</strong> Que doit transmettre le parent à l'école ?</p>
<ul><li>A. Un justificatif si nécessaire</li><li>B. Une lettre de motivation</li><li>C. Un formulaire d'inscription</li></ul>
</div>

<div>
<p><strong>Question 4 :</strong> Pourquoi Lina était-elle absente ?</p>
<ul><li>A. Elle avait de la fièvre</li><li>B. Elle était en voyage</li><li>C. Elle avait un rendez-vous administratif</li></ul>
</div>

<div>
<p><strong>Question 5 :</strong> Que joint le parent à son message ?</p>
<ul><li>A. Un certificat médical</li><li>B. Une attestation de travail</li><li>C. Rien du tout</li></ul>
</div>

<div>
<p><strong>Question 6 :</strong> Quand Lina sera-t-elle de nouveau présente ?</p>
<ul><li>A. Le lendemain (demain)</li><li>B. La semaine suivante</li><li>C. Cela reste incertain</li></ul>
</div>

<div>
<p><strong>Question 7 :</strong> Comment le parent peut-il contacter l'école selon M. Dupuis ?</p>
<ul><li>A. Au bureau entre 8h et 17h, ou par le carnet de correspondance</li><li>B. Uniquement par courrier postal</li><li>C. Uniquement le samedi</li></ul>
</div>

<div>
<p><strong>Question 8 :</strong> Où le règlement intérieur de l'école est-il disponible ?</p>
<ul><li>A. Sur le site de l'école</li><li>B. Uniquement au secrétariat</li><li>C. Il n'est pas communiqué aux parents</li></ul>
</div>$doc$ WHERE session_code = 'S04' AND document_type = 'qcm_tcf';

UPDATE public.session_documents SET content_html = $doc$<p>Thème : Droits et devoirs | Mention : CSP</p>

<div>
<p><strong>1.</strong> À partir de quel âge l'instruction est-elle obligatoire en France ?</p>
<ul><li>A. Trois ans</li><li>B. Six ans</li><li>C. Cinq ans</li></ul>
</div>

<div>
<p><strong>2.</strong> Que signifie la mixité à l'école publique ?</p>
<ul><li>A. Filles et garçons suivent le même règlement et les mêmes enseignements</li><li>B. Les filles et les garçons ont des horaires séparés</li><li>C. Seuls les garçons doivent aller à l'école</li></ul>
</div>

<div>
<p><strong>3.</strong> Un élève peut-il porter un signe religieux ostensible à l'école publique ?</p>
<ul><li>A. Non, ce n'est pas autorisé, au nom de la laïcité</li><li>B. Oui, sans aucune restriction</li><li>C. Seulement le vendredi</li></ul>
</div>

<div>
<p><strong>4.</strong> La règle sur les signes religieux s'applique-t-elle à tous les élèves ?</p>
<ul><li>A. Oui, sans exception</li><li>B. Seulement aux élèves de primaire</li><li>C. Seulement si les parents sont d'accord</li></ul>
</div>

<div>
<p><strong>5.</strong> Qui est responsable de justifier l'absence d'un enfant mineur ?</p>
<ul><li>A. Le parent ou responsable légal</li><li>B. L'enfant lui-même</li><li>C. Le voisin de classe</li></ul>
</div>

<div>
<p><strong>6.</strong> Que risque une absence non justifiée à répétition ?</p>
<ul><li>A. Un signalement de l'école aux autorités compétentes</li><li>B. Aucune conséquence</li><li>C. Une amende immédiate au parent</li></ul>
</div>

<div>
<p><strong>7.</strong> L'école publique est-elle gratuite en France ?</p>
<ul><li>A. Oui, l'instruction publique est gratuite</li><li>B. Non, elle est payante pour tous</li><li>C. Seulement pour les enfants français</li></ul>
</div>

<div>
<p><strong>8.</strong> Pourquoi le règlement intérieur est-il rendu accessible aux parents ?</p>
<ul><li>A. Pour que chacun connaisse ses droits et devoirs dans l'école</li><li>B. Parce que c'est optionnel de le consulter</li><li>C. Uniquement pour les nouveaux élèves</li></ul>
</div>
<p style="font-size:8pt;font-style:italic;color:#64748b;">Simulation pédagogique CapTCF. Les questions présentées ne préjugent pas des questions officielles de l'examen d'État.</p>$doc$ WHERE session_code = 'S04' AND document_type = 'qcm_civique';

UPDATE public.session_documents SET content_html = $doc$<h3>Corrigé QCM TCF</h3>
<ol>
<li>Pourquoi Monsieur Dupuis appelle-t-il le parent de Lina ? → <strong>Lina était absente ce matin en classe</strong><br><em>Justification : M. Dupuis annonce directement : « votre fille Lina n'était pas présente ce matin en classe de CE2. »</em></li>
<li>En quelle classe est Lina ? → <strong>CE2</strong><br><em>Justification : Le message précise « n'était pas présente ce matin en classe de CE2. »</em></li>
<li>Que doit transmettre le parent à l'école ? → <strong>Un justificatif si nécessaire</strong><br><em>Justification : M. Dupuis demande d'« expliquer son absence et de nous transmettre un justificatif si nécessaire. »</em></li>
<li>Pourquoi Lina était-elle absente ? → <strong>Elle avait de la fièvre</strong><br><em>Justification : Le parent explique : « Elle avait de la fièvre et j'ai préféré la garder à la maison. »</em></li>
<li>Que joint le parent à son message ? → <strong>Un certificat médical</strong><br><em>Justification : Le parent écrit : « Voici le certificat médical en pièce jointe. »</em></li>
<li>Quand Lina sera-t-elle de nouveau présente ? → <strong>Le lendemain (demain)</strong><br><em>Justification : Le parent confirme : « Elle sera présente demain. »</em></li>
<li>Comment le parent peut-il contacter l'école selon M. Dupuis ? → <strong>Au bureau entre 8h et 17h, ou par le carnet de correspondance</strong><br><em>Justification : M. Dupuis précise : « Vous pouvez me joindre au bureau entre huit heures et dix-sept heures, ou envoyer un mot dans le carnet de correspondance. »</em></li>
<li>Où le règlement intérieur de l'école est-il disponible ? → <strong>Sur le site de l'école</strong><br><em>Justification : M. Dupuis indique : « Le règlement intérieur complet est disponible sur le site de l'école. »</em></li>
</ol>
<h3>Corrigé QCM Civique</h3>
<ol>
<li>À partir de quel âge l'instruction est-elle obligatoire en France ? → <strong>Trois ans</strong><br><em>Justification : M. Dupuis le rappelle explicitement : « L'instruction est obligatoire pour tous les enfants à partir de trois ans. »</em></li>
<li>Que signifie la mixité à l'école publique ? → <strong>Filles et garçons suivent le même règlement et les mêmes enseignements</strong><br><em>Justification : M. Dupuis l'explique : « filles et garçons suivent exactement le même règlement et les mêmes enseignements. »</em></li>
<li>Un élève peut-il porter un signe religieux ostensible à l'école publique ? → <strong>Non, ce n'est pas autorisé, au nom de la laïcité</strong><br><em>Justification : M. Dupuis est clair : « les signes religieux ostensibles ne sont pas autorisés, conformément au principe de laïcité. »</em></li>
<li>La règle sur les signes religieux s'applique-t-elle à tous les élèves ? → <strong>Oui, sans exception</strong><br><em>Justification : M. Dupuis précise : « C'est une règle qui s'applique à tous les élèves, sans exception. »</em></li>
<li>Qui est responsable de justifier l'absence d'un enfant mineur ? → <strong>Le parent ou responsable légal</strong><br><em>Justification : L'autorité parentale implique la responsabilité du suivi de la scolarité, ici illustrée par le parent qui envoie le certificat médical.</em></li>
<li>Que risque une absence non justifiée à répétition ? → <strong>Un signalement de l'école aux autorités compétentes</strong><br><em>Justification : L'obligation scolaire impose à l'école de signaler les absences non justifiées, comme le rappelle M. Dupuis en début d'échange.</em></li>
<li>L'école publique est-elle gratuite en France ? → <strong>Oui, l'instruction publique est gratuite</strong><br><em>Justification : La gratuité de l'instruction publique est un principe républicain, garanti à tous les enfants présents sur le territoire, quelle que soit leur nationalité.</em></li>
<li>Pourquoi le règlement intérieur est-il rendu accessible aux parents ? → <strong>Pour que chacun connaisse ses droits et devoirs dans l'école</strong><br><em>Justification : M. Dupuis invite le parent à le consulter en ligne, dans une logique de transparence sur les règles communes à tous.</em></li>
</ol>
<h3>Grille d'évaluation</h3>
<p style="font-size:9pt;color:#475569;">A1/A2 : tolérer les fautes de grammaire si le sens communicatif est préservé. B1/B2 : attendre une structure textuelle fluide et une argumentation développée.</p>$doc$ WHERE session_code = 'S04' AND document_type = 'corrige_formateur';

UPDATE public.session_documents SET content_html = $doc$<table><thead><tr><th>Mot</th><th>Définition simplifiée</th><th>Exemple</th></tr></thead><tbody>
<tr><td><strong>école</strong></td><td>L'établissement où les enfants apprennent.</td><td><em>« Lina va à l'école Jules-Ferry. »</em></td></tr>
<tr><td><strong>classe</strong></td><td>Le groupe d'élèves d'un même niveau.</td><td><em>« Lina est en classe de CE2. »</em></td></tr>
<tr><td><strong>absence</strong></td><td>Le fait de ne pas être présent.</td><td><em>« L'absence de Lina doit être justifiée. »</em></td></tr>
<tr><td><strong>justificatif</strong></td><td>Un document qui prouve un motif valable.</td><td><em>« Voici le certificat médical comme justificatif. »</em></td></tr>
<tr><td><strong>obligatoire</strong></td><td>Ce que la loi impose de faire.</td><td><em>« L'instruction est obligatoire à partir de trois ans. »</em></td></tr>
<tr><td><strong>parent</strong></td><td>Le père ou la mère d'un enfant.</td><td><em>« Le parent doit justifier une absence. »</em></td></tr>
<tr><td><strong>mixité</strong></td><td>Le fait que filles et garçons suivent les mêmes cours.</td><td><em>« L'école publique applique la mixité pour tous. »</em></td></tr>
<tr><td><strong>règlement</strong></td><td>L'ensemble des règles d'un établissement.</td><td><em>« Le règlement intérieur est disponible sur le site. »</em></td></tr>
<tr><td><strong>instruction</strong></td><td>L'apprentissage scolaire organisé.</td><td><em>« L'instruction est obligatoire pour tous les enfants. »</em></td></tr>
<tr><td><strong>directeur</strong></td><td>La personne responsable d'une école.</td><td><em>« Monsieur Dupuis est le directeur de l'école. »</em></td></tr>
</tbody></table>$doc$ WHERE session_code = 'S04' AND document_type = 'lexique';

UPDATE public.session_documents SET content_html = $doc$<p>Schéma du parcours scolaire obligatoire (de 3 à 16 ans) avec les grandes étapes (maternelle, élémentaire, collège), et pictogramme du principe de laïcité à l'école.</p>
<h3>Questions d'observation</h3>
<ol>
<li>Que représente chaque élément du schéma ?</li>
<li>Quel élément est directement lié à la situation du dialogue ?</li>
<li>Pourquoi ce thème est-il important dans la vie quotidienne en France ?</li>
</ol>
<p><em>Socle à compléter : l'illustration SVG définitive reste à produire ; ce texte décrit la scène cible.</em></p>$doc$ WHERE session_code = 'S04' AND document_type = 'support_visuel';

UPDATE public.session_documents SET content_html = $doc$<h3>Modèle de mot d'absence scolaire</h3>
<p>Ce document est un modèle pédagogique de mot justificatif d'absence, restructuré selon la charte CapTCF. Il ne remplace aucun document officiel de l'école.</p>
<h3>1. Informations sur l'élève</h3>
<p>Nom et prénom de l'enfant : ……………………… Classe : ………<br>Date(s) d'absence : ………………………</p>
<h3>2. Motif de l'absence</h3>
<p>☐ Maladie (certificat joint) ☐ Rendez-vous médical ☐ Événement familial ☐ Autre : ………</p>
<h3>3. Signature</h3>
<p>Nom du responsable légal : ……………………… Date : …… / …… / …… Signature : ………</p>
<p style="background-color:#fffbeb;border-left:3px solid #f59e0b;padding:10px;border-radius:4px;">Document fictif à usage pédagogique uniquement — modèle CapTCF.</p>$doc$ WHERE session_code = 'S04' AND document_type = 'document_transforme';

UPDATE public.session_documents SET content_html = $doc$<p><strong>Guide pédagogique — v3 socle à compléter.</strong> Youssef, locataire, vient voir un médiateur social pour un conflit de voisinage avec Monsieur Petit (nuisances sonores) qui a dégénéré en propos discriminatoires.</p>
<h3>Objectifs opérationnels</h3>
<ul>
<li>Comprendre la situation invariante de la séance (CO/EO/CIVIQUE).</li>
<li>Mobiliser le lexique et les structures nécessaires à la situation.</li>
<li>Distinguer les repères civiques du thème « Droits et devoirs ».</li>
</ul>
<h3>Déroulé détaillé (180 minutes)</h3>
<ol>
<li><strong>Rituel civique</strong> (10 min) — Observation du support visuel (plan d'immeuble, acteurs du conflit) : « Qui peut aider en cas de conflit de voisinage ? » Pas de notation.</li>
<li><strong>Activation + lexique</strong> (20 min) — Lecture des 10 mots clés du logement, puis 3 exercices lexicaux (association, texte à trous, réemploi oral).</li>
<li><strong>Support invariant CO (50 min)</strong> (50 min) — 1ère écoute globale sans transcription → 2ème écoute ciblée (repérage des faits et de la discrimination) → 3ème écoute avec transcription → exploitation écrite (8 questions).</li>
<li><strong>Ateliers différenciés</strong> (60 min) — 4 groupes A1/A2/B1/B2 : signalement d'un problème de voisinage gradué, cf. tableau ci-dessous.</li>
<li><strong>Production EO/EE</strong> (30 min) — EO (20 min) : jeu de rôle médiation de voisinage en trinôme. EE (10 min) : rédiger un message de signalement factuel.</li>
<li><strong>Fixation</strong> (10 min) — QCM civique 8 questions sur l'égalité et les recours contre la discrimination, correction flash collective.</li>
</ol>
<h3>Ateliers différenciés — détail par niveau</h3>
<table><thead><tr><th>Niveau</th><th>Contenu</th></tr></thead><tbody>
<tr><td><strong>A1</strong></td><td>Associer des pictogrammes du logement (bail, clé, immeuble) à leur nom ; répéter des formules simples pour signaler un problème sans agressivité.</td></tr>
<tr><td><strong>A2</strong></td><td>Compléter un dialogue de signalement de nuisance à trous ; distinguer sur des exemples ce qui relève du règlement et ce qui relève de la discrimination.</td></tr>
<tr><td><strong>B1</strong></td><td>Rédiger un message décrivant un conflit de voisinage et demandant une médiation, avec un ton posé et factuel.</td></tr>
<tr><td><strong>B2</strong></td><td>Argumenter à l'oral sur les recours possibles face à une discrimination, à partir des explications du médiateur dans le dialogue.</td></tr>
</tbody></table>
<h3>Note de statut</h3>
<p><em>Socle à compléter : ce déroulé est une base réaliste (180 min réparties en 6 phases), pas une version finalisée. Le formateur peut l'ajuster directement ici.</em></p>$doc$ WHERE session_code = 'S05' AND document_type = 'fiche_formateur';

UPDATE public.session_documents SET content_html = $doc$<p>Travaillez les activités correspondant à votre niveau. Le formateur passera vous aider.</p>
<h3>Situation de la séance</h3>
<p>Youssef, locataire, vient voir un médiateur social pour un conflit de voisinage avec Monsieur Petit (nuisances sonores) qui a dégénéré en propos discriminatoires.</p>
<h3>Lexique clé (à connaître avant l'activité)</h3>
<ul><li>bail</li><li>locataire</li><li>propriétaire</li><li>nuisance</li><li>voisin</li></ul>
<p><em>Liste complète des 10 mots dans la fiche Lexique.</em></p>
<h3>Ateliers différenciés — repères par niveau</h3>
<table><thead><tr><th>Niveau</th><th>Activité</th></tr></thead><tbody>
<tr><td><strong>A1</strong></td><td style="font-size:9pt;">Associer des pictogrammes du logement (bail, clé, immeuble) à leur nom ; répéter des formules simples pour signaler un problème sans agressivité.</td></tr>
<tr><td><strong>A2</strong></td><td style="font-size:9pt;">Compléter un dialogue de signalement de nuisance à trous ; distinguer sur des exemples ce qui relève du règlement et ce qui relève de la discrimination.</td></tr>
<tr><td><strong>B1</strong></td><td style="font-size:9pt;">Rédiger un message décrivant un conflit de voisinage et demandant une médiation, avec un ton posé et factuel.</td></tr>
<tr><td><strong>B2</strong></td><td style="font-size:9pt;">Argumenter à l'oral sur les recours possibles face à une discrimination, à partir des explications du médiateur dans le dialogue.</td></tr>
</tbody></table>
<h3>Note de statut</h3>
<p><em>Socle à compléter : cette fiche pose la structure de l'activité, à enrichir avec des exercices écrits complets.</em></p>$doc$ WHERE session_code = 'S05' AND document_type = 'fiche_apprenant';

UPDATE public.session_documents SET content_html = $doc$<p><em>Youssef, locataire, vient voir un médiateur social pour un conflit de voisinage avec Monsieur Petit (nuisances sonores) qui a dégénéré en propos discriminatoires.</em></p>
<p><strong>Youssef :</strong> Bonjour, je viens vous voir pour un problème avec mon voisin du dessus, Monsieur Petit.</p>
<p><strong>M. Karam (médiateur) :</strong> Bonjour, je vous écoute. Quel est le problème exactement ?</p>
<p><strong>Youssef :</strong> Il fait beaucoup de bruit tard le soir, presque tous les jours, et cela m'empêche de dormir.</p>
<p><strong>M. Karam (médiateur) :</strong> Avez-vous déjà essayé de lui en parler directement ?</p>
<p><strong>Youssef :</strong> Oui, une fois, mais il a mal réagi. Il m'a même dit que je n'avais pas à me plaindre parce que je ne suis pas français.</p>
<p><strong>M. Karam (médiateur) :</strong> C'est très grave, ce qu'il vous a dit là est une discrimination, c'est interdit par la loi, quelle que soit votre nationalité.</p>
<p><strong>Youssef :</strong> Je ne savais pas quoi faire, donc je suis venu ici.</p>
<p><strong>M. Karam (médiateur) :</strong> Vous avez bien fait. D'abord, pour le bruit : c'est une nuisance qui concerne le règlement de l'immeuble. Je peux organiser une rencontre entre vous et lui, en tant que médiateur neutre.</p>
<p><strong>Youssef :</strong> D'accord, je suis d'accord pour essayer.</p>
<p><strong>M. Karam (médiateur) :</strong> Pour les propos discriminatoires, vous avez le droit de déposer un recours ou de signaler les faits, par exemple auprès du propriétaire ou d'une association.</p>
<p><strong>Youssef :</strong> Est-ce que le propriétaire peut m'aider aussi ?</p>
<p><strong>M. Karam (médiateur) :</strong> Oui, en tant que propriétaire, il a une responsabilité pour le respect du règlement intérieur de l'immeuble par tous les locataires, y compris pour les nuisances sonores.</p>
<p><strong>Youssef :</strong> Je comprends mieux maintenant. Merci beaucoup pour votre aide et vos explications.</p>
<p><strong>M. Karam (médiateur) :</strong> Je vous en prie. Je vous recontacte dans les prochains jours pour organiser la rencontre avec Monsieur Petit.</p>
<h3>Questions de compréhension</h3>
<ol><li>Pourquoi Youssef vient-il voir le médiateur ?</li><li>Quand le bruit pose-t-il problème selon Youssef ?</li><li>Qu'a répondu Monsieur Petit quand Youssef lui en a parlé ?</li><li>Comment M. Karam qualifie-t-il ces propos ?</li><li>Que propose M. Karam pour régler le problème de bruit ?</li><li>Que peut faire Youssef face aux propos discriminatoires ?</li><li>Quelle responsabilité a le propriétaire selon M. Karam ?</li><li>Que fera M. Karam dans les prochains jours ?</li></ol>
<p style="font-size:8pt;color:#94a3b8;">Estimation : 280 mots (~140 s à un débit A2 naturel).</p>$doc$ WHERE session_code = 'S05' AND document_type = 'dialogue_transcription';

UPDATE public.session_documents SET content_html = $doc$<p>10 questions de type TCF sur le dialogue invariant. Choisissez la bonne réponse pour chaque question.</p>

<div>
<p><strong>Question 1 :</strong> Pourquoi Youssef vient-il voir le médiateur ?</p>
<ul><li>A. Un problème de bruit avec son voisin du dessus</li><li>B. Un problème de loyer impayé</li><li>C. Un dégât des eaux</li></ul>
</div>

<div>
<p><strong>Question 2 :</strong> Quand le bruit pose-t-il problème selon Youssef ?</p>
<ul><li>A. Tard le soir, presque tous les jours</li><li>B. Uniquement le week-end</li><li>C. Le matin très tôt</li></ul>
</div>

<div>
<p><strong>Question 3 :</strong> Qu'a répondu Monsieur Petit quand Youssef lui en a parlé ?</p>
<ul><li>A. Que Youssef n'avait pas à se plaindre car il n'est pas français</li><li>B. Qu'il allait faire moins de bruit</li><li>C. Qu'il allait déménager</li></ul>
</div>

<div>
<p><strong>Question 4 :</strong> Comment M. Karam qualifie-t-il ces propos ?</p>
<ul><li>A. Une discrimination interdite par la loi</li><li>B. Une simple maladresse</li><li>C. Une remarque sans importance</li></ul>
</div>

<div>
<p><strong>Question 5 :</strong> Que propose M. Karam pour régler le problème de bruit ?</p>
<ul><li>A. Organiser une rencontre en tant que médiateur neutre</li><li>B. Appeler la police immédiatement</li><li>C. Ne rien faire</li></ul>
</div>

<div>
<p><strong>Question 6 :</strong> Que peut faire Youssef face aux propos discriminatoires ?</p>
<ul><li>A. Déposer un recours ou signaler les faits</li><li>B. Rien, ce n'est pas possible légalement</li><li>C. Déménager immédiatement</li></ul>
</div>

<div>
<p><strong>Question 7 :</strong> Quelle responsabilité a le propriétaire selon M. Karam ?</p>
<ul><li>A. Faire respecter le règlement intérieur par tous les locataires</li><li>B. Aucune responsabilité en cas de conflit</li><li>C. Seulement percevoir le loyer</li></ul>
</div>

<div>
<p><strong>Question 8 :</strong> Que fera M. Karam dans les prochains jours ?</p>
<ul><li>A. Recontacter Youssef pour organiser la rencontre</li><li>B. Ne plus s'occuper de ce dossier</li><li>C. Convoquer directement la police</li></ul>
</div>$doc$ WHERE session_code = 'S05' AND document_type = 'qcm_tcf';

UPDATE public.session_documents SET content_html = $doc$<p>Thème : Droits et devoirs | Mention : CSP</p>

<div>
<p><strong>1.</strong> Une discrimination fondée sur la nationalité est-elle légale en France ?</p>
<ul><li>A. Non, elle est interdite par la loi</li><li>B. Oui, si le propriétaire est d'accord</li><li>C. Seulement dans certains immeubles</li></ul>
</div>

<div>
<p><strong>2.</strong> Que peut faire une personne victime de discrimination au logement ?</p>
<ul><li>A. Déposer un recours ou signaler les faits à une association</li><li>B. Seulement déménager sans rien dire</li><li>C. Rien, il n'existe aucun recours</li></ul>
</div>

<div>
<p><strong>3.</strong> Quel principe de la devise républicaine est directement mis en cause par une discrimination ?</p>
<ul><li>A. L'Égalité</li><li>B. La Liberté de circulation</li><li>C. La souveraineté nationale</li></ul>
</div>

<div>
<p><strong>4.</strong> Qu'est-ce qu'un médiateur social ?</p>
<ul><li>A. Une personne neutre qui aide à résoudre un conflit</li><li>B. Un juge qui condamne les fautifs</li><li>C. Un employé du propriétaire uniquement</li></ul>
</div>

<div>
<p><strong>5.</strong> Qui est responsable du respect du règlement intérieur d'un immeuble ?</p>
<ul><li>A. Le propriétaire, pour l'ensemble des locataires</li><li>B. Uniquement les locataires entre eux</li><li>C. Personne n'est responsable</li></ul>
</div>

<div>
<p><strong>6.</strong> Le droit au recours contre la discrimination dépend-il de la nationalité de la victime ?</p>
<ul><li>A. Non, ce droit est le même pour tous</li><li>B. Oui, seuls les Français peuvent l'exercer</li><li>C. Seulement après dix ans de résidence</li></ul>
</div>

<div>
<p><strong>7.</strong> Que signifie le mot « Fraternité » appliqué à une situation de voisinage ?</p>
<ul><li>A. Le respect et la solidarité entre voisins malgré les différences</li><li>B. L'obligation d'être ami avec tous ses voisins</li><li>C. Un principe qui ne concerne que la famille</li></ul>
</div>

<div>
<p><strong>8.</strong> Pourquoi la médiation est-elle proposée avant toute autre démarche pour le bruit ?</p>
<ul><li>A. Pour tenter une résolution amiable avant une démarche plus formelle</li><li>B. Parce que c'est la seule solution possible</li><li>C. Parce que le bruit n'est pas un problème sérieux</li></ul>
</div>
<p style="font-size:8pt;font-style:italic;color:#64748b;">Simulation pédagogique CapTCF. Les questions présentées ne préjugent pas des questions officielles de l'examen d'État.</p>$doc$ WHERE session_code = 'S05' AND document_type = 'qcm_civique';

UPDATE public.session_documents SET content_html = $doc$<h3>Corrigé QCM TCF</h3>
<ol>
<li>Pourquoi Youssef vient-il voir le médiateur ? → <strong>Un problème de bruit avec son voisin du dessus</strong><br><em>Justification : Youssef explique dès le début : « je viens vous voir pour un problème avec mon voisin du dessus, Monsieur Petit. »</em></li>
<li>Quand le bruit pose-t-il problème selon Youssef ? → <strong>Tard le soir, presque tous les jours</strong><br><em>Justification : Il précise : « Il fait beaucoup de bruit tard le soir, presque tous les jours. »</em></li>
<li>Qu'a répondu Monsieur Petit quand Youssef lui en a parlé ? → <strong>Que Youssef n'avait pas à se plaindre car il n'est pas français</strong><br><em>Justification : Youssef rapporte : « il m'a même dit que je n'avais pas à me plaindre parce que je ne suis pas français. »</em></li>
<li>Comment M. Karam qualifie-t-il ces propos ? → <strong>Une discrimination interdite par la loi</strong><br><em>Justification : M. Karam est catégorique : « ce qu'il vous a dit là est une discrimination, c'est interdit par la loi. »</em></li>
<li>Que propose M. Karam pour régler le problème de bruit ? → <strong>Organiser une rencontre en tant que médiateur neutre</strong><br><em>Justification : Il propose : « Je peux organiser une rencontre entre vous et lui, en tant que médiateur neutre. »</em></li>
<li>Que peut faire Youssef face aux propos discriminatoires ? → <strong>Déposer un recours ou signaler les faits</strong><br><em>Justification : M. Karam explique : « vous avez le droit de déposer un recours ou de signaler les faits. »</em></li>
<li>Quelle responsabilité a le propriétaire selon M. Karam ? → <strong>Faire respecter le règlement intérieur par tous les locataires</strong><br><em>Justification : M. Karam précise : « il a une responsabilité pour le respect du règlement intérieur de l'immeuble par tous les locataires. »</em></li>
<li>Que fera M. Karam dans les prochains jours ? → <strong>Recontacter Youssef pour organiser la rencontre</strong><br><em>Justification : Il conclut : « Je vous recontacte dans les prochains jours pour organiser la rencontre avec Monsieur Petit. »</em></li>
</ol>
<h3>Corrigé QCM Civique</h3>
<ol>
<li>Une discrimination fondée sur la nationalité est-elle légale en France ? → <strong>Non, elle est interdite par la loi</strong><br><em>Justification : M. Karam l'affirme sans ambiguïté : « c'est interdit par la loi, quelle que soit votre nationalité. »</em></li>
<li>Que peut faire une personne victime de discrimination au logement ? → <strong>Déposer un recours ou signaler les faits à une association</strong><br><em>Justification : Comme le confirme M. Karam à Youssef, un recours ou un signalement (notamment auprès d'une association) est possible.</em></li>
<li>Quel principe de la devise républicaine est directement mis en cause par une discrimination ? → <strong>L'Égalité</strong><br><em>Justification : La discrimination viole le principe d'égalité entre tous les citoyens, quelle que soit leur origine, pilier de la devise républicaine.</em></li>
<li>Qu'est-ce qu'un médiateur social ? → <strong>Une personne neutre qui aide à résoudre un conflit</strong><br><em>Justification : M. Karam se présente précisément comme intervenant « en tant que médiateur neutre » entre Youssef et son voisin.</em></li>
<li>Qui est responsable du respect du règlement intérieur d'un immeuble ? → <strong>Le propriétaire, pour l'ensemble des locataires</strong><br><em>Justification : M. Karam le précise : le propriétaire « a une responsabilité pour le respect du règlement intérieur de l'immeuble par tous les locataires. »</em></li>
<li>Le droit au recours contre la discrimination dépend-il de la nationalité de la victime ? → <strong>Non, ce droit est le même pour tous</strong><br><em>Justification : M. Karam insiste : la discrimination est interdite « quelle que soit votre nationalité », et le droit au recours en découle pour tous.</em></li>
<li>Que signifie le mot « Fraternité » appliqué à une situation de voisinage ? → <strong>Le respect et la solidarité entre voisins malgré les différences</strong><br><em>Justification : La Fraternité implique le respect mutuel entre citoyens, y compris entre voisins d'origines différentes, contrairement à l'attitude de M. Petit.</em></li>
<li>Pourquoi la médiation est-elle proposée avant toute autre démarche pour le bruit ? → <strong>Pour tenter une résolution amiable avant une démarche plus formelle</strong><br><em>Justification : M. Karam propose la médiation comme première étape, réservant le recours formel aux propos discriminatoires, plus graves.</em></li>
</ol>
<h3>Grille d'évaluation</h3>
<p style="font-size:9pt;color:#475569;">A1/A2 : tolérer les fautes de grammaire si le sens communicatif est préservé. B1/B2 : attendre une structure textuelle fluide et une argumentation développée.</p>$doc$ WHERE session_code = 'S05' AND document_type = 'corrige_formateur';

UPDATE public.session_documents SET content_html = $doc$<table><thead><tr><th>Mot</th><th>Définition simplifiée</th><th>Exemple</th></tr></thead><tbody>
<tr><td><strong>bail</strong></td><td>Le contrat entre un propriétaire et un locataire.</td><td><em>« Le bail précise les règles du logement. »</em></td></tr>
<tr><td><strong>locataire</strong></td><td>La personne qui loue un logement.</td><td><em>« Youssef est locataire dans cet immeuble. »</em></td></tr>
<tr><td><strong>propriétaire</strong></td><td>La personne qui possède le logement loué.</td><td><em>« Le propriétaire est responsable du règlement intérieur. »</em></td></tr>
<tr><td><strong>nuisance</strong></td><td>Une gêne causée à autrui (bruit, odeur...).</td><td><em>« Le bruit tard le soir est une nuisance. »</em></td></tr>
<tr><td><strong>voisin</strong></td><td>Une personne qui habite à côté ou au-dessus.</td><td><em>« Monsieur Petit est le voisin du dessus. »</em></td></tr>
<tr><td><strong>règlement</strong></td><td>L'ensemble des règles à respecter dans l'immeuble.</td><td><em>« Le règlement de l'immeuble interdit le bruit tardif. »</em></td></tr>
<tr><td><strong>médiation</strong></td><td>Une aide neutre pour résoudre un conflit.</td><td><em>« Le médiateur propose une médiation entre voisins. »</em></td></tr>
<tr><td><strong>discrimination</strong></td><td>Un traitement injuste fondé sur l'origine, la religion, etc.</td><td><em>« Le refus fondé sur la nationalité est une discrimination. »</em></td></tr>
<tr><td><strong>immeuble</strong></td><td>Un bâtiment avec plusieurs logements.</td><td><em>« Youssef habite dans un immeuble de six étages. »</em></td></tr>
<tr><td><strong>recours</strong></td><td>Une démarche légale pour faire valoir ses droits.</td><td><em>« Youssef peut déposer un recours contre la discrimination. »</em></td></tr>
</tbody></table>$doc$ WHERE session_code = 'S05' AND document_type = 'lexique';

UPDATE public.session_documents SET content_html = $doc$<p>Plan simple d'un immeuble avec les acteurs (locataire, propriétaire, voisin, médiateur) et une scène générique de médiation, sans image dramatique.</p>
<h3>Questions d'observation</h3>
<ol>
<li>Que représente chaque élément du schéma ?</li>
<li>Quel élément est directement lié à la situation du dialogue ?</li>
<li>Pourquoi ce thème est-il important dans la vie quotidienne en France ?</li>
</ol>
<p><em>Socle à compléter : l'illustration SVG définitive reste à produire ; ce texte décrit la scène cible.</em></p>$doc$ WHERE session_code = 'S05' AND document_type = 'support_visuel';

UPDATE public.session_documents SET content_html = $doc$<h3>Fiche pratique : que faire en cas de conflit de voisinage ?</h3>
<p>Ce document est une fiche pratique récapitulant les démarches possibles en cas de conflit de voisinage, restructurée selon la charte CapTCF.</p>
<h3>1. Nuisance (bruit, odeur...)</h3>
<p>1. Dialogue direct si possible, de façon calme.<br>2. Médiation via le propriétaire, le syndic ou un médiateur social.<br>3. Recours au règlement intérieur de l'immeuble.</p>
<h3>2. Discrimination (propos ou traitement injuste)</h3>
<p>1. Ne jamais rester seul face à la situation : en parler à un tiers.<br>2. Signaler les faits (propriétaire, association, défenseur des droits).<br>3. Déposer un recours si nécessaire.</p>
<p style="background-color:#fffbeb;border-left:3px solid #f59e0b;padding:10px;border-radius:4px;">Document pédagogique CapTCF — en cas de discrimination avérée, un recours légal est toujours possible, quelle que soit la nationalité.</p>$doc$ WHERE session_code = 'S05' AND document_type = 'document_transforme';

COMMIT;

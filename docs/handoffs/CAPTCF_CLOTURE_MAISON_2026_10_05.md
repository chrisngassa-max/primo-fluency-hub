# CapTCF — clôture maison et préparation de transmission, 5 octobre 2026

## État vérifié avant clôture

Dépôt : D:\sites\tcf pro. Branche : captcf-p0-6-attempt-sync-queue-diagnostic.
Réception : d4b12d3e27db1622ea0c780a9c69a6415d669229, commit d'enveloppe ; son CAPTCF_REPRISE.json désigne le SHA métier d'origine 47fdfff4827487c3253927aba0a925e1c7aac1b4.
Au début de cette clôture : HEAD inchangé depuis la réception, aucun commit supplémentaire, aucune modification suivie, index vide. Les trois fichiers P0.5/P0.6 reçus sont déjà suivis. Aucun correctif P0.7 réalisé ici.
124 fichiers non suivis préexistants, à ne pas indexer. Inventaire local SHA-256 hors dépôt établi sur 288 fichiers (non suivis et fichiers ignorés des emplacements privés protégés). Stash historique conservé : 14bc1ec08b9da5b7b52bbf85695a6e8442a8ee98, sauvegarde-avant-recevoir-2026-09-27.
Louise : B880B3C77F980676858BA05E71E7F3D435E1D8074A633B248D9CE90503D102DB, vérifié conforme.

## Travail réalisé depuis la réception

Audit pédagogique CapTCF pour 10 séances de 3 heures, groupe de 6 à 8 adultes majoritairement objectif A2. Lecture du code et contrôles agrégés Supabase le 4 octobre ; aucune mutation, passation, génération, correction IA, migration ou publication. Ce document préserve les conclusions jusque-là seulement présentes dans la conversation.

Réutiliser les groupes, profils, banque, métadonnées V4 et liste d'activités du pilote. Attribution individuelle implémentée dans SessionPilot.tsx ; commandes Tester/Cloner/Assigner dans SessionPlaylistPanel.tsx. Pas de nouveau système proposé.

Constats datés du 4 octobre, non recontrôlés à distance pendant la clôture :
- 815 exercices ; 28 au statut published, mais validation_status draft ou rejected : ne pas assimiler publication et validation pédagogique. 7 familles publiées reliées à un exercice ; 16 types d'erreur.
- readiness_snapshots, routing_decisions et session_templates_v4 vides. Les mécanismes existent, leur usage effectif n'est pas démontré.
- Test historique : arrêt d'un palier puis passage à la compétence suivante ; profil final plafonné A1_maitrise. Chargement de toutes les questions du palier et seuil fixe de deux points : ne pas présenter cela comme un test A2 normalisé.
- Second positionnement : un test publié de 20 items (8 CE, 8 CO, 2 EE, 2 EO), pas d'EO A2 ; EO saisie en texte ; score-placement-test appelé par l'interface mais absent de l'inventaire distant obtenu.
- Diagnostic individuel formateur enregistrable sans analyse IA ; son upsert remplace les valeurs par sous-compétence. Préserver séparément l'entrée datée avant une nouvelle saisie.
- Banque-first peut compléter les manques avec une IA. Seances.tsx appelle prepareSessionKit sans condition sur le commutateur d'automatisation ; générations et devoirs de la séance précédente possibles. Commutateur OFF seul insuffisant pour garantir zéro IA.
- hint_used est conservé pour certains exercices ; non repris dans les rapports/readiness examinés. Aide du formateur à noter séparément. Réussite aidée non équivalente à réussite autonome.
- Devoirs automatiques pouvant recopier des exercices déjà travaillés : pas une preuve de transfert. Durées pédagogiques estimées, non garanties.
- La garde active exercise_attempts référence une colonne absente : constat de catalogue reconfirmé le 4 octobre, sans nouvelle soumission. Voir le diagnostic P0.6.
- Conversions internes vers des valeurs appelées score TCF dans _shared/tcf-routing-referential.ts : exclure ces valeurs de toute conclusion officielle. Saisie dédiée des résultats TCF réels non identifiée.
- SHA servi par le site public non rapproché du HEAD local. Les routes présentes ne constituent pas une recette interactive.

## Deux pilotes à préparer, pas à envoyer automatiquement

Pilote 1 : quotidien et présentation, CO principale / EO secondaire.
Pilote 2 : rendez-vous et messages, CE principale / EE secondaire.
Thème commun, vocabulaire et expressions, supports oraux/écrits, variantes guidées et autonomes. Répartition indicative de 150 minutes d'apprentissage : 100 minutes principale, 50 secondaire ; 15 minutes pause, 15 installation/bilan. Le diagnostic initial remplace une partie des ateliers et constitue une exception annoncée au ratio.
Préparer des devoirs manuels de 5/10/15 minutes, corrigés et reprise à la séance suivante ; réserver des tâches nouvelles comparables pour la sortie. Conserver date, production, aide et critères de réussite. Aucun objectif officiel déduit d'une moyenne interne.
Repères FEI version Q septembre 2026 fournis par le propriétaire, non relus indépendamment (accès officiel refusé) : trois compétences minimum A2, quatrième haut A1 sans seuil numérique inventé ; EE 30–60 / 40–90 / 40–90 mots ; EO sans préparation en test. Respecter le format ne garantit pas le niveau. Civique hors périmètre.
Avant exécution réelle : maîtriser les automatismes et vérifier la sauvegarde. Trois besoins minimaux recensés, non implémentés : respecter le mode sans génération ; réparer sauvegarde/retour d'état ; exploiter la trace d'aide existante.

## P0.5/P0.6 et limites de validation

Handoffs P0.5 et P0.6 entièrement relus. Leurs résultats sont historiques, non réexécutés aujourd'hui : P0.5 rapporte 41 cas serveur ; P0.6 rapporte 128 tests de non-régression verts et un test diagnostic volontairement rouge avec trois témoins verts. Aucune prétention de suite entièrement verte.
Tests/build non relancés pendant cette clôture : aucun code ni test modifié, changement exclusivement documentaire. git diff --check à contrôler avant commit. Ne pas inventer un correctif pour rendre vert le diagnostic.
Contrat P0.7 conservé : A et C séparés ; B conception uniquement ; cible pourcentage [0,100], unité producteur attestée, aucune conversion implicite de 1, aucun backfill. Aucune Phase B distante autorisée ici.

## Transmission : préflight, pas attestation de succès

Le raccourci Bureau pointe vers Documents\CapTCF-Sync\sync-captcf.ps1, version ancienne avec paramètre RepoPath, sans la ligne RESULTAT exigée. La version tools\sync-captcf.ps1 du clone captcf-private-assets expose RepoRoot et les marqueurs attendus. Son utilisation directe sans modifier le raccourci a été soumise au propriétaire.
La transmission n'est acquise qu'après RESULTAT: transmettre termine, correspondance METIER_HEAD avec le HEAD final et contrôle distant du commit sync. Ce document ne certifie pas ces opérations à l'avance.
Les fichiers privés restent locaux ; seul Louise figure dans la whitelist du dépôt privé. Les autres audios, packs, preuves et fichiers locaux ne sont pas promis au portable par Git.
Aucun push main, fusion, PR, migration, mutation Supabase ou déploiement autorisé. Ne pas modifier les scripts de synchronisation dans cette mission. Si protection temporaire nécessaire : stash --include-untracked identifié, appliquer uniquement celui-ci puis comparer toutes les empreintes avant suppression ; conserver le stash historique.

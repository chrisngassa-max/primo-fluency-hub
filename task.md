# Lot 0 - Suivi

- [x] Auditer la migration et les Edge Functions.
- [x] Corriger les index, RLS, destinataires et l'idempotence de la RPC.
- [x] Extraire et tester la logique pure des Edge Functions.
- [x] Rendre la migration rejouable avant son premier deploiement.
- [x] Ajouter les runners SQL et concurrence sur le code reel.
- [x] Interdire les tests et la generation des types sur la production.
- [x] Ajouter un rollback de production non destructif.
- [x] Aligner localement les types TypeScript sur le schema du lot 0.
- [x] Verifier en lecture seule que la migration n'est pas appliquee a distance.
- [x] Executer Vitest, le build, ESLint cible et `git diff --check`.
- [x] Verifier le refus des runners sur la reference de production.
- [ ] Reconciler les migrations distantes absentes du depot local.
- [ ] Executer les tests SQL et concurrence sur Supabase local ou staging.
- [ ] Regenerer officiellement les types depuis l'environnement valide.
- [ ] Deployer la migration et les Edge Functions apres validation explicite.

# Lot 2 - Limites de generation

- [x] Permettre de choisir entre 1 et 30 exercices.
- [x] Ajouter les niveaux A0, A1, A2, B1 et B2.
- [x] Conserver une difficulte reglable de 1 a 10 jusque dans la validation.
- [x] Ajouter une duree cible de 1 a 60 minutes par exercice.
- [x] Generer les gros volumes par lots stables avec une seconde tentative.
- [x] Limiter les destinataires du mode direct au groupe de la seance.
- [x] Respecter le nombre retrospectif choisi sans reduction silencieuse.
- [x] Afficher un avertissement lorsque la duree retrospective est trop courte.
- [x] Valider le lot avec Vitest, ESLint, build et verification du diff.

# Lot 3 - Profil andragogique

- [x] Ajouter les informations linguistiques, scolaires et numeriques.
- [x] Ajouter le projet personnel, l'objectif et la date cible TCF.
- [x] Ajouter les preferences d'apprentissage et besoins d'accessibilite.
- [x] Permettre l'edition par l'eleve et son formateur via une RPC limitee.
- [x] Interdire la modification indirecte des scores et niveaux par l'eleve.
- [x] Utiliser le profil pour choisir formats, aides, consignes et contextes.

# Lot 4 - Routage pedagogique explicable

- [x] Centraliser les recommandations dans ExerciseRouter.
- [x] Expliquer chaque proposition au formateur.
- [x] Permettre de modifier, accepter ou refuser.
- [x] Pre-remplir le generateur cible depuis la recommandation.

# Lot 5 - Devoirs individualises et actions rapides

- [x] Supprimer le compte a rebours d'envoi implicite.
- [x] Ajouter les modes recommandation, validation et automatique autorise.
- [x] Memoriser le mode d'envoi au niveau du groupe.
- [x] Choisir les destinataires, l'echeance et le volume.
- [x] Ajouter un raccourci bonus pour les eleves ayant termine.

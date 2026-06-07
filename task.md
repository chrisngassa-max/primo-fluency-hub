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

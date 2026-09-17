# Règle de contribution — nouvelles tables / policies (CAPTCF Lot 0.7)

Toute migration qui crée une table `public` doit :

1. **Déclarer explicitement les `GRANT`** (pas de dépendance aux DEFAULT PRIVILEGES).
2. **`REVOKE` les privilèges dangereux de `anon` et `PUBLIC`** sur la table (et séquences liées) — obligatoire tant que `supabase_admin` conserve des DEFAULT PRIVILEGES latents vers `anon`.
3. **Activer RLS** si la table porte des données métier / identité / scores / productions.
4. **Créer les policies avec `TO` explicite** (`authenticated`, `service_role`, ou `anon` seulement si parcours public prouvé) — jamais s’appuyer sur le rôle `{public}` implicite.
5. **Interdire** `USING (true)` / `WITH CHECK (true)` sauf `TO service_role` documenté.
6. **Passer le contrôle sécurité** :

```bash
node scripts/security/assert-lot07-future-guards.mjs
node scripts/security/assert-no-insecure-account-bootstraps.mjs
```

Les fonctions de bootstrap / création de comptes (`bootstrap-test-accounts`, `create-formateur-account`) restent stubs **410** avec `verify_jwt = true` dans `supabase/config.toml`.

Échec du contrôle = merge bloqué. Correction DEFAULT PRIVILEGES système = ticket support Supabase uniquement (pas de `SET ROLE`).

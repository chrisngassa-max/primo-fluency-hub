# CAP TCF

## Mode Sandbox

Le panneau formateur est accessible depuis `/#/formateur/sandbox` (l'alias
`/#/sandbox` redirige vers cette page).

1. Cliquer sur **Creer mon environnement sandbox**.
2. Noter ou telecharger les quatre identifiants affiches une seule fois.
3. Utiliser **Lien rapide** pour generer une connexion eleve.
4. Ouvrir le lien dans un onglet prive sur le PC ou sur le telephone.
5. Utiliser les trois niveaux de reinitialisation selon le test effectue.

### Apercu multi-profils sur un seul appareil

Le bandeau sandbox propose :

```text
Formateur | A1 | A2 | B1 | B2 | Mosaique
```

Le changement de vue ne remplace pas la session formateur. Le navigateur
envoie uniquement le niveau choisi ; les Edge Functions retrouvent et
verifient elles-memes le compte eleve rattache a la sandbox active.

La vue eleve integree permet actuellement de consulter le tableau de bord,
les devoirs et de tester les exercices QCM ou vrai/faux. La mosaique compare
les quatre profils avec un seul appel agrege. Les productions audio et les
corrections IA restent a tester avec les liens magiques dans cette premiere
version.

Les comptes A1, A2, B1 et B2, leur groupe, leurs sessions, devoirs et
resultats portent tous un `sandbox_session_id`. Les suppressions sont limitees
a la session du formateur authentifie. Les mots de passe initiaux ne sont
stockes ni dans Supabase ni dans `localStorage`.

### Expiration

Une session expire apres 24 heures. Le bouton **Prolonger de 24h** renouvelle
la duree. Une session expiree peut etre reactivee sans recreer les comptes.

### Connexion mobile

Dans Supabase Dashboard, ouvrir **Authentication > URL Configuration** et
ajouter aux **Redirect URLs** les origines utilisees par l'application, par
exemple :

```text
http://localhost:8080/**
https://captcf.fr/**
https://www.captcf.fr/**
https://<votre-preview>.vercel.app/**
```

Sans cette configuration, un lien magique peut echouer ou rediriger vers une
URL incorrecte sur mobile. La duree effective du lien depend aussi de la
configuration OTP de Supabase Auth.

TODO: Document your project here

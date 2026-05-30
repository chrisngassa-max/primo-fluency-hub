## Objectif
Sauvegarder localement **tous les fichiers** des 6 buckets Storage de Lovable Cloud avant la migration vers ton Supabase externe.

## Approche
Pas de modification de code dans l'app. J'exécute un script Python côté sandbox qui :

1. Se connecte à ton backend Cloud avec la `SUPABASE_SERVICE_ROLE_KEY` (déjà disponible dans l'environnement) — nécessaire pour lire les buckets privés.
2. Pour chaque bucket (`test-audio`, `exercise-images`, `external-resource-screenshots`, `exercise-reports`, `interventions-audio`, `bilans-pdf`) :
   - Liste récursivement tous les fichiers (avec pagination, pas de limite à 100).
   - Télécharge chaque fichier en conservant l'arborescence.
3. Génère un **manifeste CSV** (`manifest.csv`) listant : bucket, chemin, taille, date de création, type MIME — pratique pour vérifier l'intégrité après import dans ton nouveau Supabase.
4. Compresse le tout dans une archive ZIP unique : `storage-backup-captcf-YYYYMMDD.zip`.
5. Dépose l'archive dans `/mnt/documents/` et te fournit un bouton de téléchargement direct (`<presentation-artifact>`).

## Livrables
- `storage-backup-captcf-YYYYMMDD.zip` contenant :
  ```
  test-audio/...
  exercise-images/...
  external-resource-screenshots/...
  exercise-reports/...
  interventions-audio/...
  bilans-pdf/...
  manifest.csv
  ```
- Un récapitulatif dans le chat : nombre de fichiers et taille totale par bucket.

## Détails techniques
- Téléchargement parallèle (8 workers) pour aller vite.
- Gestion d'erreurs : les fichiers en échec sont logués dans `manifest.csv` avec un statut, pas d'arrêt global.
- Pas d'écriture, pas de migration, pas de changement BDD — opération **strictement lecture seule** sur Storage.
- Si l'archive dépasse ~500 Mo, je te propose un split par bucket (un ZIP par bucket).

## Réutilisation après migration
Le même script peut être réadapté en mode **upload** vers ton nouveau Supabase pour réimporter les fichiers à l'identique (chemins préservés). On le fera dans un second temps, après que le support Lovable ou toi-même aurez migré la base.

Valide ce plan et je lance la sauvegarde.
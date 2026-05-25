# Banque d'activités pédagogiques

Cette base rend les activités FLE extraites des PDF Wilson consultables en continu par l'application et par les fonctions Supabase.

## Table

La migration `20260525090000_create_pedagogical_activities.sql` crée :

- `public.pedagogical_activities` : table source des activités.
- Index par catégorie, niveau CECR, durée, tags, source PDF et recherche plein texte française.
- RLS en lecture publique, comme les référentiels pédagogiques déjà présents.
- `public.search_pedagogical_activities(...)` : fonction de recherche filtrable.

La migration `20260525091000_create_pedagogical_documents.sql` ajoute :

- `public.pedagogical_documents` : métadonnées des PDF sources.
- `public.pedagogical_extraction_errors` : journal des PDF non intégrés à cause d'une erreur d'extraction.
- `public.search_pedagogical_documents(...)` : recherche filtrable sur les sources.

## Import

Source activités par défaut :

```text
D:/formations/tcf/docs/master_activities.json
```

Commande :

```powershell
$env:SUPABASE_URL="https://..."
$env:SUPABASE_SERVICE_ROLE_KEY="..."
npm run import:pedagogical-activities
```

Avec un autre fichier JSON :

```powershell
npm run import:pedagogical-activities -- "D:/chemin/activities.json"
```

Validation locale sans écrire en base :

```powershell
npm run import:pedagogical-activities -- --dry-run
```

Importer les métadonnées des PDF sources et le journal d'erreurs depuis toute la racine documentaire :

```powershell
npm run import:pedagogical-documents
```

Racine par défaut :

```text
D:/formations/tcf/docs
```

Validation locale :

```powershell
npm run import:pedagogical-documents -- --dry-run
```

## Exemples de recherche SQL

```sql
select *
from public.search_pedagogical_activities(
  p_query => 'présentation de soi',
  p_level => 'A1',
  p_max_duration => 45,
  p_limit => 10
);
```

```sql
select *
from public.search_pedagogical_activities(
  p_level => 'A1',
  p_category => 'production orale',
  p_tags => array['présentation'],
  p_limit => 10
);
```

```sql
select *
from public.search_pedagogical_documents(
  p_query => 'présentation français langue étrangère',
  p_level => 'A1',
  p_limit => 10
);
```

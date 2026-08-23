# Curriculum v2 — Cloud production pipeline

Everything runs in the cloud. No local batch jobs.

## 1. GitHub secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret                       | Required | Purpose                                                       |
| ---------------------------- | -------- | ------------------------------------------------------------- |
| `SUPABASE_URL`               | ✅       | Project URL, e.g. `https://xxxx.supabase.co`                  |
| `SUPABASE_SERVICE_ROLE_KEY`  | ✅       | Service-role key (server-side only, never expose in client)   |
| `ANTHROPIC_API_KEY`          | ⭕       | Enables Claude for text generation. Fallback = `fake` provider |
| `GOOGLE_TTS_API_KEY`         | ⭕       | Enables real TTS audio. Fallback = silent placeholder MP3     |

You also need a **Personal Access Token** with `repo` scope so the
`curriculum-batch` edge function can fire `repository_dispatch`:

- Create a fine-grained PAT with **Actions: read/write** on this repo.
- In **Supabase → Edge Functions → curriculum-batch → Secrets**, add:
  - `GITHUB_TOKEN` = the PAT
  - `GITHUB_REPO`  = `chrisngassa-max/primo-fluency-hub`

## 2. Vercel environment variables

Vercel project → **Settings → Environment Variables** (Production + Preview):

| Variable                        | Value                                              |
| ------------------------------- | -------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Same as `SUPABASE_URL`                             |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The `sb_publishable_…` anon/publishable key       |

Redeploy after adding them.

## 3. Supabase Storage buckets

The worker writes generated resources here. Create them once from **Supabase
Dashboard → Storage → New bucket** (or via SQL):

| Bucket                   | Public | Notes                                   |
| ------------------------ | ------ | --------------------------------------- |
| `curriculum-drafts`      | ❌     | Working batch outputs before validation |
| `curriculum-published`   | ✅     | Read-only public assets consumed by app |
| `curriculum-audio`       | ✅     | TTS-generated MP3s                      |

RLS on the tables `training_plan_versions`, `resource_generation_batches`,
`resource_generation_jobs`, `session_resources`, `validation_reports`,
`curriculum_publications` is already applied via the migration
`20260705220000_curriculum_v2_foundations.sql`.

## 4. How it flows

1. Formateur opens **Production Parcours** in the app → *Start batch*.
2. The `curriculum-batch` edge function inserts a row in
   `resource_generation_batches` and fires
   `repository_dispatch` (`event_type: curriculum-batch`,
   `client_payload: { batch_id }`) on this repo.
3. GitHub Actions runs `.github/workflows/curriculum-worker.yml`, which
   executes `npm run curriculum:worker`
   (`scripts/curriculum/run-supabase-batch.mjs`) with `BATCH_STORE=supabase`
   and `STORAGE_PUBLISHER=supabase`.
4. Worker reads jobs from Supabase, generates assets (Claude / Google TTS or
   fake/svg fallback), uploads to the buckets above, updates job statuses.
5. UI reflects progress live (BatchProgress polls
   `resource_generation_jobs`). *Resume* re-invokes the same worker.
6. Once validated, *Publish* writes to `curriculum_publications` — the
   production app reads only from there.

## 5. Deploy edge function

After changing `supabase/functions/curriculum-batch/`, redeploy from a machine
with the Supabase CLI linked to your project:

```bash
supabase functions deploy curriculum-batch
```

Ensure `GITHUB_TOKEN` and `GITHUB_REPO` are set under **Supabase → Edge Functions
→ curriculum-batch → Secrets** before testing a batch start from the UI.

## 6. Fallbacks

- `ANTHROPIC_API_KEY` missing → `provider=fake` (deterministic stub text)
- `GOOGLE_TTS_API_KEY` missing → `provider=svg`/silence placeholder audio
- Interrupted batch → click *Resume* in the UI, or run the workflow manually
  from **Actions → curriculum-worker → Run workflow** with the batch ID.

## 7. Cron safety net

The workflow also runs every 5 minutes to pick up any batch whose dispatch
was missed (e.g. edge function timeout). It is a no-op when there are no
pending jobs.

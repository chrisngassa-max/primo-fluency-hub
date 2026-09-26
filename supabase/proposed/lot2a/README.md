# CAPTCF Lot 2A — proposed artefacts (NOT applied)

**Do not move these files into `supabase/migrations/` until the owner authorizes each sous-lot.**

| File | Purpose |
|---|---|
| `01_has_role_canonical.sql` | Idempotent align to `has_role(uid, target_role)` |
| `01_has_role_canonical_ROLLBACK.sql` | Emergency rename back to `_user_id,_role` |
| `02_public_to_authenticated_scoped_TEMPLATE.sql` | Pattern only |
| `02b_public_to_authenticated_scoped_FULL.sql` | B1 — 90 scoped `{public}` → `TO authenticated` |
| `02b_…_ROLLBACK.sql` | Restore TO public |
| `03_public_service_destined_to_service_role_FULL.sql` | B2 — 13 service-destined |
| `03_…_ROLLBACK.sql` | Restore |
| `04_public_has_role_profiles_to_authenticated_FULL.sql` | B3 — 3 profiles has_role |
| `04_…_ROLLBACK.sql` | Restore |
| `05_public_hygiene_misc_to_authenticated_FULL.sql` | B4 — 1 misc |
| `05_…_ROLLBACK.sql` | Restore |
| `06_EDGE_CALLERS_FIX_NOTES.md` | Edge deploy notes (no DB) |

Sandbox RESTRICTIVE (6): **never** included in DROP/convert sous-lots.

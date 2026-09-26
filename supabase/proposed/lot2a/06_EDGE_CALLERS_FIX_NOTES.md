# Lot 2A — Edge `has_role` callers fix (Phase B, not executed)

**Remote contract (verified):** `rpc('has_role', { uid, target_role })`

## Broken (legacy) — must change in same deploy window

| Function | Current keys | Required |
|---|---|---|
| `approve-student` | `_user_id`, `_role` | `uid`, `target_role` |
| `create-student` | `_user_id`, `_role` | `uid`, `target_role` |
| `curriculum-adapt` | `_user_id`, `_role` | `uid`, `target_role` |
| `curriculum-batch` | `_user_id`, `_role` | `uid`, `target_role` |
| `reset-student-password` | `_user_id`, `_role` | `uid`, `target_role` |
| `update-student-credentials` | `_user_id`, `_role` | `uid`, `target_role` |

## Already aligned — do not regress

hash / transcribe / generate / publish / analyze pedagogical ; `resolve-exercise-audio-handler`

## Success criteria

1. `node scripts/security/assert-lot2a-has-role-callers.mjs --strict` → exit 0  
2. Manual smoke: formateur can call create-student / approve-student / curriculum-* without false 403 from null `has_role`  
3. No DB migration required if remote already `uid/target_role` (only Edge redeploy)

## Stop criteria

Any function still sending `_user_id`/`_role` after deploy → rollback Edge revision.

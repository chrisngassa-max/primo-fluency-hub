# CapTCF A2 Audio — V1 provisional transcription policy

## Decision (pilot)

CapTCF V1 uses **Gemini full-file transcription** as the provisional provider for pedagogical audio sources.

- Gemini is **provisional for pilot V1 only**.
- Transcription **must be trainer-reviewed** (`status = reviewed`). `ready` alone is never enough.
- Timestamps are **approximate and always `timestamp_status = unverified`**. They must never be marked verified.
- Google Cloud Storage + `longrunningrecognize` + service account remain a **future improvement plan**, not developed now.
- Synchronous multi-chunk MP3 chopping for `speech:recognize` remains **forbidden** (`STT_CHUNKING_NOT_CANONICAL`).

## Offset conservation vs filtering

Persisted segment `start_ms` / `end_ms` stay **exactly** as Gemini provided them: never clamped, shifted, recalculated, or rewritten.

Two distinct metadata fields:

| Field | Meaning |
| --- | --- |
| `transformations_applied` | Offset mutations only. Empty `[]` means no start/end rewrite. |
| `filtering_applied` | Row-level drops of technically invalid segments (`end_ms <= start_ms`, empty text, non-integer/negative starts, etc.). |

When filtering drops rows, `provider_parameters` also records:

- `raw_segment_count`
- `persisted_segment_count`
- `dropped_segment_count`
- `dropped_segment_reasons`

Invalid intervals are **never persisted**. Do not present empty `transformations_applied` as “integral conservation without any loss” when drops occurred — report filtering metrics separately.

## Product rules

1. Unreviewed transcription remains **blocking** for generation/publish.
2. Trainer-reviewed transcription may feed generation after analysis.
3. `DIFF_TRANSCRIPTION_TIMESTAMPS_UNVERIFIED` is a **warning** (not blocking) only when **all** of these are true server-side:
   - transcription `status = reviewed` (**not** `ready`)
   - source `status = analyzed`
   - source `review_status` in `utilisable` \| `valide`
   - `content_hash` present
   - `source_content_hash` coherent with the family
   - original MP3 still present (`storage_bucket` + `storage_path`)
   - factual textual/chunk provenance present on required facts
4. When `timestamp_status != verified`:
   - no UI button may auto-launch a precise passage
   - no screen may present the interval as certain proof
   - trainer may listen to the **full original MP3**
   - learner listens to the **full original MP3** (existing listen limits)
5. Verified timestamps (future dedicated STT) may re-enable extract navigation.
6. Never reconstruct or rewrite provider offsets of persisted segments.
7. Publish still fails on missing/stale hash, missing MP3, unreviewed transcription, or unapproved source.

## Learner experience

The student hears the original MP3. Approximate timestamps must not be presented as certain proof. Precise extract listen is disabled for unverified timestamps.

## Backlog

- EU Google Speech V1 `longrunningrecognize` with private GCS + service account OAuth
- Silence-aware verified timestamp policy for dedicated STT
- Re-enable extract navigation only when `timestamp_status = verified`

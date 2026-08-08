# CapTCF A2 Audio Vertical Slice - Status and Next Steps

## Scope

This handoff captures the status of the CapTCF A2 audio vertical slice in the worktree `C:\Users\Sofiane\Documents\New project\primo-a2-cursor`, on branch `cursor/a2-audio-continuation`.

It is intended for an engineer or PM who needs to understand what is already operational, what remains incomplete, and how to close the remaining work without reopening the core architecture.

## Current status

The A2 audio vertical slice is operational end to end.

An authenticated trainer/admin flow has already been exercised from MP3 upload through server-side hashing, transcription, human review, pedagogical analysis, A2 differentiation-family generation, validation, and guarded publication into exercises. The core implementation, database foundations, deployed Supabase functions, and supporting UI/workflow are already in place on this branch lineage, and PR `#27` exists for the main delivery.

The remaining work is not about making the slice functional. It is mainly about closing two partial evaluation/documentation tracks:

- `Partial`: STT benchmark completion and formal multi-provider decision matrix.
- `Partial`: formal pedagogical experimentation across multiple contrasting audio inputs.

## Delivery checklist

- `Done` Core A2 audio vertical-slice implementation.
- `Done` Supabase migrations applied to the target database.
- `Done` Required Supabase Edge Functions deployed.
- `Done` Authenticated MP3 end-to-end workflow completed.
- `Done` PR `#27` created for the delivered slice.
- `Partial` STT benchmark package, ADR scaffold, and decision process preparation.
- `Partial` Pedagogical validation beyond the initial successful vertical-slice run.
- `Not started` Final closure memo that converts the two partial items into explicit go/no-go outcomes.

## What has been completed

### Product slice

- Audio-source handling was added for the A2 workflow.
- Server-side hashing is part of the operational flow.
- Transcription support is integrated into the implemented slice.
- Trainer review handling exists, including stale-review invalidation.
- Validated A2 differentiation-family generation is implemented.
- Publication into exercises is guarded and included in the slice.

### Data and backend

- The audio transcription foundation migration was applied.
- The differentiation-family slice foundation migration was applied.
- The target database therefore has the schema required for the vertical slice already in place.

### Supabase functions

The following Edge Functions were deployed for the delivered workflow:

- `hash-pedagogical-source`
- `transcribe-pedagogical-source`
- `analyze-pedagogical-source`
- `generate-differentiation-family`
- `publish-differentiation-family`

### Verification already achieved

- Repository tests passed during the implementation cycle (`npm test`: 61 files / 385 tests).
- Production build passed (`npm run build`).
- Authenticated MP3 E2E was completed with a trainer/admin session.
- The E2E path covered upload -> hash -> transcribe -> review -> analyze -> generate A2 family -> validate -> publish.
- The required transcription secret was confirmed to exist in the Edge Function environment during that delivery cycle.

## What remains open

### 1. STT benchmark and provider decision remain partial

The repository already contains benchmark scaffolding and an ADR, but the provider decision is not formally closed.

What is already present:

- Provider-neutral benchmark harness in `scripts/stt-benchmark/`
- Canonical result schema
- Benchmark tests
- ADR `docs/architecture/adr/ADR-001-stt-provider.md`

What is still missing:

- A rights-cleared, representative real-audio corpus
- Human reference transcripts for that corpus
- Equivalent benchmark runs across the candidate providers
- A published comparison matrix covering quality, timestamps, latency, cost, GDPR/retention, integration effort, and fallback
- An ADR update from provisional/blocked state to an accepted decision

Important nuance: the slice may currently use a working transcription path, but the formal multi-provider decision record is still incomplete.

### 2. Formal pedagogical experimentation remains partial

The slice has been proven operational through at least one authenticated MP3 E2E run, but the broader pedagogical validation expected for closure has not been fully documented.

What is still missing:

- Running the workflow on multiple contrasting real audio inputs
- Structured review by pedagogy/trainer stakeholders across those runs
- Aggregated feedback and error patterns
- A documented go/no-go conclusion for broader rollout or expansion

This means the product slice works, but the evidence base for pedagogical robustness is still limited.

## Risks and assumptions

- The current operational transcription path should not be mistaken for a formally accepted long-term STT provider decision.
- The absence of a representative benchmark corpus means quality trade-offs may still be under-measured for accents, noise, numbers, timestamps, and multiple speakers.
- A successful single-slice or low-sample E2E result does not yet prove pedagogical consistency across contrasting audio types.
- This handoff assumes the deployed functions and applied migrations referenced in PR `#27` remain the intended baseline for continuation work.
- No secrets are recorded here; environment validation must continue via the existing secret-management process.

## Recommended implementation plan

### Phase 1 - Close the STT decision track

1. Assemble 4 to 6 rights-cleared audio files covering contrasting pedagogical cases: clean dialogue, practical message, multiple speakers, non-native French, numbers/time expressions, and moderate background noise.
2. Produce a human reference transcript and critical-token checklist for each file.
3. Run the existing benchmark harness against the approved provider panel.
4. Publish a concise decision matrix with:
   - verbatim quality / WER or equivalent
   - critical-token recall
   - timestamp usefulness
   - speaker handling
   - latency
   - cost
   - GDPR / retention posture
   - Supabase integration complexity
   - fallback option
5. Update `docs/architecture/adr/ADR-001-stt-provider.md` to a final accepted state, or explicitly narrow the provider panel if full comparison is not feasible.

### Phase 2 - Close the pedagogical experimentation track

1. Select the same or overlapping contrasting audio set for pedagogical review.
2. Run the full implemented workflow on each audio.
3. Capture, for each run:
   - transcription review effort
   - analysis quality
   - generated A2 item quality
   - validation outcomes
   - publication readiness
   - trainer/pedagogy feedback
4. Summarize repeated failure modes or correction patterns.
5. Publish a short audit/handoff addendum under `docs/audits/` or `docs/handoffs/` with a recommendation:
   - proceed as is
   - proceed with guardrails
   - hold expansion pending fixes

### Phase 3 - Formal closure

1. Link the benchmark outcome, pedagogical review outcome, and PR `#27`.
2. Record whether the A2 slice is considered:
   - operational only
   - operational and pedagogically validated
   - ready to generalize to adjacent levels/modalities
3. Keep any follow-up scope separate from this slice closeout to avoid broad architectural churn.

## Verification status

- `Verified done`: core functional vertical slice exists and has already passed an authenticated MP3 E2E.
- `Verified done`: migrations were applied.
- `Verified done`: required Edge Functions were deployed.
- `Verified done`: tests and build passed during the delivery cycle captured in PR materials.
- `Verified partial`: benchmark harness and ADR exist, but the provider decision is not closed.
- `Verified partial`: pedagogical experimentation expectations are defined, but formal multi-audio evidence is still incomplete.

## References

- Branch context: `cursor/a2-audio-continuation`
- Worktree: `C:\Users\Sofiane\Documents\New project\primo-a2-cursor`
- Delivery PR: `#27`
- Original implementation plan: `docs/architecture/captcf-a2-vertical-slice-v1-implementation-plan.md`
- STT ADR: `docs/architecture/adr/ADR-001-stt-provider.md`
- Benchmark harness: `scripts/stt-benchmark/README.md`
- PR summary artifact: `pr27-body.md`

## Pickup summary

If you are continuing this work, do not re-implement the A2 audio slice from scratch. Treat the slice as already operational, then close the remaining benchmark and pedagogical-evaluation items with lightweight, decision-oriented documentation and evidence.

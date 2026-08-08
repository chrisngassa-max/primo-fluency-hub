# ADR-001 - STT provider for the A2 Vertical Slice

- Date: 2026-07-27
- Status: blocked on a representative corpus and provider access
- Decision owners: CapTCF product, pedagogy, and engineering

## Context

The A2 Vertical Slice requires faithful French transcription, timestamped segments, and traceability from every question back to its audio evidence. The repository currently uses synchronous Google `speech:recognize`, which is unsuitable for long documents. Gemini already powers pedagogical analysis, but it must not become the canonical transcription source without empirical comparison.

## Benchmark candidates

1. Google Cloud Speech-to-Text long-running or batch processing.
2. A current OpenAI transcription model, including the diarization option.
3. Gemini native audio as the multimodal comparator.

All outputs must be converted to `scripts/stt-benchmark/canonical-result.schema.json`.

## Mandatory gates

- WER at or below the approved threshold;
- complete recall of pedagogically critical tokens;
- valid timestamps with sufficient temporal coverage;
- documented speaker behavior;
- acceptable data retention and GDPR terms;
- realistic integration from Supabase;
- latency and cost measured on identical files.

Hours, numbers, negations, and proper names take priority over stylistic fluency.

## Verified repository state on 2026-07-27

- The only versioned `.mp3` starts with `FAKE-MP3::` and is not usable audio.
- No real, annotated, representative corpus exists in the repository.
- The local environment exposes Gemini configuration, but no OpenAI or Google STT access suitable for a fair comparison.
- The provider-neutral harness, metrics, schema, and synthetic fixtures are ready.

These limits prevent an honest provider decision. This ADR therefore selects no provider yet.

## Provisional decision

Ticket 0 is technically prepared but remains **blocked**. Provider-independent tickets may continue. Definitive Ticket 3 integration must not start until:

1. 4 to 6 rights-cleared real audio files are supplied;
2. human transcripts and critical tokens are supplied;
3. secure access to all candidates is available, or the panel is explicitly reduced;
4. the same manifest is run for every candidate and a comparison report is published;
5. this ADR is updated to `Status: accepted`.

## Consequences

- No provider adapter or secret is added yet.
- Audio containing personal data stays in private, Git-ignored storage.
- Gemini remains the existing pedagogical analysis engine; this does not predetermine the canonical STT provider.
- Google batch processing may require intermediate GCS storage; that architectural cost belongs in the decision.
- OpenAI must demonstrate timestamp granularity sufficient for question-to-fact-to-segment traceability.

## Initial thresholds requiring pedagogical approval

The example manifest values (`WER <= 0.12`, `100%` critical-token recall, `>= 90%` timestamp coverage) are benchmark hypotheses, not yet approved production requirements.

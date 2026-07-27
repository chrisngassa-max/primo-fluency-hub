# CapTCF STT benchmark

This folder compares transcription results already obtained from multiple providers. It intentionally contains no provider adapter and no secret.

## Prepare the corpus

Create locally, without committing personal data:

- 4 to 6 rights-cleared audio files;
- one human reference transcript per audio file;
- critical tokens such as times, dates, numbers, and proper names;
- provider outputs converted to `canonical-result.schema.json`.

The corpus should cover a short dialogue, a practical message, multiple speakers, a non-native French accent, numbers, and reasonable background noise.

## Run

Copy `manifest.example.json`, set local paths, then run:

```text
node scripts/stt-benchmark/run.mjs path/manifest.json path/report.json
```

The runner explicitly rejects files starting with `FAKE-MP3::`.

## Decision rule

A provider is eligible only when it passes every threshold in the manifest. The report does not automatically select the cheapest provider: the final ADR must also cover GDPR, retention, integration, and fallback.

const WORD_SEPARATOR = /[^\p{L}\p{N}]+/gu;
const CHARACTER_SEPARATOR = /\s+/gu;

export function normalizeTranscript(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("fr").replace(/[\u2019']/gu, " ").replace(WORD_SEPARATOR, " ").trim().replace(/\s+/gu, " ");
}

export function wordTokens(value) {
  const normalized = normalizeTranscript(value);
  return normalized ? normalized.split(" ") : [];
}

export function characterTokens(value) {
  return normalizeTranscript(value).replace(CHARACTER_SEPARATOR, "").split("");
}

export function editDistance(reference, hypothesis) {
  const previous = Array.from({ length: hypothesis.length + 1 }, (_, index) => index);
  const current = new Array(hypothesis.length + 1);
  for (let referenceIndex = 1; referenceIndex <= reference.length; referenceIndex += 1) {
    current[0] = referenceIndex;
    for (let hypothesisIndex = 1; hypothesisIndex <= hypothesis.length; hypothesisIndex += 1) {
      const substitutionCost = reference[referenceIndex - 1] === hypothesis[hypothesisIndex - 1] ? 0 : 1;
      current[hypothesisIndex] = Math.min(current[hypothesisIndex - 1] + 1, previous[hypothesisIndex] + 1, previous[hypothesisIndex - 1] + substitutionCost);
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[hypothesis.length];
}

export function errorRate(reference, hypothesis, tokenizer) {
  const referenceTokens = tokenizer(reference);
  const hypothesisTokens = tokenizer(hypothesis);
  if (referenceTokens.length === 0) return hypothesisTokens.length === 0 ? 0 : 1;
  return editDistance(referenceTokens, hypothesisTokens) / referenceTokens.length;
}

export function criticalTokenRecall(referenceTokens, hypothesis) {
  if (!referenceTokens.length) return 1;
  const normalizedHypothesis = ` ${normalizeTranscript(hypothesis)} `;
  const matched = referenceTokens.filter((token) => normalizedHypothesis.includes(` ${normalizeTranscript(token)} `));
  return matched.length / referenceTokens.length;
}

export function timestampMetrics(referenceSegments, candidateSegments) {
  const invalidSegments = candidateSegments.filter((segment) => !Number.isInteger(segment.start_ms) || !Number.isInteger(segment.end_ms) || segment.start_ms < 0 || segment.end_ms <= segment.start_ms);
  const ordered = candidateSegments.every((segment, index) => index === 0 || segment.start_ms >= candidateSegments[index - 1].start_ms);
  const referenceDuration = Math.max(0, ...referenceSegments.map((segment) => segment.end_ms));
  const validIntervals = candidateSegments
    .filter((segment) => segment.start_ms >= 0 && segment.end_ms > segment.start_ms)
    .map((segment) => [segment.start_ms, Math.min(segment.end_ms, referenceDuration)])
    .filter(([start, end]) => end > start)
    .sort((left, right) => left[0] - right[0]);
  const mergedIntervals = [];
  for (const interval of validIntervals) {
    const previous = mergedIntervals.at(-1);
    if (!previous || interval[0] > previous[1]) mergedIntervals.push([...interval]);
    else previous[1] = Math.max(previous[1], interval[1]);
  }
  const coveredDuration = mergedIntervals.reduce((sum, [start, end]) => sum + (end - start), 0);
  const coverage = referenceDuration === 0 ? 0 : Math.min(1, coveredDuration / referenceDuration);
  let meanAbsoluteErrorMs = null;
  if (referenceSegments.length && referenceSegments.length === candidateSegments.length) {
    const totalError = referenceSegments.reduce((sum, referenceSegment, index) => {
      const candidateSegment = candidateSegments[index];
      return sum + Math.abs(referenceSegment.start_ms - candidateSegment.start_ms) + Math.abs(referenceSegment.end_ms - candidateSegment.end_ms);
    }, 0);
    meanAbsoluteErrorMs = totalError / (referenceSegments.length * 2);
  }
  return { invalid_segment_count: invalidSegments.length, ordered, coverage, mean_absolute_error_ms: meanAbsoluteErrorMs };
}

export function speakerMetrics(referenceSegments, candidateSegments) {
  const referenceSpeakers = new Set(referenceSegments.map((segment) => segment.speaker).filter(Boolean));
  const candidateSpeakers = new Set(candidateSegments.map((segment) => segment.speaker).filter(Boolean));
  const labeledSegments = candidateSegments.filter((segment) => segment.speaker).length;
  return {
    reference_speaker_count: referenceSpeakers.size,
    candidate_speaker_count: candidateSpeakers.size,
    speaker_count_delta: Math.abs(referenceSpeakers.size - candidateSpeakers.size),
    labeled_segment_ratio: candidateSegments.length ? labeledSegments / candidateSegments.length : 0,
  };
}

export function evaluateCandidate(reference, candidate, thresholds) {
  const wer = errorRate(reference.text, candidate.text, wordTokens);
  const cer = errorRate(reference.text, candidate.text, characterTokens);
  const criticalRecall = criticalTokenRecall(reference.critical_tokens ?? [], candidate.text);
  const timestamps = timestampMetrics(reference.segments, candidate.segments);
  const speakers = speakerMetrics(reference.segments, candidate.segments);
  const gates = {
    wer: wer <= thresholds.max_wer,
    critical_token_recall: criticalRecall >= thresholds.min_critical_token_recall,
    timestamp_validity: timestamps.invalid_segment_count === 0 && timestamps.ordered,
    timestamp_coverage: timestamps.coverage >= thresholds.min_timestamp_coverage,
    speaker_labels: !thresholds.require_speaker_labels || speakers.labeled_segment_ratio >= thresholds.min_speaker_label_ratio,
  };
  return {
    provider: candidate.provider,
    model: candidate.model,
    audio_id: candidate.audio_id,
    eligible: Object.values(gates).every(Boolean),
    gates,
    metrics: { wer, cer, critical_token_recall: criticalRecall, timestamps, speakers, latency_ms: candidate.latency_ms, estimated_cost_usd: candidate.estimated_cost_usd },
  };
}

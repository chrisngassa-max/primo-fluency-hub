export type AudioDurationResult = {
  durationMs: number;
  frameCount: number;
};

const BITRATES: Record<string, number[]> = {
  "1:1": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  "1:2": [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  "1:3": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  "2:1": [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  "2:2": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  "2:3": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};

const SAMPLE_RATES: Record<number, number[]> = {
  1: [44_100, 48_000, 32_000],
  2: [22_050, 24_000, 16_000],
  25: [11_025, 12_000, 8_000],
};

function id3Offset(bytes: Uint8Array): number {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  return Math.min(bytes.length, 10 + size);
}

export function readMp3Duration(bytes: Uint8Array): AudioDurationResult | null {
  let offset = id3Offset(bytes);
  let durationSeconds = 0;
  let frameCount = 0;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) {
      offset += 1;
      continue;
    }
    const versionBits = (bytes[offset + 1] >> 3) & 0x03;
    const layerBits = (bytes[offset + 1] >> 1) & 0x03;
    const bitrateIndex = (bytes[offset + 2] >> 4) & 0x0f;
    const sampleRateIndex = (bytes[offset + 2] >> 2) & 0x03;
    const padding = (bytes[offset + 2] >> 1) & 0x01;
    const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : versionBits === 0 ? 25 : 0;
    const layer = layerBits === 3 ? 1 : layerBits === 2 ? 2 : layerBits === 1 ? 3 : 0;
    const rateVersion = version === 1 ? 1 : 2;
    const bitrate = BITRATES[`${rateVersion}:${layer}`]?.[bitrateIndex] ?? 0;
    const sampleRate = SAMPLE_RATES[version]?.[sampleRateIndex] ?? 0;
    if (!version || !layer || !bitrate || !sampleRate || bitrateIndex === 15 || sampleRateIndex === 3) {
      offset += 1;
      continue;
    }
    const samplesPerFrame = layer === 1 ? 384 : layer === 3 && version !== 1 ? 576 : 1152;
    const coefficient = layer === 1 ? 12 : layer === 3 && version !== 1 ? 72 : 144;
    const slotSize = layer === 1 ? 4 : 1;
    const frameLength = Math.floor((coefficient * bitrate * 1000) / sampleRate + padding) * slotSize;
    if (frameLength <= 4 || offset + frameLength > bytes.length) {
      offset += 1;
      continue;
    }
    durationSeconds += samplesPerFrame / sampleRate;
    frameCount += 1;
    offset += frameLength;
  }
  if (frameCount === 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  return { durationMs: Math.round(durationSeconds * 1000), frameCount };
}

export type TimestampAssessment = {
  status: "verified" | "unverified";
  audioDurationMs: number | null;
  transcriptEndMs: number | null;
  driftMs: number | null;
};

export function assessTimestampCoverage(
  segments: Array<{ end_ms: number }>,
  audioDurationMs: number | null,
  toleranceMs = 2_000,
): TimestampAssessment {
  const transcriptEndMs = segments.length ? Math.max(...segments.map((segment) => segment.end_ms)) : null;
  if (!audioDurationMs || transcriptEndMs === null) {
    return { status: "unverified", audioDurationMs, transcriptEndMs, driftMs: null };
  }
  const driftMs = transcriptEndMs - audioDurationMs;
  return {
    status: Math.abs(driftMs) <= toleranceMs ? "verified" : "unverified",
    audioDurationMs,
    transcriptEndMs,
    driftMs,
  };
}

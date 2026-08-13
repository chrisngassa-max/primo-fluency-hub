export type AudioDurationResult = {
  durationMs: number;
  frameCount: number;
  mpegVersion: 1 | 2 | 25;
  sampleRateHz: number;
  channels: number | null;
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

export type Mp3FrameSpan = {
  offset: number;
  length: number;
  durationSeconds: number;
  mpegVersion: 1 | 2 | 25;
  sampleRateHz: number;
  channels: number | null;
};

export type Mp3Chunk = {
  bytes: Uint8Array;
  startMs: number;
  durationMs: number;
  mpegVersion: 1 | 2 | 25;
  sampleRateHz: number;
  channels: number | null;
  frameCount: number;
};

function id3Offset(bytes: Uint8Array): number {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  return Math.min(bytes.length, 10 + size);
}

function channelCount(channelMode: number): number | null {
  if (channelMode === 3) return 1;
  if (channelMode === 0 || channelMode === 1 || channelMode === 2) return 2;
  return null;
}

export function iterateMp3Frames(bytes: Uint8Array): Mp3FrameSpan[] {
  const frames: Mp3FrameSpan[] = [];
  let offset = id3Offset(bytes);
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
    const channelMode = (bytes[offset + 3] >> 6) & 0x03;
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
    frames.push({
      offset,
      length: frameLength,
      durationSeconds: samplesPerFrame / sampleRate,
      mpegVersion: version as 1 | 2 | 25,
      sampleRateHz: sampleRate,
      channels: channelCount(channelMode),
    });
    offset += frameLength;
  }
  return frames;
}

export function readMp3Duration(bytes: Uint8Array): AudioDurationResult | null {
  const frames = iterateMp3Frames(bytes);
  if (frames.length === 0) return null;
  const durationSeconds = frames.reduce((sum, frame) => sum + frame.durationSeconds, 0);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  const first = frames[0];
  return {
    durationMs: Math.round(durationSeconds * 1000),
    frameCount: frames.length,
    mpegVersion: first.mpegVersion,
    sampleRateHz: first.sampleRateHz,
    channels: first.channels,
  };
}

export function splitMp3ByMaxDurationMs(bytes: Uint8Array, maxDurationMs: number): Mp3Chunk[] {
  const frames = iterateMp3Frames(bytes);
  if (frames.length === 0 || maxDurationMs <= 0) return [];
  const chunks: Mp3Chunk[] = [];
  let acc: Mp3FrameSpan[] = [];
  let accSeconds = 0;
  let startSeconds = 0;
  const flush = () => {
    if (acc.length === 0) return;
    const first = acc[0];
    const last = acc[acc.length - 1];
    chunks.push({
      bytes: bytes.subarray(first.offset, last.offset + last.length),
      startMs: Math.round(startSeconds * 1000),
      durationMs: Math.round(accSeconds * 1000),
      mpegVersion: first.mpegVersion,
      sampleRateHz: first.sampleRateHz,
      channels: first.channels,
      frameCount: acc.length,
    });
    startSeconds += accSeconds;
    acc = [];
    accSeconds = 0;
  };
  for (const frame of frames) {
    if (acc.length > 0 && (accSeconds + frame.durationSeconds) * 1000 > maxDurationMs) flush();
    acc.push(frame);
    accSeconds += frame.durationSeconds;
  }
  flush();
  return chunks;
}

export type TimestampAssessment = {
  status: "verified" | "unverified";
  audioDurationMs: number | null;
  transcriptEndMs: number | null;
  driftMs: number | null;
  overshootMs: number | null;
  trailingGapMs: number | null;
  coverageRatio: number | null;
};

export function assessTimestampCoverage(
  segments: Array<{ end_ms: number }>,
  audioDurationMs: number | null,
  toleranceMs = 2_000,
): TimestampAssessment {
  const transcriptEndMs = segments.length ? Math.max(...segments.map((segment) => segment.end_ms)) : null;
  if (!audioDurationMs || transcriptEndMs === null) {
    return {
      status: "unverified",
      audioDurationMs,
      transcriptEndMs,
      driftMs: null,
      overshootMs: null,
      trailingGapMs: null,
      coverageRatio: null,
    };
  }
  const driftMs = transcriptEndMs - audioDurationMs;
  const overshootMs = Math.max(0, driftMs);
  const trailingGapMs = Math.max(0, -driftMs);
  const coverageRatio = Number((transcriptEndMs / audioDurationMs).toFixed(6));
  return {
    status: Math.abs(driftMs) <= toleranceMs ? "verified" : "unverified",
    audioDurationMs,
    transcriptEndMs,
    driftMs,
    overshootMs,
    trailingGapMs,
    coverageRatio,
  };
}

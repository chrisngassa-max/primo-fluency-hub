/**
 * Cross-browser audio recorder that captures PCM WAV.
 * Works on Safari/iOS (no webm support needed).
 * Outputs 16-bit mono WAV at 16kHz — optimal for Google STT LINEAR16.
 */

const TARGET_SAMPLE_RATE = 16000;

const DEFAULT_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

type ExtendedDocument = Document & {
  featurePolicy?: {
    allowsFeature?: (feature: string) => boolean;
  };
  permissionsPolicy?: {
    allowsFeature?: (feature: string) => boolean;
  };
};

function getSupportedAudioConstraints(
  constraints: MediaTrackConstraints
): MediaTrackConstraints | true {
  const supported = navigator.mediaDevices.getSupportedConstraints?.() ?? {};

  const filtered = Object.fromEntries(
    Object.entries(constraints).filter(([key]) => {
      const supportKey = key as keyof MediaTrackSupportedConstraints;
      return supported[supportKey] === true;
    })
  ) as MediaTrackConstraints;

  return Object.keys(filtered).length > 0 ? filtered : true;
}

function isMicrophoneBlockedByPolicy(): boolean {
  const doc = document as ExtendedDocument;
  const allowsFeature =
    doc.permissionsPolicy?.allowsFeature?.bind(doc.permissionsPolicy) ??
    doc.featurePolicy?.allowsFeature?.bind(doc.featurePolicy);

  if (!allowsFeature) return false;

  try {
    return allowsFeature("microphone") === false;
  } catch {
    return false;
  }
}

export interface WavRecorder {
  stop: () => void;
}

export async function requestMicrophoneStream(
  constraints: MediaTrackConstraints = DEFAULT_AUDIO_CONSTRAINTS
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("microphone-unsupported");
  }

  const safeConstraints = getSupportedAudioConstraints(constraints);

  try {
    return await navigator.mediaDevices.getUserMedia({ audio: safeConstraints });
  } catch (error) {
    const errorName = error instanceof DOMException ? error.name : "";

    if (
      errorName === "OverconstrainedError" ||
      errorName === "TypeError" ||
      errorName === "ConstraintNotSatisfiedError"
    ) {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }

    if (
      (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") &&
      isMicrophoneBlockedByPolicy()
    ) {
      throw new Error("microphone-policy-blocked");
    }

    throw error;
  }
}

export function getMicrophoneErrorMessage(error: unknown): string {
  const errorName =
    error instanceof DOMException
      ? error.name
      : error instanceof Error
        ? error.message
        : "";

  if (errorName === "microphone-unsupported") {
    return "Votre navigateur ne permet pas l'enregistrement audio sur cette page.";
  }

  if (errorName === "microphone-policy-blocked") {
    return "Le micro est bloqué par la page d’intégration. Ouvrez l’application directement dans Chrome ou Safari, ou autorisez l’iframe avec ‘microphone’.";
  }

  if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
    return window.self !== window.top
      ? "Le navigateur a bloqué le micro dans cette vue intégrée. Autorisez le microphone pour ce site ou ouvrez l’application directement dans Chrome ou Safari."
      : "Le navigateur a bloqué le micro. Autorisez le microphone pour ce site dans les réglages du navigateur puis rechargez la page.";
  }

  if (errorName === "NotFoundError") {
    return "Aucun microphone n'a été détecté sur cet appareil.";
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return "Le microphone est déjà utilisé par une autre application.";
  }

  if (errorName === "SecurityError") {
    return "Le microphone est bloqué par les réglages de sécurité du navigateur.";
  }

  return "Impossible d'accéder au microphone sur cet appareil.";
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodeWAV(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  // Float32 -> Int16
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

function downsample(buffer: Float32Array, inputRate: number): Float32Array {
  if (inputRate === TARGET_SAMPLE_RATE) return buffer;
  const ratio = inputRate / TARGET_SAMPLE_RATE;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const idx = Math.round(i * ratio);
    result[i] = buffer[Math.min(idx, buffer.length - 1)];
  }
  return result;
}

export function startWavRecording(
  stream: MediaStream,
  onComplete: (blob: Blob) => void
): WavRecorder {
  const AudioContextClass =
    window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error("audio-context-unsupported");
  }

  const audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") {
    void audioContext.resume().catch((error) => {
      console.warn("Unable to resume audio context:", error);
    });
  }

  const source = audioContext.createMediaStreamSource(stream);
  const inputSampleRate = audioContext.sampleRate;

  // ScriptProcessorNode is deprecated but universally supported (including iOS Safari).
  // AudioWorklet is not reliably available on older iOS versions.
  const bufferSize = 4096;
  const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
  const chunks: Float32Array[] = [];

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  const stop = () => {
    processor.disconnect();
    source.disconnect();
    audioContext.close();
    stream.getTracks().forEach((t) => t.stop());

    // Merge chunks
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const downsampled = downsample(merged, inputSampleRate);
    const wavBuffer = encodeWAV(downsampled);
    const blob = new Blob([wavBuffer], { type: "audio/wav" });
    onComplete(blob);
  };

  return { stop };
}

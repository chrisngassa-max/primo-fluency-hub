// Section 13 : "Le batch sait reprendre apres limitation de debit avec delai
// exponentiel et jitter." Utilitaire partage par les providers reseau
// (Anthropic, Gemini, OpenAI, Google TTS) pour les statuts 429/5xx.

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export function isRetryableStatus(status) {
  return RETRYABLE_STATUSES.has(status);
}

/**
 * @param {() => Promise<Response>} attempt
 * @param {{ maxAttempts?: number, baseDelayMs?: number, sleep?: (ms:number)=>Promise<void> }} options
 */
export async function withExponentialBackoff(attempt, options = {}) {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  let lastError;
  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
    try {
      const response = await attempt(attemptNumber);
      if (response?.ok === false && isRetryableStatus(response.status) && attemptNumber < maxAttempts) {
        const jitter = Math.random() * baseDelayMs;
        await sleep(baseDelayMs * 2 ** (attemptNumber - 1) + jitter);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attemptNumber >= maxAttempts) break;
      const jitter = Math.random() * baseDelayMs;
      await sleep(baseDelayMs * 2 ** (attemptNumber - 1) + jitter);
    }
  }
  if (lastError) throw lastError;
  throw new Error('withExponentialBackoff: toutes les tentatives ont echoue.');
}

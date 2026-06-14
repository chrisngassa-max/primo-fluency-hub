export async function getEdgeFunctionErrorMessage(
  error: unknown,
  fallback = "La fonction distante a echoue",
) {
  const candidate = error as {
    message?: string;
    context?: Response;
  } | null;

  if (candidate?.context instanceof Response) {
    if (candidate.context.status === 404) {
      return "Fonction edge introuvable (non deployee sur Supabase). Contactez l'administrateur.";
    }

    try {
      const payload = await candidate.context.clone().json() as {
        error?: string;
        message?: string;
      };
      if (payload.error || payload.message) return payload.error || payload.message || fallback;
    } catch {
      try {
        const text = await candidate.context.clone().text();
        if (text.trim()) return text.trim();
      } catch {
        // Fall back to the SDK message below.
      }
    }
  }

  const message = candidate?.message || fallback;
  if (/failed to send a request to the edge function/i.test(message)) {
    return "Impossible de joindre la fonction edge (non deployee ou indisponible).";
  }

  return message;
}

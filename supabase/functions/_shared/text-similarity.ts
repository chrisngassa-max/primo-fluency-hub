function tokenize(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // accents
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function bigrams(tokens: string[], maxTokens = 50): Set<string> {
  const scoped = tokens.slice(0, maxTokens);
  const set = new Set<string>();
  for (let i = 0; i < scoped.length - 1; i++) {
    set.add(`${scoped[i]}_${scoped[i + 1]}`);
  }
  return set;
}

export function bigramJaccard(
  textA: string,
  textB: string,
  options: { minTokens?: number; maxTokens?: number } = {},
): number | null {
  const minTokens = options.minTokens ?? 20;
  const maxTokens = options.maxTokens ?? 50;

  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.length < minTokens || tokensB.length < minTokens) {
    return null;
  }

  const setA = bigrams(tokensA, maxTokens);
  const setB = bigrams(tokensB, maxTokens);

  if (setA.size === 0 || setB.size === 0) return null;

  let intersection = 0;
  for (const bigram of setA) if (setB.has(bigram)) intersection++;

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

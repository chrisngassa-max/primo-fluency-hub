/**
 * Detection du mode embed sandbox.
 *
 * L'app utilise un HashRouter : la query string peut etre presente :
 *  - dans `window.location.search` (avant le `#`)
 *  - dans la portion qui suit `?` a l'interieur du hash (apres le `#`)
 *
 * On parse chaque emplacement avec URLSearchParams pour eviter les faux positifs
 * d'un simple `.includes("sandbox_embed=1")` sur l'URL brute.
 */
export function isSandboxEmbed(): boolean {
  if (typeof window === "undefined") return false;

  const checkParam = (search: string): boolean => {
    if (!search) return false;
    const normalized = search.startsWith("?") ? search.slice(1) : search;
    try {
      const params = new URLSearchParams(normalized);
      return params.get("sandbox_embed") === "1";
    } catch {
      return false;
    }
  };

  if (checkParam(window.location.search)) return true;

  const hash = window.location.hash ?? "";
  const queryIndex = hash.indexOf("?");
  if (queryIndex >= 0 && checkParam(hash.slice(queryIndex + 1))) return true;

  return false;
}

import DOMPurify from "dompurify";

/**
 * Liste blanche stricte pour les supports de séance (content_html) —
 * suffisant pour du texte pédagogique (titres, paragraphes, listes,
 * emphase), rien d'exécutable. Assainit tout HTML avant affichage, même
 * du contenu formateur (relecture indépendante, point 8) : content_html
 * est écrit par des comptes staff, mais un compte compromis ou un import
 * mal filtré ne doit jamais pouvoir exécuter de script côté apprenant.
 */
export const HTML_PURIFY_CONFIG = {
  ALLOWED_TAGS: ["p", "br", "strong", "em", "b", "i", "u", "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "span", "div"],
  ALLOWED_ATTR: ["class"],
};

export function sanitizeSeanceHtml(html: string | null | undefined): string {
  if (!html) return "<p>Support en préparation.</p>";
  return DOMPurify.sanitize(html, HTML_PURIFY_CONFIG);
}

import { describe, expect, it } from "vitest";
import { sanitizeSeanceHtml } from "./sanitizeHtml";

describe("sanitizeSeanceHtml — relecture indépendante point 8/10 (XSS)", () => {
  it("neutralise une balise <script>", () => {
    const out = sanitizeSeanceHtml('<p>Bonjour</p><script>alert("xss")</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(");
    expect(out).toContain("Bonjour");
  });

  it("neutralise un handler onerror sur une image", () => {
    const out = sanitizeSeanceHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert(1)");
  });

  it("neutralise une iframe", () => {
    const out = sanitizeSeanceHtml('<iframe src="javascript:alert(1)"></iframe>');
    expect(out).not.toContain("<iframe");
  });

  it("neutralise un lien javascript:", () => {
    const out = sanitizeSeanceHtml('<a href="javascript:alert(1)">clique</a>');
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("neutralise un attribut style avec expression() / import malveillant", () => {
    const out = sanitizeSeanceHtml('<div style="background:url(javascript:alert(1))">x</div>');
    expect(out).not.toContain("style=");
  });

  it("conserve la mise en forme légitime (titres, listes, emphase)", () => {
    const out = sanitizeSeanceHtml("<h3>Titre</h3><ul><li>Un</li><li>Deux</li></ul><p><strong>gras</strong></p>");
    expect(out).toContain("<h3>Titre</h3>");
    expect(out).toContain("<li>Un</li>");
    expect(out).toContain("<strong>gras</strong>");
  });

  it("renvoie un texte de repli pour un contenu vide/nul", () => {
    expect(sanitizeSeanceHtml(null)).toContain("préparation");
    expect(sanitizeSeanceHtml("")).toContain("préparation");
  });
});

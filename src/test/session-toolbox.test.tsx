import { BookOpen, ClipboardCheck } from "lucide-react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import SessionToolbox, { type SessionTool } from "@/components/SessionToolbox";

const tools: SessionTool[] = [
  {
    id: "retrospective",
    title: "Retrospective",
    description: "Revoir la seance precedente.",
    icon: BookOpen,
    content: <div>Contenu retrospective</div>,
  },
  {
    id: "diagnostic",
    title: "Diagnostic",
    description: "Evaluer les acquis avant la seance.",
    icon: ClipboardCheck,
    content: <div>Contenu diagnostic</div>,
  },
];

describe("SessionToolbox", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("allows several tools to stay open at the same time", () => {
    act(() => root.render(<SessionToolbox sessionId="session-1" tools={tools} />));

    const openButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent?.includes("Ouvrir")
    );
    act(() => {
      openButtons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
      openButtons[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Contenu retrospective");
    expect(container.textContent).toContain("Contenu diagnostic");
    expect(
      Array.from(container.querySelectorAll("button")).filter((button) =>
        button.textContent?.includes("Masquer")
      )
    ).toHaveLength(2);
  });

  it("restores the tools opened for the current session", () => {
    localStorage.setItem(
      "session-toolbox:session-2",
      JSON.stringify(["retrospective", "unknown-tool"])
    );

    act(() => root.render(<SessionToolbox sessionId="session-2" tools={tools} />));

    expect(container.textContent).toContain("Contenu retrospective");
    expect(container.textContent).not.toContain("Contenu diagnostic");
  });
});

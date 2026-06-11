import { useSandboxPreview } from "@/contexts/SandboxPreviewContext";
import SandboxGridPreview from "@/components/sandbox/SandboxGridPreview";
import SandboxEmbedFrame from "@/components/sandbox/SandboxEmbedFrame";

export default function SandboxPreviewSurface() {
  const { mode, niveau } = useSandboxPreview();
  if (mode === "mosaic") return <SandboxGridPreview />;
  if (mode === "eleve" && niveau) return <SandboxEmbedFrame niveau={niveau} />;
  return null;
}

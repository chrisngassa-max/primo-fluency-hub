import { useSandboxPreview } from "@/contexts/SandboxPreviewContext";
import SandboxGridPreview from "@/components/sandbox/SandboxGridPreview";
import SandboxStudentPreview from "@/components/sandbox/SandboxStudentPreview";

export default function SandboxPreviewSurface() {
  const { mode, niveau } = useSandboxPreview();
  if (mode === "mosaic") return <SandboxGridPreview />;
  if (mode === "eleve" && niveau) return <SandboxStudentPreview niveau={niveau} />;
  return null;
}

import { useParams } from "react-router-dom";
import EleveProgression from "@/pages/eleve/Progression";

const EleveDetail = () => {
  const { eleveId } = useParams<{ eleveId: string }>();
  return <EleveProgression eleveId={eleveId} />;
};

export default EleveDetail;

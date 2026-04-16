import { useEffect } from "react";

const AuthRelayReset = () => {
  useEffect(() => {
    const target =
      "https://formateur-code-lab.lovable.app/reset-password" +
      window.location.search +
      window.location.hash;
    window.location.replace(target);
  }, []);
  return null;
};

export default AuthRelayReset;

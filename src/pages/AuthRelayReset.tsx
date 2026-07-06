import { useEffect } from "react";

const AuthRelayReset = () => {
  useEffect(() => {
    const qs = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;
    const fromHash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const combined = [qs, fromHash].filter(Boolean).join("&");
    const target =
      window.location.origin +
      "/" +
      (combined ? `#/reset-password?${combined}` : "#/reset-password");
    window.location.replace(target);
  }, []);
  return null;
};

export default AuthRelayReset;

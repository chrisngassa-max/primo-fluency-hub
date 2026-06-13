export type AuthAudience = "eleve" | "formateur";

let activeRecoveryAudience: AuthAudience | null = null;

export function getRecoveryAudience(search = window.location.search): AuthAudience {
  const audience = new URLSearchParams(search).get("auth_audience");
  return audience === "formateur" ? "formateur" : "eleve";
}

export function getPasswordRecoveryRedirect(audience: AuthAudience): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("auth_audience", audience);
  return url.toString();
}

export function markPasswordRecovery(audience: AuthAudience): void {
  activeRecoveryAudience = audience;
}

export function consumePasswordRecovery(): AuthAudience | null {
  const audience = activeRecoveryAudience;
  activeRecoveryAudience = null;
  return audience;
}

export function getLoginPath(audience: AuthAudience): string {
  return audience === "formateur" ? "/formateur/login" : "/eleve/login";
}

export type EleveLoginHintCode =
  | "email_not_found"
  | "wrong_password"
  | "pending_approval"
  | "consent_missing"
  | "not_eleve"
  | "lookup_failed";

const errorMap: Record<string, string> = {
  "User already registered": "Cette adresse email est déjà utilisée.",
  "Invalid login credentials": "Email ou mot de passe incorrect.",
  "Email not confirmed": "Veuillez confirmer votre adresse email.",
  "Password should be at least 6 characters": "Le mot de passe doit contenir au moins 6 caractères.",
  "Unable to validate email address: invalid format": "Le format de l'adresse email est invalide.",
};

const eleveLoginHints: Record<EleveLoginHintCode, string> = {
  email_not_found: "Aucun compte élève n'est associé à cette adresse email.",
  wrong_password: "Mot de passe incorrect.",
  pending_approval:
    "Votre inscription est en attente de validation par votre formateur. Vous recevrez un accès dès qu'elle sera approuvée.",
  consent_missing:
    "Votre compte est actif mais le consentement RGPD (IA et voix) n'a pas encore été donné. Connectez-vous pour l'accepter.",
  not_eleve: "Cette adresse email n'est pas un compte élève. Utilisez l'espace formateur si vous êtes formateur.",
  lookup_failed: "Impossible de vérifier le compte pour le moment. Réessayez dans quelques instants.",
};

export function translateAuthError(message: string): string {
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return "Une erreur est survenue. Veuillez réessayer.";
}

export function translateEleveLoginHint(code: EleveLoginHintCode | null | undefined): string {
  if (!code) return translateAuthError("Invalid login credentials");
  return eleveLoginHints[code] ?? translateAuthError("Invalid login credentials");
}

export function isInvalidCredentialsError(message: string): boolean {
  return message.toLowerCase().includes("invalid login credentials");
}

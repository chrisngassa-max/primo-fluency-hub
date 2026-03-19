const errorMap: Record<string, string> = {
  "User already registered": "Cette adresse email est déjà utilisée.",
  "Invalid login credentials": "Email ou mot de passe incorrect.",
  "Email not confirmed": "Veuillez confirmer votre adresse email.",
  "Password should be at least 6 characters": "Le mot de passe doit contenir au moins 6 caractères.",
  "Unable to validate email address: invalid format": "Le format de l'adresse email est invalide.",
};

export function translateAuthError(message: string): string {
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return "Une erreur est survenue. Veuillez réessayer.";
}

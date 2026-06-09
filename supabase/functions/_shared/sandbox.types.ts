export type SandboxStatut = "provisioning" | "active" | "expired" | "reset";
export type NiveauSandbox = "A1" | "A2" | "B1" | "B2";

export interface EleveSandbox {
  niveau: NiveauSandbox;
  email: string;
  user_id: string;
  display_name: string;
  mot_de_passe_initial?: string;
}

export interface SandboxSetupRequest {
  force_recreate?: boolean;
}

export interface SandboxSetupResponse {
  sandbox_session_id: string;
  group_id: string;
  groupe_id: string;
  eleves: EleveSandbox[];
  expires_at: string;
  message: "created" | "reactivated" | "existing" | "resumed";
}

export type SandboxResetScope = "attempts_only" | "sessions" | "everything";

export interface SandboxResetResponse {
  tables_nettoyees: Record<string, number>;
  sandbox_session_id: string;
}

export interface SandboxInviteResponse {
  invite_url: string;
  niveau: NiveauSandbox;
  expires_in_seconds: number;
}

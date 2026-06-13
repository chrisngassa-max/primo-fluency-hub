import { supabase } from "@/integrations/supabase/client";
import { normalizeInvitationCode } from "@/lib/invitationCode";

export const GROUP_INVITATION_STORAGE_KEY = "tcf-invite-code";

export async function validateGroupInvitation(code: string) {
  return supabase.functions.invoke<{
    valid?: boolean;
    group?: { nom: string; niveau: string };
    error?: string;
  }>("group-invitation", {
    body: { action: "validate", code: normalizeInvitationCode(code) },
  });
}

export async function joinGroupWithInvitation(code: string) {
  return supabase.functions.invoke<{
    joined?: boolean;
    group?: { id: string; nom: string; niveau: string };
    error?: string;
  }>("group-invitation", {
    body: { action: "join", code: normalizeInvitationCode(code) },
  });
}

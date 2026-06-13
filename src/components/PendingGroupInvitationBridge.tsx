import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  GROUP_INVITATION_STORAGE_KEY,
  joinGroupWithInvitation,
} from "@/lib/groupInvitation";
import { normalizeInvitationCode } from "@/lib/invitationCode";

const PendingGroupInvitationBridge = () => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const attemptedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || role !== "eleve" || attemptedForUser.current === user.id) return;
    const urlCode = normalizeInvitationCode(
      new URLSearchParams(window.location.search).get("invite") ?? "",
    );
    const code = urlCode || sessionStorage.getItem(GROUP_INVITATION_STORAGE_KEY);
    if (!code) return;
    sessionStorage.setItem(GROUP_INVITATION_STORAGE_KEY, code);
    attemptedForUser.current = user.id;

    void joinGroupWithInvitation(code).then(async ({ data, error }) => {
      if (error || data?.error || !data?.joined) {
        attemptedForUser.current = null;
        toast.error("Rattachement au groupe impossible", {
          description: data?.error || "Le code est peut-être expiré. Demandez un nouveau code à votre formateur.",
        });
        return;
      }

      sessionStorage.removeItem(GROUP_INVITATION_STORAGE_KEY);
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("invite");
      window.history.replaceState({}, "", cleanUrl);
      await queryClient.invalidateQueries({ queryKey: ["eleve-memberships", user.id] });
      toast.success(`Tu as rejoint le groupe « ${data.group?.nom ?? "de ton formateur"} ».`);
    });
  }, [queryClient, role, user?.id]);

  return null;
};

export default PendingGroupInvitationBridge;

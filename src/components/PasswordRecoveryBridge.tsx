import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getRecoveryAudience, markPasswordRecovery } from "@/lib/passwordRecovery";

const PasswordRecoveryBridge = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "PASSWORD_RECOVERY") return;

      const audience = getRecoveryAudience();
      markPasswordRecovery(audience);
      navigate(`/reset-password?audience=${audience}`, { replace: true });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
};

export default PasswordRecoveryBridge;

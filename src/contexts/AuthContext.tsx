import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AppRole = "formateur" | "eleve" | "admin";
type ProfileStatus = "pending" | "approved";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profileStatus: ProfileStatus | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata: { nom: string; prenom: string; role: AppRole }) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const syncRequestRef = useRef(0);

  const fetchRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch user role", error);
      return null;
    }

    return (data?.role as AppRole) ?? null;
  };

  const fetchProfileStatus = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch profile status", error);
      return null;
    }

    return (data?.status as ProfileStatus) ?? null;
  };

  const syncAuthState = async (nextSession: Session | null) => {
    const requestId = ++syncRequestRef.current;

    setLoading(true);
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      if (syncRequestRef.current !== requestId) return;
      setRole(null);
      setProfileStatus(null);
      setLoading(false);
      return;
    }

    const [nextRole, nextProfileStatus] = await Promise.all([
      fetchRole(nextSession.user.id),
      fetchProfileStatus(nextSession.user.id),
    ]);

    if (syncRequestRef.current !== requestId) return;

    setRole(nextRole);
    setProfileStatus(nextProfileStatus);
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        void syncAuthState(nextSession);
      }
    );

    void supabase.auth.getSession().then(({ data: { session } }) => {
      void syncAuthState(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata: { nom: string; prenom: string; role: AppRole }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nom: metadata.nom, prenom: metadata.prenom, role: metadata.role },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setProfileStatus(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, profileStatus, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

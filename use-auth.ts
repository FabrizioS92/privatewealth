import { useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Auth hook centralizzato.
 * FIX: eliminata race condition tra onAuthStateChange e getSession.
 * Il listener è registrato per primo; getSession aggiorna lo stato solo
 * se il listener non ha ancora risposto (flag "settled").
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const settled = useRef(false);

  useEffect(() => {
    // 1. Listener registrato PRIMA — è lui che fa "source of truth"
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      settled.current = true;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    // 2. getSession aggiorna lo stato solo se il listener non ha ancora risposto
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!settled.current) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, user, loading, signOut, isAuthenticated: !!user };
}

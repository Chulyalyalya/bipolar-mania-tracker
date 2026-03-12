import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, Profile } from '@/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const resolvedRef = useRef(false);

  const fetchProfileAndRole = async (userId: string) => {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('AUTH_PROFILE_FETCH_ERROR', profileError);
    }

    const p = profileData as Profile | null;
    setProfile(p);

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (roleError) {
      console.error('AUTH_ROLE_FETCH_ERROR', roleError);
    }

    const resolvedRole = (roleData?.role as AppRole) ?? (p?.role as AppRole) ?? null;
    console.log('AUTH_ROLE_RESOLVED:', {
      userId,
      role: resolvedRole,
      fromUserRoles: !!roleData,
      fromProfile: p?.role,
    });
    setRole(resolvedRole);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfileAndRole(user.id);
  };

  useEffect(() => {
    let isMounted = true;

    const resolveSession = async (nextSession: Session | null, source: string) => {
      try {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          await fetchProfileAndRole(nextSession.user.id);
        } else {
          setProfile(null);
          setRole(null);
        }
      } catch (error) {
        console.error('AUTH_RESOLVE_ERROR', { source, error });
        setProfile(null);
        setRole(null);
      } finally {
        if (!isMounted) return;
        setLoading(false);
        resolvedRef.current = true;
        console.log('AUTH_RESOLVE_DONE', { source, hasSession: !!nextSession });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      console.log('AUTH_STATE_CHANGE:', _event, !!nextSession);
      void resolveSession(nextSession, `onAuthStateChange:${_event}`);
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!resolvedRef.current) {
        console.log('AUTH_GET_SESSION_BOOTSTRAP', !!initialSession);
        void resolveSession(initialSession, 'getSession');
      }
    });

    const timeout = setTimeout(() => {
      if (!resolvedRef.current) {
        console.warn('AUTH_TIMEOUT: forcing loading=false after 8s');
        setLoading(false);
        resolvedRef.current = true;
      }
    }, 8000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signOut = async () => {
    try {
      setSession(null);
      setUser(null);
      setProfile(null);
      setRole(null);
      await supabase.auth.signOut();
    } catch (e) {
      console.error('SIGNOUT_INTERNAL_ERROR', e);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, role, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};


import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ApiError, api, type User } from "./resume-api";

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
  handleUnauthorized: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const savedToken = window.localStorage.getItem("resume_analyzer_token");
    if (!savedToken) {
      setReady(true);
      return;
    }
    api.me().then(setUser).catch(() => window.localStorage.removeItem("resume_analyzer_token")).finally(() => setReady(true));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    signIn: (nextToken, nextUser) => {
      window.localStorage.setItem("resume_analyzer_token", nextToken);
      setUser(nextUser);
    },
    signOut: () => {
      window.localStorage.removeItem("resume_analyzer_token");
      setUser(null);
      void navigate({ to: "/login" });
    },
    handleUnauthorized: () => {
      window.localStorage.removeItem("resume_analyzer_token");
      setUser(null);
      void navigate({ to: "/login" });
    },
  }), [navigate, ready, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}
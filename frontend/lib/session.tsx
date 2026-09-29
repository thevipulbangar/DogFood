"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

export type Role = "participant" | "judge" | "organizer" | "admin";
export type User = { id: number; name: string; email: string; role: Role };

type Session = {
  user: User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const Ctx = createContext<Session>({
  user: null, ready: false,
  signIn: async () => {}, signUp: async () => {}, signOut: () => {},
});

const USER_KEY = "dogfood.user";
const TOKEN_KEY = "dogfood.token";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  const persist = (token: string, user: User) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {}
    setUser(user);
  };

  const signIn = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.login(email, password);
    persist(token, user);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { token, user } = await api.signup(name, email, password);
    persist(token, user);
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {}
  }, []);

  return <Ctx.Provider value={{ user, ready, signIn, signUp, signOut }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
"use client";

import { useSyncExternalStore } from "react";

// A visitor's own TypeSafe key. It stays in this browser: session storage by
// default (cleared when the tab closes), local storage only if they choose
// "remember". It is sent to this app's server with each request, which
// passes it to TypeSafe and keeps nothing.

const STORAGE_KEY = "sift.typesafeKey";
const HEADER = "x-typesafe-key";

let current: string | null | undefined;
const listeners = new Set<() => void>();

function read(): string | null {
  if (current === undefined) {
    try {
      current = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
    } catch {
      current = null;
    }
  }
  return current;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useUserKey(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function setUserKey(key: string | null, remember = false) {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    if (key) (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, key);
  } catch {
    // Storage can be blocked; the key still works for this page load.
  }
  current = key;
  listeners.forEach((fn) => fn());
}

export function isRemembered(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

// Headers to add to every request that may call Jev.
export function keyHeaders(): Record<string, string> {
  const key = read();
  return key ? { [HEADER]: key } : {};
}

export const maskKey = (key: string) => `••••${key.slice(-4)}`;

export async function verifyKey(key: string): Promise<string | null> {
  try {
    const res = await fetch("/api/check-key", { method: "POST", headers: { [HEADER]: key } });
    const data = await res.json();
    return res.ok ? null : (data.error ?? "That key didn't work.");
  } catch {
    return "Couldn't reach the server.";
  }
}

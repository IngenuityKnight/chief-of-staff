"use client";

const STORAGE_KEY = "cos_editor_password";

export function getPassword(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setPassword(password: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, password);
}

export function clearPassword(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

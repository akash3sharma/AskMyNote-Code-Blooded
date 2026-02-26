"use client";

import { useSyncExternalStore } from "react";
import { Laptop, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "askmynotes-theme";
const THEME_CHANGE_EVENT = "askmynotes-theme-change";

type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return systemTheme();
  }
  return mode;
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved = resolveTheme(mode);
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.themeMode = mode;
}

function setThemeMode(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, mode);
  applyTheme(mode);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

function currentMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMediaChange = () => {
    if (currentMode() === "system") {
      applyTheme("system");
      callback();
    }
  };
  const onThemeChange = () => callback();
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      applyTheme(currentMode());
      callback();
    }
  };

  window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", onMediaChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onMediaChange);
  };
}

function getSnapshot(): ThemeMode {
  const mode = currentMode();
  applyTheme(mode);
  return mode;
}

export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, () => "system");

  return (
    <div className="fixed right-4 bottom-4 z-50 flex items-center gap-1 rounded-full border border-white/45 bg-white/78 p-1 shadow-[0_10px_30px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/75 dark:shadow-[0_10px_30px_rgba(2,6,23,0.6)]">
      <Button
        variant={mode === "light" ? "default" : "ghost"}
        size="icon"
        aria-label="Use light theme"
        title="Light theme"
        className="rounded-full"
        onClick={() => setThemeMode("light")}
      >
        <Sun className="h-4 w-4" />
      </Button>
      <Button
        variant={mode === "dark" ? "default" : "ghost"}
        size="icon"
        aria-label="Use dark theme"
        title="Dark theme"
        className="rounded-full"
        onClick={() => setThemeMode("dark")}
      >
        <Moon className="h-4 w-4" />
      </Button>
      <Button
        variant={mode === "system" ? "default" : "ghost"}
        size="icon"
        aria-label="Use system theme"
        title="System theme"
        className="rounded-full"
        onClick={() => setThemeMode("system")}
      >
        <Laptop className="h-4 w-4" />
      </Button>
    </div>
  );
}

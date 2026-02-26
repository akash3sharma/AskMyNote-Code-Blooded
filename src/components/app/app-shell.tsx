"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpenText, BotMessageSquare, LayoutDashboard, LogOut, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type AppShellProps = {
  children: React.ReactNode;
};

const NAV_ITEMS = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/settings", label: "Settings", icon: Settings2 },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) {
      toast.success("Logged out");
      router.push("/auth/login");
      return;
    }
    toast.error("Failed to log out");
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-44 -left-36 h-[26rem] w-[26rem] rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/20"
        animate={{ x: [0, 36, -10, 0], y: [0, 24, 10, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 h-[25rem] w-[25rem] rounded-full bg-emerald-300/25 blur-3xl dark:bg-emerald-500/15"
        animate={{ x: [0, -30, 10, 0], y: [0, -18, -6, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-300/20 blur-3xl dark:bg-indigo-500/15"
        animate={{ x: [0, 28, -18, 0], y: [0, -12, 16, 0] }}
        transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 md:grid-cols-[250px_1fr]">
        <motion.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-3xl border border-white/45 bg-white/72 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-950/70 dark:shadow-[0_18px_60px_rgba(2,6,23,0.55)]"
        >
          <div className="mb-6 flex items-center gap-2 px-2">
            <div className="rounded-xl bg-gradient-to-br from-sky-500 via-cyan-500 to-emerald-500 p-2 text-white shadow-lg shadow-sky-300/50 dark:shadow-cyan-900/60">
              <BookOpenText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">AskMyNotes</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Retrieval-First AI</p>
            </div>
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-200",
                    active
                      ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-sky-300/40 dark:shadow-cyan-900/40"
                      : "text-zinc-700 hover:bg-white/80 hover:shadow-sm dark:text-zinc-300 dark:hover:bg-slate-800/70",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 space-y-2 rounded-xl border border-dashed border-zinc-300/80 bg-white/60 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-slate-900/50 dark:text-zinc-300">
            <p className="flex items-center gap-2">
              <BotMessageSquare className="h-3.5 w-3.5" />
              Pick a subject card to open chat.
            </p>
          </div>

          <Button variant="outline" className="mt-6 w-full justify-start bg-white/70 dark:bg-slate-900/60" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </motion.aside>

        <main className="rounded-3xl border border-white/45 bg-white/74 p-4 shadow-[0_20px_62px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-950/70 dark:shadow-[0_20px_62px_rgba(2,6,23,0.6)] md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

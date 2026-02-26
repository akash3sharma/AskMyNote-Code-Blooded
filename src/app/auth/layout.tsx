export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-300/30 blur-3xl dark:bg-cyan-500/20" />
      <div className="pointer-events-none absolute right-8 bottom-8 h-64 w-64 rounded-full bg-emerald-300/25 blur-3xl dark:bg-emerald-500/15" />
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

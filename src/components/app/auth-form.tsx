"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "login" | "signup" | "forgot";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "").trim();

    try {
      if (mode === "forgot") {
        const response = await fetch("/api/auth/forgot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();
        if (!response.ok) {
          toast.error(data.error || "Failed to send reset email");
          return;
        }

        toast.success(data.message || "Check your inbox");
        return;
      }

      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Authentication failed");
        return;
      }

      toast.success(mode === "login" ? "Welcome back" : "Account created");
      router.push("/app");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "login" ? "Login" : mode === "signup" ? "Create account" : "Forgot password";
  const description =
    mode === "forgot"
      ? "Enter your email and we will send reset instructions if an account exists."
      : "Secure email and password authentication with JWT session cookies.";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Card className="w-full border-zinc-200">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@example.com" />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required placeholder="••••••••" />
              </div>
            )}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Please wait..." : mode === "login" ? "Login" : mode === "signup" ? "Sign up" : "Send reset"}
            </Button>
          </form>

          <div className="mt-4 text-sm text-zinc-600">
            {mode === "login" && (
              <>
                <p>
                  Need an account? <Link href="/auth/signup" className="font-medium text-zinc-900 underline">Sign up</Link>
                </p>
                <p className="mt-2">
                  Forgot password? <Link href="/auth/forgot" className="font-medium text-zinc-900 underline">Reset</Link>
                </p>
              </>
            )}
            {mode === "signup" && (
              <p>
                Already have an account? <Link href="/auth/login" className="font-medium text-zinc-900 underline">Login</Link>
              </p>
            )}
            {mode === "forgot" && (
              <p>
                Back to <Link href="/auth/login" className="font-medium text-zinc-900 underline">Login</Link>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

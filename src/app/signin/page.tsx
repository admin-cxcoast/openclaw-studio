"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <main className="flex h-full items-center justify-center p-4">
      <div className="glass-panel w-full max-w-sm rounded-xl p-6">
        <h1 className="console-title mb-1 text-center text-3xl text-foreground">
          OpenClaw Studio
        </h1>
        <p className="mb-6 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Sign in to continue
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            const formData = new FormData(e.currentTarget);
            void signIn("password", formData)
              .then(() => {
                // Middleware handles redirect
              })
              .catch(() => {
                setError("Invalid email or password.");
              })
              .finally(() => setLoading(false));
          }}
          className="flex flex-col gap-4"
        >
          <input name="flow" type="hidden" value="signIn" />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="Min. 8 characters"
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 font-mono text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}

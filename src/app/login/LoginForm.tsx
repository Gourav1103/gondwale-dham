"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Field";
import { Emblem } from "@/components/AppShell";
import { setUserName, useUserName } from "@/lib/client/user";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const storedName = useUserName();
  const [nameDraft, setName] = useState<string | null>(null);
  const name = nameDraft ?? storedName;
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return setError("Please enter the password.");
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Incorrect password. Please try again.");
        setLoading(false);
        return;
      }
      if (name.trim()) setUserName(name);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your internet connection.");
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-md animate-pop-in rounded-[18px] bg-card px-6 py-8 shadow-lift sm:px-10 sm:py-10">
      <div className="flex flex-col items-center text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-muted-2 px-3.5 py-1 font-hindi text-[13px] font-semibold text-gold">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          श्री राम का धाम — गोंदवले धाम
        </span>
        <Emblem className="h-32 w-32 sm:h-36 sm:w-36" priority />
        <p className="mt-4 font-hindi text-sm font-semibold text-ink-soft">गोंदवले धाम, इंदौर</p>
        <h1 className="mt-2 font-display text-3xl leading-tight font-semibold">
          Harihaat 2026
          <span className="mt-1 block font-hindi text-2xl font-medium text-primary">५१ शक्तिपीठ सजावट</span>
        </h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
          Decoration ideas, reference photos and notes for the whole team — in one place.
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-ink-faint" />
            <Input
              id="password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter app password"
              autoComplete="current-password"
              autoFocus
              className="h-13 pr-12 pl-12"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute top-1/2 right-2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-ink-soft hover:bg-muted-2"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <FieldError>{error}</FieldError>
        </div>

        <div>
          <Label htmlFor="name" hint="Optional">
            Your name
          </Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="So the team knows who added what" maxLength={60} />
        </div>

        <Button type="submit" size="lg" loading={loading} className="w-full" icon={!loading ? <ArrowRight className="h-5 w-5" /> : undefined}>
          Enter
        </Button>
        <p className="text-center text-xs text-ink-faint">Don&apos;t know the password? Ask your seva coordinator.</p>
      </form>
    </div>
  );
}

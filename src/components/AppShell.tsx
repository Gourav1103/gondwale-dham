"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { Home, Lightbulb, LogOut, Flower2, UserRound } from "lucide-react";
import { useUserName, setUserName } from "@/lib/client/user";
import { clearAllCache } from "@/lib/client/cache";
import { getQueue } from "@/lib/client/outbox";
import { SyncStatus } from "./SyncStatus";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input, Label } from "./ui/Field";
import { useFeedback } from "./ui/Toast";

const NAV = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/ideas", label: "Ideas", icon: Lightbulb, match: (p: string) => p.startsWith("/ideas") },
  { href: "/peeths", label: "Shakti Peeths", short: "Peeths", icon: Flower2, match: (p: string) => p.startsWith("/peeths") },
];

/** Gondawale Dham logo (public/logo.png). */
export function Emblem({ className = "h-11 w-11", priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt="गोंदवले धाम, इंदौर"
      width={512}
      height={512}
      priority={priority}
      className={`shrink-0 object-contain mix-blend-multiply ${className}`}
    />
  );
}

// usePathname() is request data, so the nav highlights stream in inside <Suspense>.
function DesktopNav() {
  const pathname = usePathname();
  return (
    <>
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
            n.match(pathname) ? "bg-primary-soft/70 text-primary" : "text-ink-soft hover:bg-muted-2 hover:text-ink"
          }`}
        >
          <n.icon className="h-4 w-4" />
          {n.label}
        </Link>
      ))}
    </>
  );
}

function MobileNav({ pathname = "" }: { pathname?: string }) {
  return (
    <>
      {NAV.map((n) => {
        const active = !!pathname && n.match(pathname);
        return (
          <Link key={n.href} href={n.href} className="flex flex-col items-center gap-0.5 py-1">
            <span className={`grid h-8 w-14 place-items-center rounded-full transition ${active ? "bg-primary-soft text-primary" : "text-ink-faint"}`}>
              <n.icon className="h-5 w-5" />
            </span>
            <span className={`text-[11px] font-bold ${active ? "text-primary" : "text-ink-faint"}`}>{n.short ?? n.label}</span>
          </Link>
        );
      })}
    </>
  );
}

function MobileNavActive() {
  return <MobileNav pathname={usePathname()} />;
}

const staticDesktopNav = NAV.map((n) => (
  <Link key={n.href} href={n.href} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-ink-soft">
    <n.icon className="h-4 w-4" />
    {n.label}
  </Link>
));

export function AppShell({ children }: { children: ReactNode }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const name = useUserName();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Emblem priority />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="block font-display text-lg leading-none font-semibold whitespace-nowrap text-ink">Harihaat 2026</span>
              <span className="block truncate font-hindi text-xs leading-[1.35] font-semibold text-ink-faint">गोंदवले धाम, इंदौर</span>
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1 md:flex">
            <Suspense fallback={staticDesktopNav}>
              <DesktopNav />
            </Suspense>
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2">
          <SyncStatus />
          <button
            onClick={() => setProfileOpen(true)}
            aria-label={name || "Add your name"}
            className="inline-flex h-10 min-w-0 items-center gap-2 rounded-full border border-line-strong/70 bg-card pr-3.5 pl-1.5 max-[359px]:pr-1.5 text-sm font-semibold text-ink-soft hover:border-primary/50"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-saffron-soft text-gold">
              {name ? name[0].toUpperCase() : <UserRound className="h-4 w-4" />}
            </span>
            {/* very narrow phones: avatar only, so the logo text never gets squeezed */}
            <span className="truncate max-[359px]:hidden">{name || "Add your name"}</span>
          </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 sm:pt-8 md:pb-16">{children}</main>

      <footer className="hidden border-t border-line/60 py-6 text-center text-xs text-ink-faint md:block">
        Harihaat 2026 · <span className="font-hindi">गोंदवले धाम, इंदौर</span> · माँ सती के 51 शक्तिपीठ
      </footer>

      {/* Bottom navigation for phones */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-card/95 backdrop-blur-md md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-3 px-2 pt-1.5">
          <Suspense fallback={<MobileNav />}>
            <MobileNavActive />
          </Suspense>
        </div>
      </nav>

      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}

function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const current = useUserName();
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const [draft, setDraft] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const value = draft ?? current;

  const close = () => {
    setDraft(null);
    onClose();
  };

  const save = () => {
    setUserName(value);
    toast(value.trim() ? `श्री राम, ${value.trim()} 🙏` : "Name removed");
    close();
  };

  const logout = async () => {
    // Changes waiting on this device stay there (they are sent after the next login).
    const waiting = getQueue().length;
    if (
      waiting &&
      !(await confirm({
        title: `${waiting} change${waiting > 1 ? "s are" : " is"} not saved yet`,
        message: "Log out anyway? They will stay on this device and be saved after you log in again.",
        confirmLabel: "Log out",
      }))
    )
      return;
    setLeaving(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    await clearAllCache();
    router.replace("/login");
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title="Your name"
      description="Shown as “Added by …” on ideas, notes and photos you add. Saved only on this device."
      footer={
        <>
          <Button variant="ghost" onClick={logout} loading={leaving} icon={<LogOut className="h-4 w-4" />} className="sm:mr-auto">
            Log out
          </Button>
          <Button onClick={save}>Save name</Button>
        </>
      }
    >
      <Label htmlFor="your-name">Name</Label>
      <Input
        id="your-name"
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="e.g. Ramesh Joshi"
        maxLength={60}
      />
    </Modal>
  );
}

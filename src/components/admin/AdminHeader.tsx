"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/client";

const DOCS_URL = "https://github.com/JLHITS/surgeryscreen-lite#readme";

export function AdminHeader() {
  const router = useRouter();

  async function logout() {
    await api("/api/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/admin" className="flex items-center gap-2" aria-label="SurgeryScreen Lite">
          <Logo className="text-[17px]" />
          <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Lite
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
              <BookOpen className="size-4" />
              <span className="hidden md:inline">Help</span>
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

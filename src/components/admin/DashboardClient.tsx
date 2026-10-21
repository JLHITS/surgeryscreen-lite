"use client";

import { useState } from "react";
import { MonitorPlay, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreatePracticeDialog } from "@/components/admin/CreatePracticeDialog";
import { PracticeCard } from "@/components/admin/PracticeCard";
import type { Practice } from "@/lib/types";

/** Lite runs one display: create it, then edit it. */
export function DashboardClient({
  initialPractices,
  warnings,
}: {
  initialPractices: Practice[];
  warnings: string[];
}) {
  const [practices, setPractices] = useState(initialPractices);
  const [createOpen, setCreateOpen] = useState(false);

  function removePractice(id: string) {
    setPractices((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your display</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The slideshow on your waiting-room screen.
        </p>
      </div>

      {warnings.map((warning) => (
        <div
          key={warning}
          className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>{warning}</p>
        </div>
      ))}

      {practices.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <MonitorPlay className="size-6" />
          </span>
          <h2 className="mt-4 font-semibold">No display yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create your display to start building a slideshow for your waiting room.
          </p>
          <Button className="mt-5" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Create display
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {practices.map((p) => (
            <PracticeCard key={p.id} practice={p} onDeleted={removePractice} />
          ))}
        </div>
      )}

      <CreatePracticeDialog open={createOpen} onOpenChange={setCreateOpen} />
    </main>
  );
}

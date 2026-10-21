"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { api } from "@/lib/client";
import { formatRelativeTime } from "@/lib/format";
import type { Practice } from "@/lib/types";

export function PracticeCard({
  practice,
  onDeleted,
}: {
  practice: Practice;
  onDeleted: (id: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const title = practice.name || practice.slug;

  function copyUrl() {
    const url = `${window.location.origin}/${practice.slug}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Screen address copied"),
      () => toast.error("Couldn't copy"),
    );
  }

  async function onDelete() {
    setDeleting(true);
    try {
      await api(`/api/admin/practices/${practice.slug}`, { method: "DELETE" });
      toast.success(`Deleted "${title}"`);
      onDeleted(practice.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{title}</h3>
          <button
            onClick={copyUrl}
            className="group mt-0.5 inline-flex max-w-full items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            title="Copy screen address"
          >
            <span className="truncate font-mono">/{practice.slug}</span>
            <Copy className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        </div>
        <StatusBadge practice={practice} />
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          {practice.publishedVersion > 0
            ? `Published ${formatRelativeTime(practice.publishedAt)}`
            : "Not published yet"}
        </p>
      </div>

      <div className="mt-auto flex items-center gap-2">
        <Button asChild size="sm" className="flex-1">
          <Link href={`/admin/${practice.slug}`}>
            <Pencil className="size-4" />
            Edit
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={`/${practice.slug}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            Open
          </a>
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
          title="Delete display"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{title}”?</DialogTitle>
            <DialogDescription>
              This permanently removes the display, its slides and the public URL
              <span className="font-mono"> /{practice.slug}</span>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

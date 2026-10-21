"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client";
import { isValidSlug, suggestSlug } from "@/lib/slug";
import type { Practice } from "@/lib/types";

export function CreatePracticeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(false);

  const effectiveSlug = slugEdited ? slug : suggestSlug(name || "");
  const slugValid = effectiveSlug.length > 0 && isValidSlug(effectiveSlug);

  function reset() {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setLoading(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slugValid) return;
    setLoading(true);
    try {
      const { practice } = await api<{ practice: Practice }>("/api/admin/practices", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), slug: effectiveSlug }),
      });
      toast.success(`Created "${practice.name}"`);
      onOpenChange(false);
      reset();
      router.push(`/admin/${practice.slug}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create display.");
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create your display</DialogTitle>
          <DialogDescription>
            Name your waiting-room display and choose the address the screen will open.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Practice / display name</Label>
            <Input
              id="name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Example Surgery"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Public URL</Label>
            <div className="flex items-center rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
              <span className="select-none pl-3 pr-0.5 text-sm text-muted-foreground">/</span>
              <input
                id="slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.replace(/\s+/g, ""));
                }}
                className="h-10 w-full rounded-md bg-transparent pr-3 text-sm outline-none"
                placeholder="ExampleSurgery"
              />
            </div>
            {!slugValid && effectiveSlug.length > 0 ? (
              <p className="text-xs text-destructive">
                Use letters, numbers, hyphens or underscores only.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Your screen opens this address, e.g. <span className="font-mono">/{effectiveSlug || "ExampleSurgery"}</span>.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim() || !slugValid}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Create display
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

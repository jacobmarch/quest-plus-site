"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteSessionNote, upsertSessionNote } from "@/app/actions";
import type { SessionNoteRow } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function SessionNoteForm({
  note,
  onSaved,
}: {
  note?: SessionNoteRow;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    startTransition(async () => {
      const result = await upsertSessionNote({
        id: note?.id,
        title,
        occurredOn: String(formData.get("occurredOn") ?? ""),
        contentMd: String(formData.get("contentMd") ?? ""),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={note?.title}
          placeholder="Session 12: The Rat King"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="occurredOn">Date</Label>
        <Input
          id="occurredOn"
          name="occurredOn"
          type="date"
          defaultValue={note?.occurred_on ?? new Date().toISOString().slice(0, 10)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contentMd">Notes (markdown)</Label>
        <Textarea
          id="contentMd"
          name="contentMd"
          rows={10}
          defaultValue={note?.content_md}
          placeholder={"## Recap\n\n- What happened...\n\n## Loot\n\n- ..."}
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : note ? "Save changes" : "Create session"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SessionNoteDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New session</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New session note</DialogTitle>
          <DialogDescription>
            Log the recap while it is fresh.
          </DialogDescription>
        </DialogHeader>
        <SessionNoteForm onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function SessionNoteEditDialog({ note }: { note: SessionNoteRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex items-center gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            Edit
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit session note</DialogTitle>
          </DialogHeader>
          <SessionNoteForm note={note} onSaved={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Delete "${note.title}"?`)) {
            startTransition(async () => {
              const result = await deleteSessionNote(note.id);
              if (!result.ok) toast.error(result.error);
            });
          }
        }}
      >
        Delete
      </Button>
    </span>
  );
}

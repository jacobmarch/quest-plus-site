"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCharacter } from "@/app/actions";
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

type ClassOption = { id: string; name: string };

export function CreateCharacterDialog({
  kind,
  classes,
}: {
  kind: "pc" | "enemy";
  classes: ClassOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    const classId = String(formData.get("classId") ?? "");
    const maxHp = Number(formData.get("maxHp") ?? 10) || 10;

    startTransition(async () => {
      const result = await createCharacter({
        name,
        kind,
        classId: classId || null,
        maxHp,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      if (result.id) router.push(`/characters/${result.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create {kind === "pc" ? "character" : "enemy"}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            New {kind === "pc" ? "character" : "enemy"}
          </DialogTitle>
          <DialogDescription>
            {kind === "pc"
              ? "Create a player character sheet."
              : "Add a foe to track in the bestiary."}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="Name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="classId">Class</Label>
            <select
              id="classId"
              name="classId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              defaultValue=""
            >
              <option value="">No class</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxHp">Max HP</Label>
            <Input
              id="maxHp"
              name="maxHp"
              type="number"
              min={1}
              defaultValue={10}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

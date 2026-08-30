"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteClass, upsertClass } from "@/app/actions";
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

export function ClassManagerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    const description = String(formData.get("description") ?? "");
    const pointsPerLevel = Number(formData.get("pointsPerLevel") ?? 1) || 1;

    startTransition(async () => {
      const result = await upsertClass({
        name,
        description,
        pointsPerLevel,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New class</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create class</DialogTitle>
          <DialogDescription>
            Classes own skill trees and set how many points each level after
            the first grants.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="className">Name</Label>
            <Input id="className" name="name" required placeholder="e.g. Warden" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="classDescription">Description</Label>
            <Input
              id="classDescription"
              name="description"
              placeholder="Short flavor text"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pointsPerLevel">Skill points per level</Label>
            <Input
              id="pointsPerLevel"
              name="pointsPerLevel"
              type="number"
              min={0}
              defaultValue={1}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteClassButton({
  classId,
  className,
}: {
  classId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      className={className}
      disabled={pending}
      onClick={() => {
        if (
          window.confirm(
            "Delete this class? Its skills and tree layout will be removed.",
          )
        ) {
          startTransition(async () => {
            const result = await deleteClass(classId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            router.push("/trees");
          });
        }
      }}
    >
      Delete class
    </Button>
  );
}

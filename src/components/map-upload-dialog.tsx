"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createMap } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import type { MapRow } from "@/lib/database.types";
import { MAP_BUCKET, validateMapFile, validateMapName } from "@/lib/maps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function MapUploadDialog({ maps, parentId = null, onCreated }: {
  maps: MapRow[];
  parentId?: string | null;
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(formData: FormData) {
    setPending(true);
    setError(null);
    const supabase = createClient();
    let uploadedPath: string | null = null;
    let saved = false;
    try {
      const name = validateMapName(String(formData.get("name") ?? ""));
      const file = formData.get("image");
      if (!(file instanceof File)) throw new Error("Choose a map image.");
      const extension = validateMapFile(file);
      // Decoding catches corrupt/non-image files before any upload takes place.
      const image = await createImageBitmap(file);
      image.close();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in again before uploading.");
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(MAP_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      uploadedPath = path;
      const result = await createMap({ name,
        parentId: String(formData.get("parent") ?? "") || null,
        storagePath: path,
      });
      if (!result.ok) throw new Error(result.error);
      saved = true;
      setOpen(false);
      toast.success("Map uploaded.");
      router.refresh();
      if (result.id) onCreated?.(result.id);
    } catch (err) {
      let message = err instanceof Error ? err.message : "Map upload failed.";
      if (uploadedPath && !saved) {
        // A network failure may hide a successful action response. Never delete
        // a possibly referenced file; the Storage delete policy also enforces it.
        try {
          const { data: existing, error: lookupError } = await supabase.from("maps")
            .select("id").eq("storage_path", uploadedPath).maybeSingle();
          if (lookupError) throw lookupError;
          if (existing) {
            message = "The map was saved, but confirmation failed. Refresh to view it.";
            router.refresh();
          } else {
            const { error: cleanupError } = await supabase.storage.from(MAP_BUCKET).remove([uploadedPath]);
            if (cleanupError) throw cleanupError;
          }
        } catch {
          message += ` Image cleanup could not be confirmed; check Storage object ${uploadedPath}.`;
        }
      }
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setError(null); } }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="size-4" />Upload map</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a map</DialogTitle>
          <DialogDescription>Add a world map or place an image beneath an existing map. JPEG, PNG, or WebP, up to 10 MB.</DialogDescription>
        </DialogHeader>
        <form action={upload} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="map-name">Map name</Label>
            <Input id="map-name" name="name" required maxLength={120} disabled={pending} placeholder="World, region, or city name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="map-parent">Parent map</Label>
            <select id="map-parent" name="parent" defaultValue={parentId ?? ""} disabled={pending} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">None — top-level map</option>
              {maps.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="map-image">Image</Label>
            <Input id="map-image" name="image" type="file" required accept="image/jpeg,image/png,image/webp" disabled={pending} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">{pending ? "Uploading…" : "Upload map"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

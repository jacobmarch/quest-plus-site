"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Map as MapIcon, PanelLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteMap, renameMap } from "@/app/actions";
import { MapUploadDialog } from "@/components/map-upload-dialog";
import { MapViewer } from "@/components/map-viewer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MapRow } from "@/lib/database.types";
import { cn } from "@/lib/utils";

export function MapsExplorer({ maps, isDm }: { maps: MapRow[]; isDm: boolean }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Map<string, boolean>>(() => new Map());
  const [navOpen, setNavOpen] = useState(true);
  const [editing, setEditing] = useState<MapRow | null>(null);
  const [deleting, setDeleting] = useState<MapRow | null>(null);
  const [name, setName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const byId = new Map(maps.map((map) => [map.id, map]));
  const roots = maps.filter((map) => !map.parent_id || !byId.has(map.parent_id));
  const selected = maps.find((map) => map.id === selectedId) ?? roots[0] ?? maps[0];
  const children = new Map<string, MapRow[]>();
  for (const map of maps) {
    if (map.parent_id) children.set(map.parent_id, [...(children.get(map.parent_id) ?? []), map]);
  }

  // Keep the selected branch visible, including after an upload's refresh arrives.
  const selectedAncestors = new Set<string>();
  let ancestor = selected?.parent_id;
  while (ancestor && !selectedAncestors.has(ancestor)) {
    selectedAncestors.add(ancestor);
    ancestor = byId.get(ancestor)?.parent_id ?? null;
  }

  function onCreated(id: string) {
    setSelectedId(id);
    setExpanded(new Map());
    router.refresh();
  }

  function renderBranch(map: MapRow, visited = new Set<string>()) {
    if (visited.has(map.id)) return null;
    const nextVisited = new Set(visited).add(map.id);
    const descendants = children.get(map.id) ?? [];
    const open = expanded.get(map.id) ?? selectedAncestors.has(map.id);
    return (
      <li key={map.id}>
        <div className="flex min-w-0 items-center gap-1">
          {descendants.length ? (
            <Button variant="ghost" size="icon-xs" aria-label={`${open ? "Collapse" : "Expand"} ${map.name}`} aria-expanded={open} onClick={() => setExpanded((current) => {
              const next = new Map(current);
              next.set(map.id, !open);
              return next;
            })}>
              {open ? <ChevronDown /> : <ChevronRight />}
            </Button>
          ) : <span className="w-6 shrink-0" />}
          <button type="button" aria-current={selected?.id === map.id ? "true" : undefined} onClick={() => setSelectedId(map.id)} className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring", selected?.id === map.id && "bg-accent font-medium")}>
            <MapIcon className="size-4 shrink-0" /><span className="truncate" title={map.name}>{map.name}</span>
          </button>
        </div>
        {open && descendants.length > 0 && <ul className="ml-3 space-y-1 border-l pl-2">{descendants.map((child) => renderBranch(child, nextVisited))}</ul>}
      </li>
    );
  }

  function submitRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !name.trim()) return;
    const target = editing;
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await renameMap(target.id, name.trim());
        if (!result.ok) { setActionError(result.error); return; }
        setEditing(null);
        toast.success("Map renamed");
        router.refresh();
      } catch {
        setActionError("Unable to rename the map. Please try again.");
      }
    });
  }

  function confirmDelete() {
    if (!deleting || children.has(deleting.id)) return;
    const target = deleting;
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await deleteMap(target.id);
        if (!result.ok) { setActionError(result.error); return; }
        setDeleting(null);
        if (selected?.id === target.id) setSelectedId(target.parent_id);
        setWarning(result.warning ?? null);
        if (result.warning) toast.warning(result.warning); else toast.success("Map deleted");
        router.refresh();
      } catch {
        setActionError("Unable to delete the map. Please try again.");
      }
    });
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight">Maps</h1><p className="text-sm text-muted-foreground">Explore the world, one location at a time.</p></div>
        {isDm && <MapUploadDialog maps={maps} parentId={null} onCreated={onCreated} />}
      </div>
      {warning && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><p>{warning}</p><Button variant="ghost" size="sm" onClick={() => setWarning(null)}>Dismiss</Button></div>}
      <Button variant="outline" size="sm" aria-expanded={navOpen} aria-controls="map-navigation" onClick={() => setNavOpen(!navOpen)}><PanelLeft /> {navOpen ? "Hide map list" : "Show map list"}</Button>
      <div className={cn("grid min-w-0 gap-4", navOpen && "xl:grid-cols-[16rem_minmax(0,1fr)]")}>
        {navOpen && <nav id="map-navigation" aria-label="Map hierarchy" className="min-w-0 self-start rounded-xl border bg-card p-3">
          <h2 className="mb-2 text-sm font-semibold">Locations</h2>
          {maps.length ? <ul className="max-h-[35svh] space-y-1 overflow-auto xl:max-h-[65svh]">{(roots.length ? roots : maps).map((map) => renderBranch(map))}</ul> : <p className="text-sm text-muted-foreground">No locations yet.</p>}
        </nav>}
        <div className="min-w-0 space-y-3">
          {selected ? <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="min-w-0 break-words text-lg font-semibold">{selected.name}</h2>
              {isDm && <div className="flex flex-wrap items-center gap-2">
                <MapUploadDialog maps={maps} parentId={selected.id} onCreated={onCreated} />
                <Button variant="outline" size="sm" onClick={() => { setEditing(selected); setName(selected.name); setActionError(null); }}><Pencil /> Rename</Button>
                <Button variant="destructive" size="sm" disabled={children.has(selected.id)} title={children.has(selected.id) ? "Delete child maps first" : undefined} onClick={() => { setDeleting(selected); setActionError(null); }}><Trash2 /> Delete</Button>
              </div>}
            </div>
            {isDm && children.has(selected.id) && <p className="text-xs text-muted-foreground">Delete child maps before deleting this location.</p>}
            <MapViewer key={selected.id} map={selected} />
          </> : <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">{isDm ? "Upload your first map to start building the world." : "No maps have been shared yet. Your DM can add them here."}</div>}
        </div>
      </div>
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open && !pending) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename map</DialogTitle><DialogDescription>Change the name shown in the map explorer.</DialogDescription></DialogHeader>
          <form onSubmit={submitRename} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="map-rename">Map name</Label><Input id="map-rename" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoFocus disabled={pending} /></div>
            {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
            <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={pending || !name.trim()}>{pending ? "Saving…" : "Save name"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(open) => { if (!open && !pending) setDeleting(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete map?</DialogTitle><DialogDescription>Delete “{deleting?.name}” and its image permanently? This cannot be undone.</DialogDescription></DialogHeader>
          {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
          {deleting && children.has(deleting.id) && <p role="alert" className="text-sm text-destructive">This map has child maps. Delete them first.</p>}
          <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={pending || !deleting || children.has(deleting.id)} onClick={confirmDelete}>{pending ? "Deleting…" : "Delete map"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

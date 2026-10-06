"use client";

import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { GripVertical, Pencil, X } from "lucide-react";
import { deleteSkill, placeDraftSkill, upsertSkill } from "@/app/actions";
import type { SkillRow } from "@/lib/database.types";
import { collectDependents } from "@/lib/skills";
import { SkillTreeView } from "@/components/skill-tree-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const PENDING_PREFIX = "pending-";
const INLINE_PREFIX = "inline-";
const ROOT_DROP = "__root";

type OptimisticChange =
  | { type: "add"; row: SkillRow }
  | { type: "place"; id: string; parentId: string | null };

function makeRow(
  id: string,
  classId: string,
  fields: Partial<SkillRow>,
): SkillRow {
  return {
    id,
    class_id: classId,
    name: "",
    description: "",
    cost: 1,
    prereq_skill_ids: [],
    is_default: false,
    is_draft: false,
    created_at: new Date().toISOString(),
    ...fields,
  };
}

let keySeed = 0;
const nextKey = (prefix: string) => `${prefix}${Date.now()}-${(keySeed += 1)}`;

export function TreeEditor({
  classId,
  skills,
}: {
  classId: string;
  skills: SkillRow[];
}) {
  const [, startTransition] = useTransition();
  const [optimisticSkills, applyOptimistic] = useOptimistic(
    skills,
    (state: SkillRow[], change: OptimisticChange) => {
      if (change.type === "add") return [...state, change.row];
      return state.map((s) =>
        s.id === change.id
          ? {
              ...s,
              is_draft: false,
              prereq_skill_ids: change.parentId ? [change.parentId] : [],
            }
          : s,
      );
    },
  );

  const placed = optimisticSkills.filter((s) => !s.is_draft);
  const drafts = optimisticSkills.filter((s) => s.is_draft);
  const pendingIds = new Set(
    optimisticSkills
      .filter((s) => s.id.startsWith(PENDING_PREFIX))
      .map((s) => s.id),
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = skills.find((s) => s.id === selectedId) ?? null;

  // ----- inline quick-add on the tree --------------------------------------
  const [inline, setInline] = useState<{
    id: string;
    prereqIds: string[];
  } | null>(null);

  function startInline(prereqIds: string[]) {
    setSelectedId(null);
    setPicked(null);
    setInline({ id: nextKey(INLINE_PREFIX), prereqIds });
  }

  function commitInline(name: string, cost: number, next: boolean) {
    if (!inline) return;
    const { prereqIds } = inline;
    setInline(next ? { id: nextKey(INLINE_PREFIX), prereqIds } : null);
    startTransition(async () => {
      applyOptimistic({
        type: "add",
        row: makeRow(nextKey(PENDING_PREFIX), classId, {
          name,
          cost,
          prereq_skill_ids: prereqIds,
        }),
      });
      const result = await upsertSkill({
        classId,
        name,
        description: "",
        cost,
        prereqSkillIds: prereqIds,
        isDefault: false,
        isDraft: false,
      });
      if (!result.ok) toast.error(result.error);
    });
  }

  const treeSkills = inline
    ? [
        ...placed,
        makeRow(inline.id, classId, { prereq_skill_ids: inline.prereqIds }),
      ]
    : placed;

  // ----- links -------------------------------------------------------------
  function toggleLink(parentId: string, childId: string) {
    const child = skills.find((s) => s.id === childId);
    const parent = skills.find((s) => s.id === parentId);
    if (!child || !parent) return;
    const has = child.prereq_skill_ids.includes(parentId);
    if (!has && collectDependents(skills, childId).has(parentId)) {
      toast.error(`${child.name} already leads to ${parent.name}`);
      return;
    }
    const nextIds = has
      ? child.prereq_skill_ids.filter((id) => id !== parentId)
      : [...child.prereq_skill_ids, parentId];
    startTransition(async () => {
      const result = await upsertSkill({
        id: child.id,
        classId,
        name: child.name,
        description: child.description,
        cost: Number(child.cost),
        prereqSkillIds: nextIds,
        isDefault: child.is_default,
      });
      if (!result.ok) toast.error(result.error);
      else
        toast.success(
          has
            ? `Unlinked ${parent.name} → ${child.name}`
            : `${parent.name} now leads to ${child.name}`,
        );
    });
  }

  // ----- drafts tray -------------------------------------------------------
  const [picked, setPicked] = useState<string | null>(null);
  const [dragGhost, setDragGhost] = useState<{
    id: string;
    x: number;
    y: number;
    overId: string | null;
  } | null>(null);
  const draftDrag = useRef<{
    id: string;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);

  function addDraft(name: string, cost: number, summary: string) {
    startTransition(async () => {
      applyOptimistic({
        type: "add",
        row: makeRow(nextKey(PENDING_PREFIX), classId, {
          name,
          cost,
          description: summary,
          is_draft: true,
        }),
      });
      const result = await upsertSkill({
        classId,
        name,
        description: summary,
        cost,
        prereqSkillIds: [],
        isDefault: false,
        isDraft: true,
      });
      if (!result.ok) toast.error(result.error);
    });
  }

  function placeDraft(id: string, parentId: string | null) {
    const draft = skills.find((s) => s.id === id);
    const parent = parentId ? skills.find((s) => s.id === parentId) : null;
    setPicked(null);
    if (!draft) return;
    startTransition(async () => {
      applyOptimistic({ type: "place", id, parentId });
      const result = await placeDraftSkill(id, classId, parentId);
      if (!result.ok) toast.error(result.error);
      else
        toast.success(
          parent
            ? `${draft.name} now leads from ${parent.name}`
            : `${draft.name} starts a new branch`,
        );
    });
  }

  function dropTargetAt(clientX: number, clientY: number): string | null {
    const hit = document.elementFromPoint(clientX, clientY);
    if (hit?.closest("[data-drop-root]")) return ROOT_DROP;
    const card = hit?.closest<HTMLElement>("[data-skill-id]");
    const id = card?.dataset.skillId;
    return id && !id.startsWith(INLINE_PREFIX) ? id : null;
  }

  function onDraftPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    id: string,
  ) {
    if (event.button !== 0 || id.startsWith(PENDING_PREFIX)) return;
    if ((event.target as HTMLElement).closest("[data-no-drag]")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draftDrag.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
  }

  function onDraftPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = draftDrag.current;
    if (!drag) return;
    if (
      !drag.dragging &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6
    ) {
      return;
    }
    drag.dragging = true;
    setDragGhost({
      id: drag.id,
      x: event.clientX,
      y: event.clientY,
      overId: dropTargetAt(event.clientX, event.clientY),
    });
  }

  function onDraftPointerUp() {
    const drag = draftDrag.current;
    draftDrag.current = null;
    const target = dragGhost?.overId ?? null;
    setDragGhost(null);
    if (!drag) return;
    if (!drag.dragging) {
      setSelectedId(null);
      setPicked((current) => (current === drag.id ? null : drag.id));
      return;
    }
    if (target) placeDraft(drag.id, target === ROOT_DROP ? null : target);
  }

  function onDraftPointerCancel() {
    draftDrag.current = null;
    setDragGhost(null);
  }

  useEffect(() => {
    if (!picked) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPicked(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked]);

  const pickedDraft = picked ? drafts.find((d) => d.id === picked) : null;
  const ghostDraft = dragGhost
    ? drafts.find((d) => d.id === dragGhost.id)
    : null;
  const placing = Boolean(pickedDraft || ghostDraft);

  function handleTreeSelect(id: string | null) {
    if (picked) {
      if (id) placeDraft(picked, id);
      return;
    }
    setSelectedId(id);
  }

  return (
    <div className={cn("space-y-4", dragGhost && "select-none")}>
      <DraftsTray
        drafts={drafts}
        picked={picked}
        draggingId={dragGhost?.id ?? null}
        onAdd={addDraft}
        onOpen={(id) => {
          setPicked(null);
          setSelectedId(id);
        }}
        onPointerDown={onDraftPointerDown}
        onPointerMove={onDraftPointerMove}
        onPointerUp={onDraftPointerUp}
        onPointerCancel={onDraftPointerCancel}
      />

      {pickedDraft ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/50 bg-primary/5 px-3 py-2 text-sm">
          <span>
            Placing <strong>{pickedDraft.name}</strong>: click the ability it
            leads from, or the Tier 1 bar.
          </span>
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => setPicked(null)}
          >
            Cancel (Esc)
          </button>
        </div>
      ) : null}

      <button
        type="button"
        data-drop-root
        onClick={() =>
          pickedDraft ? placeDraft(pickedDraft.id, null) : startInline([])
        }
        className={cn(
          "w-full rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground",
          placing && "border-primary/60 text-foreground",
          dragGhost?.overId === ROOT_DROP &&
            "border-primary bg-primary/10 text-foreground",
        )}
      >
        {placing
          ? "Drop here to start a new Tier 1 branch"
          : "+ New Tier 1 ability"}
      </button>

      <SkillTreeView
        skills={treeSkills}
        unlockedIds={new Set()}
        selectedId={selectedId}
        editable
        onSelect={handleTreeSelect}
        inlineEditId={inline?.id ?? null}
        renderInlineEditor={() => (
          <InlineSkillEditor
            key={inline?.id}
            onCommit={commitInline}
            onCancel={() => setInline(null)}
          />
        )}
        dropTargetId={
          dragGhost?.overId && dragGhost.overId !== ROOT_DROP
            ? dragGhost.overId
            : null
        }
        pendingIds={pendingIds}
        onGrow={(parentId) => startInline([parentId])}
        onLink={toggleLink}
      />

      {ghostDraft && dragGhost ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 w-56 -translate-x-1/2 -translate-y-3/4 -rotate-2 rounded-lg border-2 border-primary bg-card p-2 text-sm shadow-lg"
          style={{ left: dragGhost.x, top: dragGhost.y }}
        >
          <p className="truncate font-semibold">{ghostDraft.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {Number(ghostDraft.cost)} pt{Number(ghostDraft.cost) === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      {selected ? (
        <SkillDetailsPanel
          key={selected.id}
          skill={selected}
          skills={skills}
          classId={classId}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

// --------------------------------------------------------------- drafts tray

function DraftsTray({
  drafts,
  picked,
  draggingId,
  onAdd,
  onOpen,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  drafts: SkillRow[];
  picked: string | null;
  draggingId: string | null;
  onAdd: (name: string, cost: number, summary: string) => void;
  onOpen: (id: string) => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>, id: string) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("1");
  const [summary, setSummary] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, Math.max(0, Number(cost) || 0), summary.trim());
    setName("");
    setSummary("");
    nameRef.current?.focus();
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Drafts</h2>
        <p className="text-xs text-muted-foreground">
          Jot ideas here. Players can’t see drafts until you drag them onto
          the tree.
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        className="grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_5rem_minmax(0,2fr)_auto] sm:items-end"
      >
        <div className="space-y-1">
          <Label htmlFor="draftName">Name</Label>
          <Input
            id="draftName"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hail of Thorns"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="draftCost">Cost</Label>
          <Input
            id="draftCost"
            type="number"
            min={0}
            step="0.5"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="draftSummary">One-line summary</Label>
          <Input
            id="draftSummary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What it does at a glance"
          />
        </div>
        <Button type="submit" disabled={!name.trim()}>
          Add draft
        </Button>
      </form>

      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-lg border border-dashed bg-muted/40 p-2">
        {drafts.length === 0 ? (
          <span className="px-1 text-xs text-muted-foreground">
            No drafts. New ideas land here until you place them.
          </span>
        ) : (
          drafts.map((draft) => {
            const pending = draft.id.startsWith(PENDING_PREFIX);
            const summaryLine = draft.description.split("\n", 1)[0].trim();
            return (
              <div
                key={draft.id}
                role="button"
                tabIndex={pending ? -1 : 0}
                aria-pressed={picked === draft.id}
                title="Drag onto the tree, or click to pick up"
                onPointerDown={(event) => onPointerDown(event, draft.id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onKeyDown={(event) => {
                  if (pending) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(draft.id);
                  }
                }}
                className={cn(
                  "flex max-w-60 touch-none items-center gap-1.5 rounded-lg border bg-card py-1.5 pr-1 pl-1.5 text-left shadow-sm select-none",
                  pending ? "opacity-60" : "cursor-grab",
                  picked === draft.id && "ring-2 ring-primary",
                  draggingId === draft.id && "opacity-40",
                )}
              >
                <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {draft.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {Number(draft.cost)} pt{Number(draft.cost) === 1 ? "" : "s"}
                    {summaryLine ? ` · ${summaryLine}` : ""}
                  </span>
                </span>
                {pending ? null : (
                  <button
                    type="button"
                    data-no-drag
                    aria-label={`Edit ${draft.name}`}
                    onClick={() => onOpen(draft.id)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

// --------------------------------------------------------- inline quick-add

function InlineSkillEditor({
  onCommit,
  onCancel,
}: {
  onCommit: (name: string, cost: number, next: boolean) => void;
  onCancel: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("1");

  useEffect(() => {
    nameRef.current?.focus();
    rootRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  function finish(next: boolean) {
    if (done.current) return;
    done.current = true;
    const trimmed = name.trim();
    if (trimmed) onCommit(trimmed, Math.max(0, Number(cost) || 0), next);
    else onCancel();
  }

  return (
    <div
      ref={rootRef}
      className="space-y-1.5 rounded-xl border-2 border-primary bg-card p-2 shadow-sm"
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
        }
      }}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
          finish(false);
        }
      }}
    >
      <Input
        ref={nameRef}
        aria-label="Ability name"
        placeholder="Ability name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-7"
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Label htmlFor="inlineCost" className="text-xs font-normal">
          Cost
        </Label>
        <Input
          id="inlineCost"
          type="number"
          min={0}
          step="0.5"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="h-6 w-16 px-1.5 text-xs"
        />
        <span className="truncate">Enter: next · Esc: done</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ details panel

function SkillDetailsPanel({
  skill,
  skills,
  classId,
  onClose,
}: {
  skill: SkillRow;
  skills: SkillRow[];
  classId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description);
  const [cost, setCost] = useState(String(Number(skill.cost)));
  const [isDefault, setIsDefault] = useState(skill.is_default);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [, startTransition] = useTransition();

  // Latest values for the debounced save and the save-on-close flush.
  const latest = useRef({ name, description, cost, isDefault });
  const skillRef = useRef(skill);
  const deleted = useRef(false);
  useEffect(() => {
    latest.current = { name, description, cost, isDefault };
    skillRef.current = skill;
  });

  const isDirty = useCallback(() => {
    const v = latest.current;
    const s = skillRef.current;
    return (
      v.name.trim() !== s.name ||
      v.description !== s.description ||
      Math.max(0, Number(v.cost) || 0) !== Number(s.cost) ||
      v.isDefault !== s.is_default
    );
  }, []);

  const save = useCallback(
    async (overrides?: { prereqSkillIds?: string[]; isDraft?: boolean }) => {
      const v = latest.current;
      const s = skillRef.current;
      const trimmed = v.name.trim();
      if (!trimmed || deleted.current) return;
      setStatus("saving");
      const result = await upsertSkill({
        id: s.id,
        classId,
        name: trimmed,
        description: v.description,
        cost: Math.max(0, Number(v.cost) || 0),
        prereqSkillIds: overrides?.prereqSkillIds ?? s.prereq_skill_ids,
        isDefault: v.isDefault,
        isDraft: overrides?.isDraft,
      });
      if (!result.ok) {
        toast.error(result.error);
        setStatus("idle");
        return false;
      }
      setStatus("saved");
      return true;
    },
    [classId],
  );

  // Debounced autosave while typing.
  useEffect(() => {
    if (!name.trim() || !isDirty()) return;
    const timer = setTimeout(() => void save(), 700);
    return () => clearTimeout(timer);
  }, [name, description, cost, isDefault, isDirty, save]);

  // Flush anything unsaved when the panel closes or switches skill.
  useEffect(
    () => () => {
      if (!deleted.current && latest.current.name.trim() && isDirty()) {
        void save();
      }
    },
    [isDirty, save],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const nameById = new Map(skills.map((s) => [s.id, s.name]));
  const blocked = collectDependents(skills, skill.id);
  const candidates = skills
    .filter(
      (s) =>
        !s.is_draft &&
        !blocked.has(s.id) &&
        !skill.prereq_skill_ids.includes(s.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const hasDependents = blocked.size > 1;

  function setPrereqs(next: string[]) {
    startTransition(async () => {
      await save({ prereqSkillIds: next });
    });
  }

  return (
    <aside
      aria-label={`Edit ${skill.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-background shadow-xl sm:w-[28rem]"
    >
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {skill.is_draft ? "Draft ability" : "Ability"}
          </p>
          <h2 className="truncate font-semibold">{name.trim() || "Untitled"}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid grid-cols-[1fr_5.5rem] gap-3">
          <div className="space-y-1">
            <Label htmlFor="detailName">Name</Label>
            <Input
              id="detailName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!name.trim()}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="detailCost">Cost</Label>
            <Input
              id="detailCost"
              type="number"
              min={0}
              step="0.5"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="detailDescription">Description</Label>
          <Textarea
            id="detailDescription"
            rows={12}
            className="min-h-60"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              "First line is the summary shown on the card.\n\nThen the full write-up: range, duration, scaling, flavor…"
            }
          />
          <p className="text-xs text-muted-foreground">
            The first line shows on the tree card.
          </p>
        </div>

        {skill.is_draft ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Drag this draft onto the tree to place it. Players can’t see it
            until then.
          </p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              <span>
                Starting skill
                <span className="ml-1 text-muted-foreground">
                  (granted free at character creation)
                </span>
              </span>
            </label>

            <div className="space-y-1.5">
              <Label>Leads from</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                {skill.prereq_skill_ids.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Tier 1 (no prerequisites)
                  </span>
                ) : null}
                {skill.prereq_skill_ids.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-xs"
                  >
                    {nameById.get(id) ?? "?"}
                    <button
                      type="button"
                      aria-label={`Remove ${nameById.get(id) ?? "prerequisite"}`}
                      className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setPrereqs(skill.prereq_skill_ids.filter((p) => p !== id))
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {candidates.length > 0 ? (
                  <select
                    aria-label="Add a prerequisite"
                    value=""
                    onChange={(e) => {
                      if (e.target.value)
                        setPrereqs([...skill.prereq_skill_ids, e.target.value]);
                    }}
                    className="rounded-full border border-dashed bg-transparent px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    <option value="">+ add prerequisite…</option>
                    {candidates.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
        <span className="text-xs text-muted-foreground">
          {!name.trim()
            ? "Add a name to save"
            : status === "saving"
              ? "Saving…"
              : status === "saved"
                ? "Saved · players see changes live"
                : "Saves as you type"}
        </span>
        <div className="flex gap-2">
          {!skill.is_draft ? (
            <Button
              variant="outline"
              size="sm"
              disabled={hasDependents}
              title={
                hasDependents
                  ? "Other abilities lead from this one"
                  : "Hide it from players and move it back to the drafts tray"
              }
              onClick={() =>
                startTransition(async () => {
                  if (await save({ isDraft: true })) onClose();
                })
              }
            >
              Move to drafts
            </Button>
          ) : null}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (!window.confirm(`Delete "${skill.name}"?`)) return;
              deleted.current = true;
              startTransition(async () => {
                const result = await deleteSkill(skill.id, classId);
                if (!result.ok) {
                  deleted.current = false;
                  toast.error(result.error);
                  return;
                }
                toast.success("Ability deleted");
                onClose();
              });
            }}
          >
            Delete
          </Button>
        </div>
      </footer>
    </aside>
  );
}

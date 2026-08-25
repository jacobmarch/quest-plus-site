"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Plus, X } from "lucide-react";
import type { SkillRow } from "@/lib/database.types";
import { buildTierColumns, orderSkillsByBranch } from "@/lib/skills";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Rect = { left: number; top: number; width: number; height: number };

const STATE_CARD: Record<string, string> = {
  learned: "border-primary bg-primary text-primary-foreground",
  available: "border-foreground/40 bg-card hover:border-primary",
  locked: "border-border bg-muted/60 opacity-75",
};

export function SkillTreeView({
  skills,
  unlockedIds,
  selectedId,
  editable = false,
  onSelect,
  onTogglePrereq,
}: {
  skills: SkillRow[];
  unlockedIds: Set<string>;
  selectedId?: string | null;
  editable?: boolean;
  onSelect?: (skillId: string | null) => void;
  /** (childId, newParentId) — add or remove a prerequisite link */
  onTogglePrereq?: (childId: string, parentId: string) => void;
}) {
  const learnedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const skill of skills) {
      if (unlockedIds.has(skill.id)) ids.add(skill.id);
    }
    return ids;
  }, [skills, unlockedIds]);

  const columns = useMemo(
    () => {
      const { ordered, tierOf } = orderSkillsByBranch(skills);
      return buildTierColumns(ordered, tierOf);
    },
    [skills],
  );

  const nameById = useMemo(
    () => new Map(skills.map((s) => [s.id, s.name])),
    [skills],
  );

  // ----- connector geometry -------------------------------------------------
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [rects, setRects] = useState<Map<string, Rect>>(new Map());

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const origin = container.getBoundingClientRect();
    const next = new Map<string, Rect>();
    cardRefs.current.forEach((el, id) => {
      const box = el.getBoundingClientRect();
      next.set(id, {
        left: box.left - origin.left,
        top: box.top - origin.top,
        width: box.width,
        height: box.height,
      });
    });
    setRects(next);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, skills, unlockedIds, selectedId, columns]);

  useEffect(() => {
    const observer = new ResizeObserver(() => measure());
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const edges = useMemo(() => {
    const list: Array<{ key: string; d: string; active: boolean }> = [];
    if (rects.size === 0) return list;
    for (const skill of skills) {
      const child = rects.get(skill.id);
      if (!child) continue;
      for (const parentId of skill.prereq_skill_ids) {
        const parent = rects.get(parentId);
        if (!parent) continue;
        const x1 = parent.left + parent.width;
        const y1 = parent.top + parent.height / 2;
        const x2 = child.left;
        const y2 = child.top + child.height / 2;
        const mid = (x1 + x2) / 2;
        list.push({
          key: `${parentId}->${skill.id}`,
          d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`,
          active:
            unlockedIds.has(skill.id) && unlockedIds.has(parentId),
        });
      }
    }
    return list;
  }, [skills, rects, unlockedIds]);

  // ----- edit-mode link picking --------------------------------------------
  const [pickingParentFor, setPickingParentFor] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!pickingParentFor) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickingParentFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickingParentFor]);

  function handleCardClick(skillId: string) {
    if (editable && pickingParentFor && pickingParentFor !== skillId) {
      onTogglePrereq?.(pickingParentFor, skillId);
      setPickingParentFor(null);
      return;
    }
    onSelect?.(selectedId === skillId ? null : skillId);
  }

  if (skills.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        No abilities yet{editable ? " — add the first one above" : ""}.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {editable && pickingParentFor ? (
        <div className="flex items-center justify-between rounded-md border border-primary/50 bg-primary/5 px-3 py-2 text-sm">
          <span>
            Pick the ability that leads to{" "}
            <strong>{nameById.get(pickingParentFor)}</strong>
          </span>
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => setPickingParentFor(null)}
          >
            Cancel (Esc)
          </button>
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="relative overflow-x-auto pb-2"
      >
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full"
        >
          {edges.map((edge) => (
            <path
              key={edge.key}
              d={edge.d}
              fill="none"
              strokeWidth={edge.active ? 2 : 1.5}
              strokeDasharray={edge.active ? undefined : "4 4"}
              className={
                edge.active
                  ? "stroke-primary"
                  : "stroke-muted-foreground/50"
              }
            />
          ))}
        </svg>

        <div
          className="relative flex min-w-fit items-stretch gap-16 px-2 py-2"
          style={{ minHeight: 160 }}
        >
          {columns.map(({ tier, skills: tierSkills }) => (
            <section
              key={tier}
              className="flex w-60 shrink-0 flex-col items-center gap-6"
            >
              <Badge variant="outline" className="bg-background">
                Tier {tier + 1}
              </Badge>
              {tierSkills.map((skill) => {
                const state = unlockedIds.has(skill.id)
                  ? "learned"
                  : skill.prereq_skill_ids.every((id) =>
                        learnedIds.has(id),
                      )
                    ? "available"
                    : "locked";
                const isSelected = selectedId === skill.id;
                return (
                  <div
                    key={skill.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(skill.id, el);
                      else cardRefs.current.delete(skill.id);
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleCardClick(skill.id)}
                      className={cn(
                        "w-full rounded-xl border-2 p-3 text-left shadow-sm transition-colors",
                        STATE_CARD[state],
                        isSelected &&
                          "ring-2 ring-ring ring-offset-2 ring-offset-background",
                      )}
                    >
                      <p className="text-sm font-semibold leading-tight">
                        {skill.name}
                      </p>
                      <p className="mt-1 text-xs opacity-80">
                        {Number(skill.cost)} pt
                        {Number(skill.cost) === 1 ? "" : "s"}
                      </p>
                      {editable ? (
                        <div className="mt-2 space-y-1">
                          {skill.prereq_skill_ids.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {skill.prereq_skill_ids.map((parentId) => (
                                <span
                                  key={parentId}
                                  className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium text-foreground"
                                  title={`Requires ${nameById.get(parentId) ?? "unknown"}`}
                                >
                                  ↑ {nameById.get(parentId) ?? "?"}
                                  <X
                                    className="size-3 cursor-pointer opacity-70 hover:opacity-100"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onTogglePrereq?.(skill.id, parentId);
                                    }}
                                  />
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <span
                            role="button"
                            tabIndex={0}
                            className="inline-flex items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-[11px] opacity-80 hover:opacity-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPickingParentFor(skill.id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.stopPropagation();
                                setPickingParentFor(skill.id);
                              }
                            }}
                          >
                            <Plus className="size-3" /> link from prior tier
                          </span>
                        </div>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

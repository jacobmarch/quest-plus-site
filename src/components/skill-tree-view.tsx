"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EyeOff, Plus } from "lucide-react";
import type { SkillRow } from "@/lib/database.types";
import { layoutSkillTree } from "@/lib/skills";
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
  hiddenIds,
  selectedId,
  editable = false,
  onSelect,
  inlineEditId,
  renderInlineEditor,
  dropTargetId,
  onGrow,
  onLink,
  pendingIds,
}: {
  skills: SkillRow[];
  unlockedIds: Set<string>;
  /** DM view: abilities players can't see yet, drawn dashed. */
  hiddenIds?: Set<string>;
  selectedId?: string | null;
  editable?: boolean;
  onSelect?: (skillId: string | null) => void;
  /** Skill rendered with `renderInlineEditor` instead of a card (DM quick-add). */
  inlineEditId?: string | null;
  renderInlineEditor?: (skill: SkillRow) => ReactNode;
  /** Card highlighted while something is dragged over it. */
  dropTargetId?: string | null;
  /** Click on a card's + handle: add a skill that leads from it. */
  onGrow?: (parentId: string) => void;
  /** Drag from a card's + handle onto another card. */
  onLink?: (parentId: string, childId: string) => void;
  /** Skills still saving: shown dimmed, not clickable. */
  pendingIds?: Set<string>;
}) {
  const learnedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const skill of skills) {
      if (unlockedIds.has(skill.id)) ids.add(skill.id);
    }
    return ids;
  }, [skills, unlockedIds]);

  const tree = useMemo(() => layoutSkillTree(skills), [skills]);
  const columns = tree.columns;

  // ----- connector geometry -------------------------------------------------
  // The SVG must cover the full tree *content* (not the visible scrollport).
  // Overlaying it on overflow-x-auto clips later-tier edges and, after a
  // remeasure on select, desyncs earlier branches from the scrolled cards.
  const contentRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [layout, setLayout] = useState<{
    rects: Map<string, Rect>;
    width: number;
    height: number;
  }>({ rects: new Map(), width: 0, height: 0 });

  const measure = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    const origin = content.getBoundingClientRect();
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
    setLayout({
      rects: next,
      width: content.offsetWidth,
      height: content.offsetHeight,
    });
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, skills, unlockedIds, selectedId, columns]);

  useEffect(() => {
    const observer = new ResizeObserver(() => measure());
    if (contentRef.current) observer.observe(contentRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const edges = useMemo(() => {
    const list: Array<{ key: string; d: string; active: boolean }> = [];
    const { rects } = layout;
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
  }, [skills, layout, unlockedIds]);

  // ----- edit-mode grow / link handle --------------------------------------
  // Click the + to grow a new child; drag it onto another card to link.
  const growDrag = useRef<{
    fromId: string;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const [linkLine, setLinkLine] = useState<{
    fromId: string;
    x: number;
    y: number;
    overId: string | null;
  } | null>(null);

  function skillIdAt(clientX: number, clientY: number): string | null {
    const hit = document.elementFromPoint(clientX, clientY);
    const card = hit?.closest<HTMLElement>("[data-skill-id]");
    return card?.dataset.skillId ?? null;
  }

  function handleGrowPointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
    fromId: string,
  ) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    growDrag.current = {
      fromId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
  }

  function handleGrowPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = growDrag.current;
    const content = contentRef.current;
    if (!drag || !content) return;
    if (
      !drag.dragging &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6
    ) {
      return;
    }
    drag.dragging = true;
    const origin = content.getBoundingClientRect();
    const overId = skillIdAt(event.clientX, event.clientY);
    setLinkLine({
      fromId: drag.fromId,
      x: event.clientX - origin.left,
      y: event.clientY - origin.top,
      overId: overId && overId !== drag.fromId ? overId : null,
    });
  }

  function handleGrowPointerUp() {
    const drag = growDrag.current;
    growDrag.current = null;
    const target = linkLine?.overId ?? null;
    setLinkLine(null);
    if (!drag) return;
    if (!drag.dragging) onGrow?.(drag.fromId);
    else if (target) onLink?.(drag.fromId, target);
  }

  function handleGrowPointerCancel() {
    growDrag.current = null;
    setLinkLine(null);
  }

  function handleCardClick(skillId: string) {
    onSelect?.(selectedId === skillId ? null : skillId);
  }

  const linkLinePath = useMemo(() => {
    if (!linkLine) return null;
    const from = layout.rects.get(linkLine.fromId);
    if (!from) return null;
    const x1 = from.left + from.width;
    const y1 = from.top + from.height / 2;
    const mid = (x1 + linkLine.x) / 2;
    return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${linkLine.y}, ${linkLine.x} ${linkLine.y}`;
  }, [linkLine, layout]);

  if (skills.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        No abilities yet{editable ? " — add the first one above" : ""}.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-2">
        <div ref={contentRef} className="relative min-w-fit">
          <svg
            aria-hidden
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${Math.max(layout.width, 1)} ${Math.max(layout.height, 1)}`}
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
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
            {linkLinePath ? (
              <path
                d={linkLinePath}
                fill="none"
                strokeWidth={2}
                strokeDasharray="5 4"
                className="stroke-primary"
              />
            ) : null}
          </svg>

          <div
            className="relative grid px-2 py-2"
            style={{
              minHeight: 160,
              gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, 15rem)`,
              gridTemplateRows: `auto repeat(${Math.max(tree.maxLane + 1, 1)}, auto)`,
              columnGap: "4rem",
              rowGap: "1.5rem",
            }}
          >
            {columns.map(({ tier }) => (
              <div
                key={`label-${tier}`}
                className="flex justify-center"
                style={{ gridColumn: tier + 1, gridRow: 1 }}
              >
                <Badge variant="outline" className="bg-background">
                  Tier {tier + 1}
                </Badge>
              </div>
            ))}
            {columns.flatMap(({ tier, skills: tierSkills }) =>
              tierSkills.map((skill) => {
                const state = unlockedIds.has(skill.id)
                  ? "learned"
                  : skill.prereq_skill_ids.every((id) =>
                        learnedIds.has(id),
                      )
                    ? "available"
                    : "locked";
                const isSelected = selectedId === skill.id;
                if (inlineEditId === skill.id && renderInlineEditor) {
                  return (
                    <div
                      key={skill.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(skill.id, el);
                        else cardRefs.current.delete(skill.id);
                      }}
                      className="min-w-0"
                      style={{ gridColumn: tier + 1, gridRow: skill.lane + 2 }}
                    >
                      {renderInlineEditor(skill)}
                    </div>
                  );
                }
                const isPending = pendingIds?.has(skill.id) ?? false;
                const isHidden = hiddenIds?.has(skill.id) ?? false;
                const summary = editable
                  ? skill.description.split("\n", 1)[0].trim()
                  : "";
                return (
                  <div
                    key={skill.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(skill.id, el);
                      else cardRefs.current.delete(skill.id);
                    }}
                    className="relative min-w-0"
                    style={{
                      gridColumn: tier + 1,
                      gridRow: skill.lane + 2,
                    }}
                  >
                    <button
                      type="button"
                      data-skill-id={isPending ? undefined : skill.id}
                      disabled={isPending}
                      onClick={() => handleCardClick(skill.id)}
                      className={cn(
                        "w-full rounded-xl border-2 p-3 text-left shadow-sm transition-colors",
                        STATE_CARD[editable ? "available" : state],
                        isSelected &&
                          "ring-2 ring-ring ring-offset-2 ring-offset-background",
                        (dropTargetId === skill.id ||
                          linkLine?.overId === skill.id) &&
                          "border-primary bg-primary/10",
                        isPending && "opacity-60",
                        isHidden && "border-dashed opacity-70",
                      )}
                    >
                      <p className="truncate text-sm font-semibold leading-tight">
                        {isHidden ? (
                          <EyeOff
                            aria-label={
                              skill.is_hidden
                                ? "Hidden from players"
                                : "Hidden: below a hidden ability"
                            }
                            className="mr-1.5 inline size-3.5 align-[-2px]"
                          />
                        ) : null}
                        {skill.name}
                        {editable && skill.is_default ? (
                          <Badge variant="secondary" className="ml-1.5 align-middle text-[10px]">
                            Start
                          </Badge>
                        ) : null}
                      </p>
                      <p className="mt-1 truncate text-xs opacity-80">
                        {Number(skill.cost)} pt
                        {Number(skill.cost) === 1 ? "" : "s"}
                        {summary ? ` · ${summary}` : ""}
                      </p>
                    </button>
                    {editable && !isPending ? (
                      <button
                        type="button"
                        aria-label={`Add an ability that leads from ${skill.name}`}
                        title="Click to add the next ability · drag onto another ability to link or unlink"
                        onPointerDown={(event) =>
                          handleGrowPointerDown(event, skill.id)
                        }
                        onPointerMove={handleGrowPointerMove}
                        onPointerUp={handleGrowPointerUp}
                        onPointerCancel={handleGrowPointerCancel}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onGrow?.(skill.id);
                          }
                        }}
                        className="absolute -right-3 top-1/2 z-10 grid size-6 -translate-y-1/2 touch-none place-items-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                );
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

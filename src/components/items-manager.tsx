"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  EyeOff,
  Gem,
  PackageOpen,
  Plus,
  Search,
  Swords,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  adjustInventory,
  assignItem,
  deleteItem,
  upsertItem,
} from "@/app/actions";
import type { ItemRow } from "@/lib/database.types";
import {
  ASSIGN_QUANTITY_MAX,
  ITEM_DAMAGE_MAX,
  catalogKey,
  filterCatalog,
  holdersByItemName,
  parseItemEffects,
  type CatalogFilter,
  type ItemEffect,
  type ItemHolder,
} from "@/lib/items";
import {
  EffectList,
  emptyDraftEffect,
} from "@/components/item-effects-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CatalogCharacter = {
  id: string;
  name: string;
  kind: string;
  is_dead: boolean;
};

type InventoryCopy = {
  character_id: string;
  item_name: string;
  quantity: number;
};

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const KIND_FILTERS: Array<{ value: CatalogFilter["kind"]; label: string }> = [
  { value: "all", label: "All" },
  { value: "unique", label: "Unique" },
  { value: "common", label: "Common" },
];

export function ItemsManager({
  items,
  characters,
  inventory,
}: {
  items: ItemRow[];
  characters: CatalogCharacter[];
  inventory: InventoryCopy[];
}) {
  const [filter, setFilter] = useState<CatalogFilter>({
    query: "",
    kind: "all",
    holder: "any",
  });
  // An item id, "new" for the create form, or null when nothing is open.
  const [openId, setOpenId] = useState<string | null>(null);

  const holders = useMemo(
    () =>
      holdersByItemName(
        inventory,
        new Map(characters.map((c) => [c.id, c.name])),
      ),
    [inventory, characters],
  );
  const visible = useMemo(
    () => filterCatalog(items, holders, filter),
    [items, holders, filter],
  );
  const openItem = items.find((item) => item.id === openId);
  const filtering =
    filter.query.trim() !== "" || filter.kind !== "all" || filter.holder !== "any";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search items"
            placeholder="Search names, effects, or who has it"
            value={filter.query}
            className="pl-8"
            onChange={(e) => setFilter({ ...filter, query: e.target.value })}
          />
        </div>
        <div
          role="group"
          aria-label="Item kind"
          className="flex shrink-0 rounded-lg border p-0.5"
        >
          {KIND_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter.kind === option.value}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
                filter.kind === option.value &&
                  "bg-secondary font-medium text-secondary-foreground",
              )}
              onClick={() => setFilter({ ...filter, kind: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Who has it"
          className={cn(selectClass, "sm:w-48")}
          value={filter.holder}
          onChange={(e) => setFilter({ ...filter, holder: e.target.value })}
        >
          <option value="any">Anyone or no one</option>
          <option value="unclaimed">Not handed out</option>
          <CharacterOptions characters={characters} />
        </select>
        <Button className="shrink-0" onClick={() => setOpenId("new")}>
          <Plus />
          New item
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing in the catalog yet"
          body="Make your first item, then hand it to a character from its card."
          action={
            <Button onClick={() => setOpenId("new")}>
              <Plus />
              New item
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No items match"
          body="Try a different search or clear the filters."
          action={
            <Button
              variant="outline"
              onClick={() =>
                setFilter({ query: "", kind: "all", holder: "any" })
              }
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          {filtering ? (
            <p className="text-sm text-muted-foreground">
              Showing {visible.length} of {items.length} items
            </p>
          ) : null}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) => (
              <li key={item.id}>
                <ItemCard
                  item={item}
                  holders={holders.get(catalogKey(item.name)) ?? []}
                  onOpen={() => setOpenId(item.id)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {openId === "new" ? (
        <ItemDialog
          key="new"
          characters={characters}
          holders={[]}
          onClose={() => setOpenId(null)}
          onCreated={(id) => setOpenId(id)}
        />
      ) : openItem ? (
        <ItemDialog
          key={openItem.id}
          item={openItem}
          characters={characters}
          holders={holders.get(catalogKey(openItem.name)) ?? []}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}

function CharacterOptions({
  characters,
  exclude = [],
}: {
  characters: CatalogCharacter[];
  exclude?: string[];
}) {
  const available = characters.filter((c) => !exclude.includes(c.id));
  const pcs = available.filter((c) => c.kind === "pc");
  const others = available.filter((c) => c.kind !== "pc");
  const label = (c: CatalogCharacter) => (c.is_dead ? `${c.name} (dead)` : c.name);
  return (
    <>
      {pcs.length > 0 ? (
        <optgroup label="Player characters">
          {pcs.map((c) => (
            <option key={c.id} value={c.id}>
              {label(c)}
            </option>
          ))}
        </optgroup>
      ) : null}
      {others.length > 0 ? (
        <optgroup label="Enemies">
          {others.map((c) => (
            <option key={c.id} value={c.id}>
              {label(c)}
            </option>
          ))}
        </optgroup>
      ) : null}
    </>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <PackageOpen className="size-8 text-muted-foreground" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}

function UniqueBadge() {
  return (
    <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300">
      <Gem />
      Unique
    </Badge>
  );
}

function HolderSummary({
  holders,
  isUnique,
}: {
  holders: ItemHolder[];
  isUnique: boolean;
}) {
  if (holders.length === 0) {
    return (
      <span className="text-muted-foreground">
        {isUnique ? "Unclaimed" : "Not handed out"}
      </span>
    );
  }
  const shown = holders.slice(0, 3);
  return (
    <span className="min-w-0 truncate">
      {shown
        .map((h) => (h.quantity > 1 ? `${h.characterName} ×${h.quantity}` : h.characterName))
        .join(", ")}
      {holders.length > shown.length ? (
        <span className="text-muted-foreground">
          {" "}
          +{holders.length - shown.length} more
        </span>
      ) : null}
    </span>
  );
}

function ItemCard({
  item,
  holders,
  onOpen,
}: {
  item: ItemRow;
  holders: ItemHolder[];
  onOpen: () => void;
}) {
  const effects = parseItemEffects(item.effects);
  const shownEffects = effects.slice(0, 3);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex h-full w-full flex-col gap-3 rounded-xl border bg-card p-4 text-left text-card-foreground transition-colors hover:border-foreground/25 hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        item.is_unique && "border-amber-500/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="leading-snug font-semibold">{item.name}</h3>
        {item.is_unique ? <UniqueBadge /> : null}
      </div>
      {item.description ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {item.description}
        </p>
      ) : null}
      {item.damage || effects.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {item.damage ? (
            <Badge variant="secondary">
              <Swords />
              {item.damage}
            </Badge>
          ) : null}
          {shownEffects.map((effect, index) => (
            <Badge key={`${effect.name}-${index}`} variant="outline">
              {effect.hidden ? <EyeOff aria-label="Hidden" /> : null}
              {effect.name}
            </Badge>
          ))}
          {effects.length > shownEffects.length ? (
            <Badge variant="outline">
              +{effects.length - shownEffects.length}
            </Badge>
          ) : null}
        </div>
      ) : null}
      <div className="mt-auto flex items-center gap-2 border-t pt-3 text-sm">
        <UserRound className="size-4 shrink-0 text-muted-foreground" />
        <HolderSummary holders={holders} isUnique={item.is_unique} />
      </div>
    </button>
  );
}

function ItemDialog({
  item,
  characters,
  holders,
  onClose,
  onCreated,
}: {
  item?: ItemRow;
  characters: CatalogCharacter[];
  holders: ItemHolder[];
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const savedEffects = useMemo(
    () => (item ? parseItemEffects(item.effects) : []),
    [item],
  );
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [damage, setDamage] = useState(item?.damage ?? "");
  // Most catalog items are one-offs, so new items start out unique.
  const [isUnique, setIsUnique] = useState(item?.is_unique ?? true);
  const [effects, setEffects] = useState<ItemEffect[]>(savedEffects);
  const [draft, setDraft] = useState<ItemEffect>(emptyDraftEffect);

  const dirty = item
    ? name.trim() !== item.name ||
      description.trim() !== item.description ||
      damage.trim() !== item.damage ||
      isUnique !== item.is_unique ||
      JSON.stringify(effects) !== JSON.stringify(savedEffects)
    : name.trim() !== "" ||
      description.trim() !== "" ||
      damage.trim() !== "" ||
      effects.length > 0;
  const renamingHeldItem =
    item && holders.length > 0 && catalogKey(name) !== catalogKey(item.name);

  function requestClose() {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    onClose();
  }

  function save() {
    if (!name.trim()) {
      toast.error("Give the item a name");
      return;
    }
    startTransition(async () => {
      const result = await upsertItem({
        id: item?.id,
        name,
        description,
        damage,
        isUnique,
        effects,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(item ? "Item saved" : `${name.trim()} added`);
      router.refresh();
      if (!item && result.id) onCreated?.(result.id);
    });
  }

  function remove() {
    if (!item) return;
    if (!window.confirm(`Delete "${item.name}" from the catalog?`)) return;
    startTransition(async () => {
      const result = await deleteItem(item.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${item.name} deleted`);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : requestClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <DialogTitle className="text-lg">
              {item ? item.name : "New item"}
            </DialogTitle>
            {item?.is_unique ? <UniqueBadge /> : null}
          </div>
          <DialogDescription>
            {item
              ? "Hand it to a character or change what it does."
              : "Describe the item, then hand it to someone once it's saved."}
          </DialogDescription>
        </DialogHeader>

        {item ? (
          <>
            <HoldersSection
              item={item}
              characters={characters}
              holders={holders}
            />
            <Separator />
          </>
        ) : null}

        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={name}
              maxLength={200}
              placeholder="e.g. Gorvak's Axe"
              onChange={(e) => setName(e.target.value)}
            />
            {renamingHeldItem ? (
              <p className="text-xs text-muted-foreground">
                Copies already in someone&apos;s pack keep the old name and
                will no longer show up on this card.
              </p>
            ) : null}
          </div>
          <label className="flex items-start gap-2 rounded-lg border p-3 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={isUnique}
              onChange={(e) => setIsUnique(e.target.checked)}
            />
            <span>
              <span className="font-medium">Unique item</span>
              <span className="block text-muted-foreground">
                One of a kind. Giving it to someone moves it from whoever has
                it now.
              </span>
            </span>
          </label>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="item-description">Description</Label>
            <Textarea
              id="item-description"
              value={description}
              rows={3}
              placeholder="What it looks like, where it came from"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-damage">Damage</Label>
            <Input
              id="item-damage"
              value={damage}
              maxLength={ITEM_DAMAGE_MAX}
              placeholder="e.g. 1d8 slashing"
              onChange={(e) => setDamage(e.target.value)}
            />
          </div>
          <EffectList
            effects={effects}
            isDm
            idPrefix={item?.id ?? "new-item"}
            draft={draft}
            onDraftChange={setDraft}
            onAdd={() => {
              if (!draft.name.trim()) return;
              setEffects([
                ...effects,
                {
                  ...draft,
                  name: draft.name.trim(),
                  description: draft.description.trim(),
                  impact: draft.impact.trim(),
                  revealed: !draft.hidden,
                },
              ]);
              setDraft(emptyDraftEffect());
            }}
            onRemove={(index) =>
              setEffects(effects.filter((_, i) => i !== index))
            }
            onToggleHidden={(index, hidden) =>
              setEffects(
                effects.map((effect, i) =>
                  i === index ? { ...effect, hidden, revealed: !hidden } : effect,
                ),
              )
            }
          />
          <div className="flex flex-wrap items-center gap-2 border-t pt-4 sm:col-span-2">
            <Button type="submit" disabled={pending || !dirty}>
              {item ? "Save changes" : "Create item"}
            </Button>
            {item && dirty ? (
              <span className="text-sm text-muted-foreground">
                Unsaved changes
              </span>
            ) : null}
            {item ? (
              <Button
                type="button"
                variant="ghost"
                className="ml-auto text-destructive hover:text-destructive"
                disabled={pending}
                onClick={remove}
              >
                <Trash2 />
                Delete item
              </Button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HoldersSection({
  item,
  characters,
  holders,
}: {
  item: ItemRow;
  characters: CatalogCharacter[];
  holders: ItemHolder[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState("");
  const [quantity, setQuantity] = useState(1);
  const current = item.is_unique ? holders[0] : undefined;

  function give() {
    if (!target) {
      toast.error("Choose who gets it");
      return;
    }
    const targetName = characters.find((c) => c.id === target)?.name ?? "them";
    startTransition(async () => {
      const result = await assignItem({
        itemId: item.id,
        characterId: target,
        quantity: item.is_unique ? 1 : quantity,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        current
          ? `${item.name} moved from ${current.characterName} to ${targetName}`
          : `${item.name} given to ${targetName}`,
      );
      setTarget("");
      setQuantity(1);
      router.refresh();
    });
  }

  function takeBack(holder: ItemHolder) {
    if (
      !window.confirm(
        `Take ${item.name} away from ${holder.characterName}? Anything revealed on their copy is lost.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await adjustInventory({
        characterId: holder.characterId,
        itemName: item.name,
        delta: -holder.quantity,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Took ${item.name} from ${holder.characterName}`);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">Who has it</h3>
      {holders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {item.is_unique
            ? "Nobody yet. It's still waiting to be found."
            : "Nobody is carrying this yet."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {holders.map((holder) => (
            <li
              key={holder.characterId}
              className="flex items-center gap-2 px-3 py-2 text-sm"
            >
              <UserRound className="size-4 shrink-0 text-muted-foreground" />
              <Link
                href={`/characters/${holder.characterId}`}
                className="min-w-0 truncate font-medium hover:underline"
              >
                {holder.characterName}
              </Link>
              {holder.quantity > 1 ? (
                <span className="text-muted-foreground">×{holder.quantity}</span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                disabled={pending}
                onClick={() => takeBack(holder)}
              >
                Take back
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor="give-to">
            {current ? "Move it to" : "Give it to"}
          </Label>
          <select
            id="give-to"
            className={selectClass}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="" disabled>
              Choose a character
            </option>
            <CharacterOptions
              characters={characters}
              exclude={current ? [current.characterId] : []}
            />
          </select>
        </div>
        {item.is_unique ? null : (
          <div className="w-20 space-y-1">
            <Label htmlFor="give-quantity">How many</Label>
            <Input
              id="give-quantity"
              type="number"
              min={1}
              max={ASSIGN_QUANTITY_MAX}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>
        )}
        <Button type="button" disabled={pending || !target} onClick={give}>
          {current ? "Move" : "Give"}
        </Button>
      </div>
    </section>
  );
}

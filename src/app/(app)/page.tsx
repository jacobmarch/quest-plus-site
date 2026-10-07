import Link from "next/link";
import {
  Coins,
  Dices,
  Map as MapIcon,
  ScrollText,
  Sparkles,
  Swords,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import type { Json, RollRow } from "@/lib/database.types";
import { formatItemSummary } from "@/lib/items";
import { formatRollBreakdown } from "@/lib/rolls";
import { computeSkillPoints } from "@/lib/skills";
import {
  RECENT_ROLL_COUNT,
  formatRelativeTime,
  getHpStatus,
  getNaturalResult,
  hpPercent,
  latestRollByRoller,
  type HpStatus,
} from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { HpQuickAdjust } from "@/components/hp-quick-adjust";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Enough history to find each Player's latest Roll for their party card.
const ROLL_LOOKBACK = 100;
const ITEMS_SHOWN = 4;

type CharacterOverview = {
  id: string;
  name: string;
  kind: string;
  level: number;
  xp: number;
  current_hp: number;
  max_hp: number;
  is_dead: boolean;
  owner_id: string | null;
  class_id: string | null;
  notes: string;
  gold_pieces: number;
  silver_pieces: number;
  bronze_pieces: number;
};

type CarriedItem = {
  id: string;
  character_id: string;
  item_name: string;
  quantity: number;
  damage: string;
  effects: Json;
};

type DashboardRoll = Pick<
  RollRow,
  | "id"
  | "roller_id"
  | "roller_display_name"
  | "is_private"
  | "expression"
  | "faces"
  | "constant"
  | "total"
  | "created_at"
>;

type ClassSummary = { id: string; name: string; points_per_level: number };

type LearnedSkill = { cost: number; is_default: boolean };

type MemberDetails = {
  character: CharacterOverview;
  ownerName: string | null;
  className: string | null;
  availablePoints: number;
  items: CarriedItem[];
  lastRoll: DashboardRoll | null;
};

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [
    charactersRes,
    profilesRes,
    classesRes,
    learnedRes,
    inventoryRes,
    rollsRes,
  ] = await Promise.all([
    supabase
      .from("characters")
      .select(
        "id, name, kind, level, xp, current_hp, max_hp, is_dead, owner_id, class_id, notes, gold_pieces, silver_pieces, bronze_pieces",
      )
      .order("name"),
    supabase.from("profiles").select("id, display_name, role"),
    supabase.from("classes").select("id, name, points_per_level"),
    supabase
      .from("character_skills")
      .select("character_id, skills(cost, is_default)"),
    supabase.rpc("list_visible_inventory"),
    supabase
      .from("rolls")
      .select(
        "id, roller_id, roller_display_name, is_private, expression, faces, constant, total, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(ROLL_LOOKBACK),
  ]);

  const characters: CharacterOverview[] = charactersRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const rolls: DashboardRoll[] = rollsRes.data ?? [];

  const nameByProfile = new Map(
    profiles.map((p) => [p.id, p.display_name]),
  );
  const classById = new Map<string, ClassSummary>(
    (classesRes.data ?? []).map((c) => [c.id, c]),
  );

  const learnedByCharacter = new Map<string, LearnedSkill[]>();
  for (const row of learnedRes.data ?? []) {
    const skill = Array.isArray(row.skills) ? row.skills[0] : row.skills;
    if (!skill) continue;
    const list = learnedByCharacter.get(row.character_id) ?? [];
    list.push(skill);
    learnedByCharacter.set(row.character_id, list);
  }

  const itemsByCharacter = new Map<string, CarriedItem[]>();
  for (const row of inventoryRes.data ?? []) {
    const list = itemsByCharacter.get(row.character_id) ?? [];
    list.push(row);
    itemsByCharacter.set(row.character_id, list);
  }

  const lastRollByRoller = latestRollByRoller(rolls);

  function details(character: CharacterOverview): MemberDetails {
    const cls = character.class_id
      ? (classById.get(character.class_id) ?? null)
      : null;
    return {
      character,
      ownerName: character.owner_id
        ? (nameByProfile.get(character.owner_id) ?? "Unknown player")
        : null,
      className: cls?.name ?? null,
      availablePoints: computeSkillPoints(
        cls,
        character,
        learnedByCharacter.get(character.id) ?? [],
      ).available,
      items: (itemsByCharacter.get(character.id) ?? [])
        .slice()
        .sort((a, b) => a.item_name.localeCompare(b.item_name)),
      lastRoll: character.owner_id
        ? (lastRollByRoller.get(character.owner_id) ?? null)
        : null,
    };
  }

  const recentRolls = rolls.slice(0, RECENT_ROLL_COUNT);
  const pcs = characters.filter((c) => c.kind === "pc");

  if (session.isDm) {
    const enemies = characters.filter((c) => c.kind === "enemy");
    const playersWithoutPc = profiles
      .filter(
        (p) => p.role === "player" && !pcs.some((c) => c.owner_id === p.id),
      )
      .map((p) => p.display_name)
      .sort((a, b) => a.localeCompare(b));

    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <DashboardHeader
          displayName={session.profile.display_name}
          subtitle="Everything you need at the table"
        />
        <DmQuickLinks />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="space-y-3">
            <SectionHeading title="Party" href="/party" linkLabel="Party page" />
            {pcs.length === 0 ? (
              <EmptyCard>
                No player characters yet. Players create their own sheets.
              </EmptyCard>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {pcs.map((pc) => (
                  <PartyMemberCard key={pc.id} member={details(pc)} isDm />
                ))}
              </div>
            )}
            {playersWithoutPc.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                No character yet: {playersWithoutPc.join(", ")}
              </p>
            ) : null}
          </section>

          <aside className="space-y-6">
            <RecentRolls rolls={recentRolls} />
            <EnemyTracker enemies={enemies} />
          </aside>
        </div>
      </div>
    );
  }

  const myCharacters = pcs.filter((c) => c.owner_id === session.user.id);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeader
        displayName={session.profile.display_name}
        subtitle="Your characters at a glance"
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="space-y-3">
          <SectionHeading
            title="My characters"
            href="/characters"
            linkLabel="All characters"
          />
          {myCharacters.length === 0 ? (
            <EmptyCard>
              No characters yet.{" "}
              <Link href="/characters" className="underline underline-offset-4">
                Create one
              </Link>
              .
            </EmptyCard>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {myCharacters.map((pc) => (
                <PartyMemberCard
                  key={pc.id}
                  member={details(pc)}
                  isDm={false}
                />
              ))}
            </div>
          )}
        </section>
        <aside>
          <RecentRolls rolls={recentRolls} />
        </aside>
      </div>
    </div>
  );
}

function DashboardHeader({
  displayName,
  subtitle,
}: {
  displayName: string;
  subtitle: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        Welcome back, {displayName}
      </h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

const DM_QUICK_LINKS = [
  { href: "/bestiary", label: "Bestiary", icon: Swords },
  { href: "/maps", label: "Maps", icon: MapIcon },
  { href: "/items", label: "Items", icon: Coins },
  { href: "/rolls", label: "Roll log", icon: Dices },
  { href: "/sessions", label: "Session notes", icon: ScrollText },
] as const;

function DmQuickLinks() {
  return (
    <div className="flex flex-wrap gap-2">
      {DM_QUICK_LINKS.map(({ href, label, icon: Icon }) => (
        <Button key={href} asChild variant="outline" size="sm">
          <Link href={href}>
            <Icon />
            {label}
          </Link>
        </Button>
      ))}
    </div>
  );
}

function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <Link
        href={href}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {linkLabel}
      </Link>
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}

const STATUS_LABEL: Record<HpStatus, string | null> = {
  dead: "Dead",
  down: "Down",
  critical: "Critical",
  bloodied: "Bloodied",
  healthy: null,
};

function HpStatusBadge({ status }: { status: HpStatus }) {
  const label = STATUS_LABEL[status];
  if (!label) return null;
  return (
    <Badge variant={status === "bloodied" ? "secondary" : "destructive"}>
      {label}
    </Badge>
  );
}

function HpBar({
  character,
  status,
}: {
  character: { current_hp: number; max_hp: number };
  status: HpStatus;
}) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          status === "healthy"
            ? "bg-primary"
            : status === "bloodied"
              ? "bg-amber-500"
              : "bg-destructive",
        )}
        style={{ width: `${hpPercent(character)}%` }}
      />
    </div>
  );
}

function PartyMemberCard({
  member,
  isDm,
}: {
  member: MemberDetails;
  isDm: boolean;
}) {
  const { character, items } = member;
  const status = getHpStatus(character);
  const notes = character.notes.trim();
  const hiddenItemCount = Math.max(0, items.length - ITEMS_SHOWN);

  return (
    <Card size="sm" className={cn(status === "dead" && "opacity-70")}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <Link
            href={`/characters/${character.id}`}
            className="truncate underline-offset-4 hover:underline"
          >
            {character.name}
          </Link>
          <span className="flex shrink-0 items-center gap-1.5">
            <HpStatusBadge status={status} />
            <Badge variant="outline">Lv {character.level}</Badge>
          </span>
        </CardTitle>
        <CardDescription>
          {[
            member.className ?? "No class",
            isDm ? (member.ownerName ?? "Unowned") : null,
            `${character.xp} XP`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="font-medium">
              HP {character.current_hp}/{character.max_hp}
            </span>
            <span className="text-xs text-muted-foreground">
              {hpPercent(character)}%
            </span>
          </div>
          <HpBar character={character} status={status} />
          {status !== "dead" ? <HpQuickAdjust character={character} /> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <span title="Gold · Silver · Bronze">
            {character.gold_pieces}g · {character.silver_pieces}s ·{" "}
            {character.bronze_pieces}b
          </span>
          {member.availablePoints > 0 ? (
            <Link
              href={`/characters/${character.id}?tab=skills`}
              className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
            >
              <Sparkles className="size-3.5" />
              {member.availablePoints} skill{" "}
              {member.availablePoints === 1 ? "point" : "points"} to spend
            </Link>
          ) : null}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Carrying
          </p>
          {items.length === 0 ? (
            <p className="text-muted-foreground">Empty pockets</p>
          ) : (
            <ul className="space-y-0.5">
              {items.slice(0, ITEMS_SHOWN).map((item) => {
                const summary = formatItemSummary({
                  damage: item.damage,
                  effects: item.effects,
                  isDm,
                });
                return (
                  <li key={item.id} className="truncate" title={summary}>
                    {item.quantity}× {item.item_name}
                    {summary ? (
                      <span className="text-muted-foreground">
                        {" "}
                        — {summary}
                      </span>
                    ) : null}
                  </li>
                );
              })}
              {hiddenItemCount > 0 ? (
                <li>
                  <Link
                    href={`/characters/${character.id}?tab=inventory`}
                    className="text-muted-foreground underline-offset-4 hover:underline"
                  >
                    +{hiddenItemCount} more
                  </Link>
                </li>
              ) : null}
            </ul>
          )}
        </div>

        {isDm && member.lastRoll ? (
          <p className="text-muted-foreground">
            Last roll:{" "}
            <span className="font-mono text-foreground">
              {member.lastRoll.expression} → {member.lastRoll.total}
            </span>{" "}
            · {formatRelativeTime(member.lastRoll.created_at)}
          </p>
        ) : null}

        {notes ? (
          <p
            className="line-clamp-2 whitespace-pre-line text-muted-foreground"
            title={notes}
          >
            {notes}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RecentRolls({ rolls }: { rolls: DashboardRoll[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Recent rolls
          <Link
            href="/rolls"
            className="text-sm font-normal text-muted-foreground underline-offset-4 hover:underline"
          >
            Roll log
          </Link>
        </CardTitle>
        <CardDescription>Updates live as dice hit the table</CardDescription>
      </CardHeader>
      <CardContent>
        {rolls.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Rolls yet. Use the sidebar to roll.
          </p>
        ) : (
          <ul className="divide-y">
            {rolls.map((roll) => {
              const natural = getNaturalResult(roll);
              return (
                <li key={roll.id} className="space-y-0.5 py-2 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-medium">
                        {roll.roller_display_name}
                      </span>
                      {roll.is_private ? (
                        <Badge variant="secondary">Private</Badge>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(roll.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-sm text-muted-foreground">
                      {roll.expression}{" "}
                      <span className="text-xs">{formatRollBreakdown(roll)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {natural ? (
                        <Badge
                          variant={natural === "nat20" ? "default" : "destructive"}
                        >
                          {natural === "nat20" ? "Nat 20" : "Nat 1"}
                        </Badge>
                      ) : null}
                      <span className="text-lg font-bold tabular-nums">
                        {roll.total}
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EnemyTracker({ enemies }: { enemies: CharacterOverview[] }) {
  const active = enemies.filter((e) => !e.is_dead);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Enemies
          <Link
            href="/bestiary"
            className="text-sm font-normal text-muted-foreground underline-offset-4 hover:underline"
          >
            Bestiary
          </Link>
        </CardTitle>
        <CardDescription>Living foes, with quick HP tracking</CardDescription>
      </CardHeader>
      <CardContent>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No living enemies. Add some from the Bestiary.
          </p>
        ) : (
          <ul className="space-y-3">
            {active.map((enemy) => {
              const status = getHpStatus(enemy);
              return (
                <li key={enemy.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <Link
                      href={`/characters/${enemy.id}`}
                      className="truncate font-medium underline-offset-4 hover:underline"
                    >
                      {enemy.name}
                    </Link>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <HpStatusBadge status={status} />
                      <span className="tabular-nums text-muted-foreground">
                        {enemy.current_hp}/{enemy.max_hp}
                      </span>
                    </span>
                  </div>
                  <HpBar character={enemy} status={status} />
                  <HpQuickAdjust character={enemy} />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

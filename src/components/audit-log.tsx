"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AuditEventRow, CharacterRow, ProfileRow } from "@/lib/database.types";
import { formatAuditValue, getAuditChanges } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AuditLog({
  events,
  profiles,
  characters,
}: {
  events: AuditEventRow[];
  profiles: Array<Pick<ProfileRow, "id" | "display_name">>;
  characters: Array<Pick<CharacterRow, "id" | "name">>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const action = searchParams.get("action") ?? "all";
  const entity = searchParams.get("entity") ?? "all";
  const character = searchParams.get("character") ?? "all";
  const field = searchParams.get("field") ?? "all";
  const query = searchParams.get("q") ?? "";

  const rows = useMemo(
    () => {
      const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
      const characterById = new Map(
        characters.map((character) => [character.id, character]),
      );
      return events.map((event) => ({
        event,
        actor: event.actor_id
          ? profileById.get(event.actor_id)?.display_name ?? "Unknown user"
          : "System",
        target: event.target_character_id
          ? characterById.get(event.target_character_id)
          : null,
        changes: getAuditChanges(event.before_data, event.after_data),
      }));
    },
    [events, profiles, characters],
  );
  const fields = [...new Set(rows.flatMap((row) => row.changes.map((change) => change.field)))].sort();
  const entities = [...new Set(events.map((event) => event.entity_type))].sort();
  const filteredRows = rows.filter(({ event, actor, target, changes }) => {
    const searchText = `${event.description} ${actor} ${target?.name ?? ""}`.toLowerCase();
    return (
      (action === "all" || event.action === action) &&
      (entity === "all" || event.entity_type === entity) &&
      (character === "all" || event.target_character_id === character) &&
      (field === "all" || changes.some((change) => change.field === field)) &&
      (!query || searchText.includes(query.toLowerCase()))
    );
  });

  function setFilter(name: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "all" || !value) next.delete(name);
    else next.set(name, value);
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`);
  }

  if (events.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No game events recorded yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 border-y py-3">
        <FilterSelect label="Action" value={action} onChange={(value) => setFilter("action", value)}>
          <SelectItem value="all">All actions</SelectItem>
          <SelectItem value="insert">Insert</SelectItem>
          <SelectItem value="update">Update</SelectItem>
          <SelectItem value="delete">Delete</SelectItem>
        </FilterSelect>
        <FilterSelect label="Entity" value={entity} onChange={(value) => setFilter("entity", value)}>
          <SelectItem value="all">All entities</SelectItem>
          {entities.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
        </FilterSelect>
        <FilterSelect label="Character" value={character} onChange={(value) => setFilter("character", value)}>
          <SelectItem value="all">All characters</SelectItem>
          {characters.toSorted((a, b) => a.name.localeCompare(b.name)).map((value) => (
            <SelectItem key={value.id} value={value.id}>{value.name}</SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect label="Changed field" value={field} onChange={(value) => setFilter("field", value)}>
          <SelectItem value="all">Any changed field</SelectItem>
          {fields.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
        </FilterSelect>
        <label className="min-w-52 flex-1 text-xs font-medium">
          Search
          <Input
            value={query}
            placeholder="Description, actor, character..."
            onChange={(event) => setFilter("q", event.target.value)}
            className="mt-1"
          />
        </label>
        {searchParams.size > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => router.replace(pathname)}>
            Clear
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filteredRows.length} of {events.length} events
      </p>

      {filteredRows.length === 0 ? (
        <p className="border-y py-10 text-center text-sm text-muted-foreground">
          No matching events.
        </p>
      ) : (
        <div className="overflow-x-auto border-y">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Entity</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Character</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Changed fields</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ event, actor, target, changes }) => {
                const expanded = expandedId === event.id;
                return (
                  <Fragment key={event.id}>
                    <tr
                      className="cursor-pointer border-b align-top hover:bg-muted/30"
                      onClick={() => setExpandedId(expanded ? null : event.id)}
                      onKeyDown={(keyboardEvent) => {
                        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                          keyboardEvent.preventDefault();
                          setExpandedId(expanded ? null : event.id);
                        }
                      }}
                      tabIndex={0}
                      aria-expanded={expanded}
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                        <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
                      </td>
                      <td className="px-3 py-2 font-medium">{event.action}</td>
                      <td className="px-3 py-2 font-mono text-xs">{event.entity_type}</td>
                      <td className="px-3 py-2">{actor}</td>
                      <td className="px-3 py-2">
                        {target ? <Link href={`/characters/${target.id}`} className="underline underline-offset-4" onClick={(clickEvent) => clickEvent.stopPropagation()}>{target.name}</Link> : "—"}
                      </td>
                      <td className="max-w-sm px-3 py-2">{event.description}</td>
                      <td className="px-3 py-2 font-mono text-xs">{changes.length ? changes.map((change) => change.field).join(", ") : "—"}</td>
                    </tr>
                    {expanded ? (
                      <tr className="border-b bg-muted/20">
                        <td colSpan={7} className="px-3 py-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {changes.length ? changes.map((change) => (
                              <div key={change.field} className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-2 font-mono text-xs">
                                <span className="font-semibold">{change.field}</span>
                                <span><span className="text-muted-foreground">{formatAuditValue(change.before)}</span>{" → "}{formatAuditValue(change.after)}</span>
                              </div>
                            )) : <span className="text-xs text-muted-foreground">No comparable fields.</span>}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="text-xs font-medium">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 min-w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </label>
  );
}

import { describe, expect, it } from "vitest";
import {
  filterCatalog,
  holdersByItemName,
  planAssignment,
  type CatalogFilter,
} from "@/lib/items";

const gorvak = "c-gorvak";
const lira = "c-lira";
const names = new Map([
  [gorvak, "Gorvak"],
  [lira, "Lira"],
]);

const items = [
  {
    name: "Gorvak's Axe",
    description: "Notched and smelling of smoke",
    effects: [{ name: "Ember Bite", hidden: true }],
    is_unique: true,
  },
  { name: "Healing Potion", description: "", effects: [], is_unique: false },
  { name: "Moonlit Circlet", description: "Cold to the touch", effects: [], is_unique: true },
];

const holders = holdersByItemName(
  [
    { character_id: lira, item_name: "healing potion", quantity: 3 },
    { character_id: gorvak, item_name: "Healing Potion", quantity: 1 },
    { character_id: gorvak, item_name: "GORVAK'S AXE", quantity: 1 },
  ],
  names,
);

const all: CatalogFilter = { query: "", kind: "all", holder: "any" };
const namesOf = (filter: Partial<CatalogFilter>) =>
  filterCatalog(items, holders, { ...all, ...filter }).map((i) => i.name);

describe("holdersByItemName", () => {
  it("matches inventory copies by name regardless of case, sorted by holder", () => {
    expect(holders.get("healing potion")).toEqual([
      { characterId: gorvak, characterName: "Gorvak", quantity: 1 },
      { characterId: lira, characterName: "Lira", quantity: 3 },
    ]);
  });
});

describe("filterCatalog", () => {
  it("filters by unique vs common", () => {
    expect(namesOf({ kind: "unique" })).toEqual(["Gorvak's Axe", "Moonlit Circlet"]);
    expect(namesOf({ kind: "common" })).toEqual(["Healing Potion"]);
  });

  it("filters by who holds the item, or nobody", () => {
    expect(namesOf({ holder: gorvak })).toEqual(["Gorvak's Axe", "Healing Potion"]);
    expect(namesOf({ holder: "unclaimed" })).toEqual(["Moonlit Circlet"]);
  });

  it("searches names, descriptions, effects and holders", () => {
    expect(namesOf({ query: "smoke" })).toEqual(["Gorvak's Axe"]);
    expect(namesOf({ query: "ember" })).toEqual(["Gorvak's Axe"]);
    expect(namesOf({ query: "lira" })).toEqual(["Healing Potion"]);
    expect(namesOf({ query: "cold circlet" })).toEqual(["Moonlit Circlet"]);
  });
});

describe("planAssignment", () => {
  const axeHolders = holders.get("gorvak's axe")!;

  it("grants a single copy of an unclaimed unique item", () => {
    expect(
      planAssignment({ isUnique: true, holders: [], targetCharacterId: lira, quantity: 5 }),
    ).toEqual({ kind: "grant", quantity: 1 });
  });

  it("moves a unique item from its current holder", () => {
    expect(
      planAssignment({ isUnique: true, holders: axeHolders, targetCharacterId: lira, quantity: 1 }),
    ).toEqual({ kind: "transfer", fromCharacterId: gorvak, quantity: 1 });
  });

  it("refuses to give a unique item to the character who has it", () => {
    expect(() =>
      planAssignment({ isUnique: true, holders: axeHolders, targetCharacterId: gorvak, quantity: 1 }),
    ).toThrow("Gorvak already has it");
  });

  it("grants common items in the requested quantity", () => {
    expect(
      planAssignment({
        isUnique: false,
        holders: holders.get("healing potion")!,
        targetCharacterId: lira,
        quantity: 2,
      }),
    ).toEqual({ kind: "grant", quantity: 2 });
    expect(() =>
      planAssignment({ isUnique: false, holders: [], targetCharacterId: lira, quantity: 0 }),
    ).toThrow("Quantity");
  });
});

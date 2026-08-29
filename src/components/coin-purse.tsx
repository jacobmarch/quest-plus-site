"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const COIN_FIELDS = [
  { key: "gold_pieces", label: "Gold", unit: "gp" },
  { key: "silver_pieces", label: "Silver", unit: "sp" },
  { key: "bronze_pieces", label: "Bronze", unit: "bp" },
] as const;

export type CoinField = (typeof COIN_FIELDS)[number]["key"];

export function CoinPurse({
  gold,
  silver,
  bronze,
  pending,
  idPrefix,
  onChange,
  className,
}: {
  gold: number;
  silver: number;
  bronze: number;
  pending: boolean;
  idPrefix: string;
  onChange: (field: CoinField, value: number) => void;
  className?: string;
}) {
  const values: Record<CoinField, number> = {
    gold_pieces: gold,
    silver_pieces: silver,
    bronze_pieces: bronze,
  };

  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)}>
      {COIN_FIELDS.map((coin) => {
        const id = `${idPrefix}-${coin.key}`;
        const value = values[coin.key];
        return (
          <div key={coin.key} className="space-y-1">
            <Label htmlFor={id}>
              {coin.label}{" "}
              <span className="font-normal text-muted-foreground">
                ({coin.unit})
              </span>
            </Label>
            <Input
              id={id}
              type="number"
              min={0}
              step={1}
              disabled={pending}
              defaultValue={value}
              key={`${id}-${value}`}
              className="w-24 tabular-nums"
              onBlur={(event) => {
                const next = Number(event.target.value);
                if (Number.isNaN(next) || next < 0) {
                  event.target.value = String(value);
                  return;
                }
                const rounded = Math.floor(next);
                if (rounded !== value) onChange(coin.key, rounded);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

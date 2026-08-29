-- Dedicated coin purse on the character sheet so currency is not buried
-- in freeform inventory rows.

alter table public.characters
  add column gold_pieces integer not null default 0 check (gold_pieces >= 0),
  add column silver_pieces integer not null default 0 check (silver_pieces >= 0),
  add column bronze_pieces integer not null default 0 check (bronze_pieces >= 0);

grant update (gold_pieces, silver_pieces, bronze_pieces)
  on public.characters to authenticated;

-- One-of-a-kind catalog items (Gorvak's Axe rather than "broadsword"). The app
-- keeps a unique item with one character at a time: giving it to someone else
-- moves the existing copy instead of granting another.
alter table public.items
  add column is_unique boolean not null default false;

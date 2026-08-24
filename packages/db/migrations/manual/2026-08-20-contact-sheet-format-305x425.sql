-- Apply manually (drizzle-kit is not run by agents in this repo).
-- Adds the 305 x 425 mm contact sheet format (printed landscape, 5020 x 3602 px at 300 DPI).
alter table marathons
  drop constraint marathons_contact_sheet_format_check;

alter table marathons
  add constraint marathons_contact_sheet_format_check
  check (contact_sheet_format in ('classic', 'a3', '305x425'));

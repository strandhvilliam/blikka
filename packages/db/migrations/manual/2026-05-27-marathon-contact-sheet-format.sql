-- Apply manually (drizzle-kit is not run by agents in this repo).
alter table marathons
  add column contact_sheet_format text not null default 'classic';

alter table marathons
  add constraint marathons_contact_sheet_format_check
  check (contact_sheet_format in ('classic', 'a3'));

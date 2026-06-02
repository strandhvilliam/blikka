alter table "marathons"
  add column if not exists "verification_mode" text not null default 'all';

alter table "marathons"
  drop constraint if exists "marathons_verification_mode_check";

alter table "marathons"
  add constraint "marathons_verification_mode_check"
  check ("verification_mode" in ('all', 'flagged', 'none'));

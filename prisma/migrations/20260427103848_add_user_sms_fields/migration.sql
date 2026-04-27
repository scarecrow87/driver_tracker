alter table "public"."User" add column "driverSmsSendOnCheckIn" boolean not null default false;
alter table "public"."User" add column "driverSmsSendOnCheckOut" boolean not null default false;
alter table "public"."User" add column "driverSmsOptOut" boolean not null default false;
alter table "public"."User" add column "adminSmsOptOutTier1" boolean not null default false;
alter table "public"."User" add column "adminSmsOptOutTier2" boolean not null default false;
alter table "public"."User" add column "adminSmsOptOutTier3" boolean not null default false;

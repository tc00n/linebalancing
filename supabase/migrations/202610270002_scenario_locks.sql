-- E27 (Entscheidung 27.10.2026), F51/F58/F64: Exklusive Bearbeitungssperre je Szenario.
-- Gesperrt wird beim Oeffnen; die Sperre gilt 2 Minuten und wird vom Browser alle 30 s erneuert.
-- Nach Absturz oder Verbindungsverlust laeuft sie serverseitig ab. Jeder mit Projektzugang kann
-- eine fremde Sperre nach Rueckfrage uebernehmen. Gespeichert wird nur mit gueltiger eigener Sperre.
-- Die Kennung (holder_token) gilt je Browser-Tab, damit zwei Tabs derselben Person sich nicht ueberschreiben.
create table public.scenario_locks (
 scenario_id uuid primary key,
 project_id uuid not null,
 holder_id uuid not null references auth.users on delete cascade,
 holder_token uuid not null,
 acquired_at timestamptz not null default now(),
 expires_at timestamptz not null,
 foreign key(scenario_id,project_id) references public.scenarios(id,project_id) on delete cascade
);
alter table public.scenario_locks enable row level security;
revoke all on public.scenario_locks from anon,authenticated;

-- Erwerben, erneuern (gleiche Kennung) und nach Rueckfrage uebernehmen (p_takeover).
create function public.acquire_scenario_lock(p_project_id uuid,p_scenario_id uuid,p_token uuid,p_takeover boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid; l public.scenario_locks;
begin
 me:=app_private.verified_user();
 if not public.can_access_project(p_project_id) then raise exception 'Kein Projektzugriff' using errcode='42501'; end if;
 if p_token is null then raise exception 'Sperrkennung fehlt'; end if;
 if not exists(select 1 from public.scenarios where id=p_scenario_id and project_id=p_project_id) then raise exception 'Szenario nicht mehr vorhanden' using errcode='40001'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_scenario_id::text,3));
 select * into l from public.scenario_locks where scenario_id=p_scenario_id for update;
 if found and l.holder_token<>p_token and l.expires_at>now() and not coalesce(p_takeover,false) then
 return jsonb_build_object('held',false,'holder',(select u.email from auth.users u where u.id=l.holder_id),'sameUser',l.holder_id=me);
 end if;
 insert into public.scenario_locks(scenario_id,project_id,holder_id,holder_token,acquired_at,expires_at)
 values(p_scenario_id,p_project_id,me,p_token,now(),now()+interval '2 minutes')
 on conflict(scenario_id) do update set holder_id=excluded.holder_id,holder_token=excluded.holder_token,
 acquired_at=case when public.scenario_locks.holder_token=excluded.holder_token then public.scenario_locks.acquired_at else now() end,
 expires_at=excluded.expires_at;
 return jsonb_build_object('held',true);
end $$;

create function public.release_scenario_lock(p_project_id uuid,p_scenario_id uuid,p_token uuid) returns void language plpgsql security definer set search_path='' as $$
declare me uuid;
begin
 me:=app_private.verified_user();
 if not public.can_access_project(p_project_id) then raise exception 'Kein Projektzugriff' using errcode='42501'; end if;
 delete from public.scenario_locks where scenario_id=p_scenario_id and project_id=p_project_id and holder_id=me and holder_token=p_token;
end $$;

-- Haelt die Sperrzeile bis zum Ende der Speichertransaktion, damit eine Uebernahme erst danach greift.
create function app_private.require_scenario_lock(p_project_id uuid,p_scenario_id uuid,p_token uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.scenarios where id=p_scenario_id and project_id=p_project_id) then raise exception 'Szenario nicht mehr vorhanden' using errcode='40001'; end if;
 perform 1 from public.scenario_locks where scenario_id=p_scenario_id and project_id=p_project_id
 and holder_id=auth.uid() and holder_token=p_token and expires_at>now() for update;
 if not found then raise exception 'Das Szenario ist nicht fuer dich zur Bearbeitung gesperrt' using errcode='55P03'; end if;
end $$;

-- Speichern nur mit gueltiger eigener Sperre; die bisherige Signatur ohne Kennung entfaellt.
drop function public.save_scenario(uuid,jsonb,bigint);
create function public.save_scenario(p_project_id uuid,p_document jsonb,p_expected_version bigint,p_lock_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_expected_version is null then raise exception 'Versionsnummer fehlt'; end if;
 perform app_private.verified_user();
 if not public.can_access_project(p_project_id) then raise exception 'Kein Projektzugriff' using errcode='42501'; end if;
 perform app_private.require_scenario_lock(p_project_id,(p_document->>'id')::uuid,p_lock_token);
 return app_private.write_scenario(p_project_id,p_document,p_expected_version);
end $$;

-- E26: Ein gerade bearbeitetes Szenario wird nicht geloescht. Rumpf sonst wie 202610270001_delete_scenario.sql.
create or replace function public.delete_scenario(p_project_id uuid,p_scenario_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare old public.scenarios; holder text;
begin
 perform app_private.verified_user();
 if not public.can_access_project(p_project_id) then raise exception 'Kein Projektzugriff' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_scenario_id::text,1));
 select * into old from public.scenarios where id=p_scenario_id for update;
 if not found then raise exception 'Szenario nicht mehr vorhanden' using errcode='40001'; end if;
 if old.project_id<>p_project_id then raise exception 'Szenario gehoert zu anderem Projekt' using errcode='42501'; end if;
 select u.email into holder from public.scenario_locks l join auth.users u on u.id=l.holder_id
 where l.scenario_id=p_scenario_id and l.expires_at>now();
 if found then raise exception 'Das Szenario wird gerade von % bearbeitet', holder using errcode='55P03'; end if;
 perform pg_advisory_xact_lock(hashtextextended(old.variant_id::text,2));
 delete from public.scenarios where id=p_scenario_id;
 delete from public.variants v where v.id=old.variant_id and not exists(select 1 from public.scenarios s where s.variant_id=v.id);
end $$;

revoke all on function app_private.require_scenario_lock(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.acquire_scenario_lock(uuid,uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.release_scenario_lock(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.save_scenario(uuid,jsonb,bigint,uuid) from public,anon,authenticated;
revoke all on function public.delete_scenario(uuid,uuid) from public,anon,authenticated;
grant execute on function public.acquire_scenario_lock(uuid,uuid,uuid,boolean) to authenticated;
grant execute on function public.release_scenario_lock(uuid,uuid,uuid) to authenticated;
grant execute on function public.save_scenario(uuid,jsonb,bigint,uuid) to authenticated;
grant execute on function public.delete_scenario(uuid,uuid) to authenticated;

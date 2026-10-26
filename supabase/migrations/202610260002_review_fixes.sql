-- Korrekturen aus dem Review vom 26.10.2026.
-- 1. Ohne Code nur als Owner (01_ANFORDERUNGEN): Staff-Mitglieder fremder Projekte brauchen den Code je Sitzung wie alle Editoren.
create or replace function public.can_access_project(p_project_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(
 select 1 from public.project_members m join auth.users u on u.id=m.user_id
 where m.project_id=p_project_id and m.user_id=auth.uid() and u.email_confirmed_at is not null
 and (m.role='owner' or exists(select 1 from public.member_sessions s
 where s.project_id=m.project_id and s.user_id=m.user_id and s.auth_session_id::text=auth.jwt()->>'session_id' and s.verified_email=u.email))
 );
$$;

-- 2. Kreispruefung ueber Erreichbarkeit statt ueber alle Pfade: hoechstens n^2 Paare statt exponentiell vieler Pfade.
create or replace function app_private.write_scenario(p_project_id uuid,p_document jsonb,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid; vid uuid; old public.scenarios; d jsonb; x jsonb; pred text; cycle_found boolean;
begin
 perform app_private.verified_user();
 if not public.can_access_project(p_project_id) then raise exception 'Kein Projektzugriff' using errcode='42501'; end if;
 sid:=(p_document->>'id')::uuid; vid:=(p_document->>'variantId')::uuid; d:=p_document->'input';
 if sid is null or vid is null or d is null then raise exception 'Unvollstaendige Szenariodaten'; end if;
 perform pg_advisory_xact_lock(hashtextextended(sid::text,1));
 select * into old from public.scenarios where id=sid for update;
 if found then
 if old.project_id<>p_project_id or old.variant_id<>vid then raise exception 'Szenario gehoert zu anderem Projekt oder Variante' using errcode='42501'; end if;
 if p_expected_version is null or old.version<>p_expected_version then raise exception 'Szenario wurde zwischenzeitlich geaendert. Bitte neu laden.' using errcode='40001'; end if;
 -- F17, F29: Kein Hinzufuegen/Loeschen/Umbenennen von Schritten oder Stationen.
 if exists(select 1 from (select id,description,time_min from public.steps where scenario_id=sid) a full join
 (select z->>'id' id,z->>'description' description,(z->>'timeMin')::numeric time_min from jsonb_array_elements(d->'steps') z) b using(id)
 where a.id is null or b.id is null or (a.description,a.time_min) is distinct from (b.description,b.time_min)) then raise exception 'Importierte Arbeitsgaenge und Zeiten sind unveraenderlich' using errcode='23514'; end if;
 if exists(select 1 from (select id,label from public.stations where scenario_id=sid) a full join
 (select z->>'id' id,z->>'label' label from jsonb_array_elements(d->'stations') z) b using(id)
 where a.id is null or b.id is null or a.label is distinct from b.label) then raise exception 'Stationen sind unveraenderlich' using errcode='23514'; end if;
 else
 if p_expected_version is not null then raise exception 'Szenario nicht mehr vorhanden' using errcode='40001'; end if;
 -- Serialisiert weitere Importe in dieselbe Variante, auch wenn noch nicht angelegt.
 perform pg_advisory_xact_lock(hashtextextended(vid::text,2));
 if exists(select 1 from public.variants where id=vid and project_id<>p_project_id) then raise exception 'Variante gehoert zu anderem Projekt' using errcode='42501'; end if;
 if exists(select 1 from public.scenarios where variant_id=vid) and exists(
 select 1 from (select st.id from public.steps st where st.scenario_id=(select id from public.scenarios where variant_id=vid limit 1)) a full join
 (select z->>'id' id from jsonb_array_elements(d->'steps') z) b using(id) where a.id is null or b.id is null) then raise exception 'Arbeitsgang-IDs stimmen nicht mit der Variante ueberein'; end if;
 insert into public.variants(id,project_id,name) values(vid,p_project_id,p_document->>'variantName') on conflict(id) do nothing;
 insert into public.scenarios(id,project_id,variant_id,name,source_filename,copied_from,takt_min,allowance_pct,updated_by)
 values(sid,p_project_id,vid,p_document->>'name',coalesce(p_document->>'sourceFilename',''),p_document->>'copiedFrom',(d->>'taktMin')::numeric,(d->>'allowancePct')::numeric,auth.uid());
 for x in select * from jsonb_array_elements(d->'stations') loop
 insert into public.stations values(sid,p_project_id,x->>'id',x->>'label'); end loop;
 end if;
 if jsonb_typeof(d->'steps') is distinct from 'array' or jsonb_array_length(d->'steps')=0
 or jsonb_typeof(d->'employees') is distinct from 'array' or jsonb_typeof(d->'stations') is distinct from 'array'
 or jsonb_typeof(p_document->'categories') is distinct from 'array' then raise exception 'Ungueltiges Szenarioformat'; end if;
 if exists(select 1 from jsonb_array_elements(d->'steps') z group by z->>'id' having count(*)>1) then raise exception 'Doppelte Arbeitsgang-IDs'; end if;
 -- Kategorien/Mitarbeiter ersetzen: verzogerte FKs werden am Ende explizit geprueft.
 delete from public.categories where scenario_id=sid;
 for x in select * from jsonb_array_elements(p_document->'categories') loop
 insert into public.categories values(sid,p_project_id,x->>'id',x->>'label',x->>'color'); end loop;
 delete from public.employees where scenario_id=sid;
 for x in select * from jsonb_array_elements(d->'employees') loop
 insert into public.employees values(sid,p_project_id,x->>'id',x->>'stationId',x->>'label'); end loop;
 for x in select * from jsonb_array_elements(d->'steps') loop
 if nullif(trim(x->>'id'),'') is null then raise exception 'Arbeitsgang-ID fehlt'; end if;
 insert into public.steps(scenario_id,project_id,id,description,time_min,sequence,station_id,employee_id,category_id)
 values(sid,p_project_id,x->>'id',x->>'description',(x->>'timeMin')::numeric,(x->>'sequence')::integer,x->>'stationId',x->>'employeeId',x->>'categoryId')
 on conflict(scenario_id,id) do update set sequence=excluded.sequence,station_id=excluded.station_id,employee_id=excluded.employee_id,category_id=excluded.category_id;
 end loop;
 delete from public.step_predecessors where scenario_id=sid;
 for x in select * from jsonb_array_elements(d->'steps') loop
 if jsonb_typeof(x->'predecessorIds') is distinct from 'array' then raise exception 'Vorgaengerliste fehlt'; end if;
 for pred in select jsonb_array_elements_text(x->'predecessorIds') loop
 insert into public.step_predecessors values(sid,p_project_id,x->>'id',pred); end loop; end loop;
 with recursive reach(start_id,id) as (
 select step_id,predecessor_id from public.step_predecessors where scenario_id=sid
 union select r.start_id,p.predecessor_id from reach r join public.step_predecessors p on p.scenario_id=sid and p.step_id=r.id)
 select exists(select 1 from reach where start_id=id) into cycle_found;
 if cycle_found then raise exception 'Vorgaengerkreis ist nicht erlaubt' using errcode='23514'; end if;
 set constraints all immediate;
 set constraints all deferred;
 if old.id is not null then
 update public.scenarios set name=p_document->>'name',takt_min=(d->>'taktMin')::numeric,allowance_pct=(d->>'allowancePct')::numeric,version=version+1,updated_at=clock_timestamp(),updated_by=auth.uid() where id=sid;
 end if;
 return app_private.scenario_document(sid);
end $$;
revoke all on function app_private.write_scenario(uuid,jsonb,bigint) from public,anon,authenticated;

-- Gemeinsame Arbeitsgaenge mehrerer Mitarbeiter (E42, docs/RECHENREGELN.md 6c).
-- Die Gruppe ist in der App aenderbar und gehoert nicht zur unveraenderlichen Importzeit (F17).
-- Bestehende Schritte erhalten keine Gruppe; ihre Berechnung bleibt unveraendert.
alter table public.steps add column group_id text check(group_id is null or (group_id=btrim(group_id) and group_id<>''));
-- Gemeinsame Arbeitsgaenge sind Handzeiten.
alter table public.steps add constraint steps_group_only_manual check(group_id is null or time_kind='manual');

-- Rumpf unveraendert aus 202610280001_process_time.sql, nur Gruppe ergaenzt.
create or replace function app_private.scenario_document(p_scenario_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'id',s.id,'variantId',s.variant_id,'variantName',v.name,'name',s.name,'sourceFilename',s.source_filename,
 'importedAt',s.imported_at,'updatedAt',s.updated_at,'updatedBy',s.updated_by,'updatedByLabel',(select u.email from auth.users u where u.id=s.updated_by),'version',s.version,'copiedFrom',s.copied_from,
 'categories',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'label',c.label,'color',c.color) order by c.id),'[]'::jsonb) from public.categories c where c.scenario_id=s.id),
 'input',jsonb_build_object('taktMin',s.takt_min,'allowancePct',s.allowance_pct,
 'stations',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'label',x.label) order by x.id),'[]'::jsonb) from public.stations x where x.scenario_id=s.id),
 'employees',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',x.id,'label',x.label,'stationId',x.station_id,'personId',x.person_id)) order by x.id),'[]'::jsonb) from public.employees x where x.scenario_id=s.id),
 'steps',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'description',x.description,'timeMin',x.time_min,'sequence',x.sequence,'stationId',x.station_id,'employeeId',x.employee_id,'categoryId',x.category_id,
 'predecessorIds',(select coalesce(jsonb_agg(p.predecessor_id order by p.predecessor_id),'[]'::jsonb) from public.step_predecessors p where p.scenario_id=s.id and p.step_id=x.id))
 -- E44: Zeitart nur bei Prozesszeiten; Handzeiten bleiben wie vor E44.
 ||case when x.time_kind='process' then jsonb_build_object('timeKind','process','holdsStation',x.holds_station) else '{}'::jsonb end
 -- E42: Gruppe nur bei gemeinsamen Arbeitsgaengen.
 ||case when x.group_id is not null then jsonb_build_object('groupId',x.group_id) else '{}'::jsonb end order by x.id),'[]'::jsonb) from public.steps x where x.scenario_id=s.id)))
 from public.scenarios s join public.variants v on v.id=s.variant_id where s.id=p_scenario_id;
$$;

-- Rumpf unveraendert aus 202610280001_process_time.sql, nur Gruppe und ihre Pruefungen ergaenzt.
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
 insert into public.employees(scenario_id,project_id,id,station_id,label,person_id) values(sid,p_project_id,x->>'id',x->>'stationId',x->>'label',nullif(x->>'personId','')); end loop;
 if exists(select 1 from public.employees where scenario_id=sid and person_id is not null group by person_id having count(distinct label)>1) then raise exception 'Spuren derselben Person brauchen dieselbe Bezeichnung' using errcode='23514'; end if;
 for x in select * from jsonb_array_elements(d->'steps') loop
 if nullif(trim(x->>'id'),'') is null then raise exception 'Arbeitsgang-ID fehlt'; end if;
 insert into public.steps(scenario_id,project_id,id,description,time_min,sequence,station_id,employee_id,category_id,time_kind,holds_station,group_id)
 values(sid,p_project_id,x->>'id',x->>'description',(x->>'timeMin')::numeric,(x->>'sequence')::numeric,x->>'stationId',x->>'employeeId',x->>'categoryId',
 coalesce(x->>'timeKind','manual'),coalesce((x->>'holdsStation')::boolean,false),x->>'groupId')
 on conflict(scenario_id,id) do update set sequence=excluded.sequence,station_id=excluded.station_id,employee_id=excluded.employee_id,category_id=excluded.category_id,
 time_kind=excluded.time_kind,holds_station=excluded.holds_station,group_id=excluded.group_id;
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
 -- E42 (RECHENREGELN 6c): Zeilen einer Gruppe an einer Station, je Person hoechstens einmal, ohne Vorgaenger untereinander.
 if exists(select 1 from public.steps where scenario_id=sid and group_id is not null group by group_id having count(distinct station_id)>1)
 then raise exception 'Gemeinsamer Arbeitsgang liegt an mehreren Stationen' using errcode='23514'; end if;
 if exists(select 1 from public.steps x join public.employees e on e.scenario_id=x.scenario_id and e.id=x.employee_id
 where x.scenario_id=sid and x.group_id is not null group by x.group_id,coalesce(e.person_id,e.id) having count(*)>1)
 then raise exception 'Mitarbeiter ist im gemeinsamen Arbeitsgang mehrfach eingetragen' using errcode='23514'; end if;
 -- Vorgaenger innerhalb der Gruppe oder ueber Umwege: Kreis im Graphen mit einem Knoten je Gruppe.
 with recursive node as (
 select id,coalesce('g:'||group_id,'s:'||id) n from public.steps where scenario_id=sid),
 edge as (select distinct a.n child,b.n parent from public.step_predecessors p join node a on a.id=p.step_id join node b on b.id=p.predecessor_id where p.scenario_id=sid),
 reach(start_n,n) as (select child,parent from edge union select r.start_n,e.parent from reach r join edge e on e.child=r.n)
 select exists(select 1 from reach where start_n=n) into cycle_found;
 if cycle_found then raise exception 'Vorgaenger widersprechen dem gemeinsamen Start einer Gruppe' using errcode='23514'; end if;
 set constraints all immediate;
 set constraints all deferred;
 if old.id is not null then
 update public.scenarios set name=p_document->>'name',takt_min=(d->>'taktMin')::numeric,allowance_pct=(d->>'allowancePct')::numeric,version=version+1,updated_at=clock_timestamp(),updated_by=auth.uid() where id=sid;
 end if;
 return app_private.scenario_document(sid);
end $$;

revoke all on function app_private.write_scenario(uuid,jsonb,bigint) from public,anon,authenticated;
revoke all on function app_private.scenario_document(uuid) from public,anon,authenticated;

-- Phase 2: Auth, Projekte, Mandantentrennung und unveraenderliche Importdaten.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table public.staff_domains (domain text primary key check (domain = lower(domain)));
insert into public.staff_domains values ('neonex.de'); -- vom Nutzer am 26.10.2026 freigegeben
create table public.projects (
 id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 1 and 200),
 owner_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.project_members (
 project_id uuid not null references public.projects on delete cascade, user_id uuid not null references auth.users on delete cascade,
 role text not null check(role in ('owner','editor')), joined_via text not null check(joined_via in ('owner','code')),
 primary key(project_id,user_id), check((role='owner')=(joined_via='owner'))
);
create unique index one_owner_per_project on public.project_members(project_id) where role='owner';
create table public.member_sessions (
 project_id uuid not null, user_id uuid not null, auth_session_id uuid not null,
 verified_at timestamptz not null default now(), verified_email text not null,
 primary key(project_id,user_id,auth_session_id),
 foreign key(project_id,user_id) references public.project_members on delete cascade
);
create table app_private.code_key (id boolean primary key default true check(id), secret text not null);
insert into app_private.code_key(secret) values(encode(extensions.gen_random_bytes(32),'hex'));
create table public.project_codes (
 project_id uuid primary key references public.projects on delete cascade,
 code_hash text not null unique, code_cipher bytea not null, created_at timestamptz not null default now()
);
create table public.code_attempts (id bigint generated always as identity primary key, user_id uuid not null references auth.users on delete cascade, at timestamptz not null default now(), success boolean not null);
create index code_attempts_user_at on public.code_attempts(user_id,at);
create table public.variants (
 id uuid primary key, project_id uuid not null references public.projects on delete cascade,
 name text not null check(length(trim(name)) between 1 and 200), unique(id,project_id)
);
create table public.scenarios (
 id uuid primary key, project_id uuid not null, variant_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 200), source_filename text not null,
 imported_at timestamptz not null default now(), copied_from text,
 takt_min numeric not null check(takt_min>0 and takt_min<'Infinity'::numeric),
 allowance_pct numeric not null check(allowance_pct>=0 and allowance_pct<'Infinity'::numeric),
 version bigint not null default 1, updated_at timestamptz not null default now(), updated_by uuid not null references auth.users,
 foreign key(variant_id,project_id) references public.variants(id,project_id) on delete cascade,
 unique(id,project_id), unique(variant_id,name)
);
create table public.stations (
 scenario_id uuid not null, project_id uuid not null, id text not null, label text not null check(length(trim(label))>0),
 primary key(scenario_id,id), unique(scenario_id,label),
 foreign key(scenario_id,project_id) references public.scenarios(id,project_id) on delete cascade
);
create table public.employees (
 scenario_id uuid not null, project_id uuid not null, id text not null, station_id text not null, label text not null check(length(trim(label))>0),
 primary key(scenario_id,id), unique(scenario_id,station_id,id), unique(scenario_id,station_id,label),
 foreign key(scenario_id,project_id) references public.scenarios(id,project_id) on delete cascade,
 foreign key(scenario_id,station_id) references public.stations(scenario_id,id)
);
create table public.categories (
 scenario_id uuid not null, project_id uuid not null, id text not null, label text not null check(length(trim(label))>0), color text not null check(color ~ '^#[0-9a-fA-F]{6}$'),
 primary key(scenario_id,id), foreign key(scenario_id,project_id) references public.scenarios(id,project_id) on delete cascade
);
create table public.steps (
 scenario_id uuid not null, project_id uuid not null, id text not null, description text not null,
 time_min numeric not null check(time_min>0 and time_min<'Infinity'::numeric and time_min=round(time_min,2)),
 sequence integer not null check(sequence>=0), station_id text not null, employee_id text, category_id text not null,
 primary key(scenario_id,id),
 foreign key(scenario_id,project_id) references public.scenarios(id,project_id) on delete cascade,
 foreign key(scenario_id,station_id) references public.stations(scenario_id,id),
 foreign key(scenario_id,station_id,employee_id) references public.employees(scenario_id,station_id,id) deferrable initially deferred,
 foreign key(scenario_id,category_id) references public.categories(scenario_id,id) deferrable initially deferred
);
create table public.step_predecessors (
 scenario_id uuid not null, project_id uuid not null, step_id text not null, predecessor_id text not null,
 primary key(scenario_id,step_id,predecessor_id), check(step_id<>predecessor_id),
 foreign key(scenario_id,project_id) references public.scenarios(id,project_id) on delete cascade,
 foreign key(scenario_id,step_id) references public.steps(scenario_id,id) on delete cascade,
 foreign key(scenario_id,predecessor_id) references public.steps(scenario_id,id) on delete cascade
);

create function app_private.verified_user() returns uuid language plpgsql stable security definer set search_path='' as $$
declare u uuid;
begin
 select id into u from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if u is null or nullif(auth.jwt()->>'session_id','') is null then raise exception 'Anmeldung erforderlich' using errcode='42501'; end if;
 return u;
end $$;
create function public.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.staff_domains d on d.domain=lower(split_part(u.email,'@',2)) where u.id=auth.uid() and u.email_confirmed_at is not null);
$$;
create function public.can_access_project(p_project_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(
 select 1 from public.project_members m join auth.users u on u.id=m.user_id
 where m.project_id=p_project_id and m.user_id=auth.uid() and u.email_confirmed_at is not null
 and (m.role='owner' or public.is_staff() or exists(select 1 from public.member_sessions s
 where s.project_id=m.project_id and s.user_id=m.user_id and s.auth_session_id::text=auth.jwt()->>'session_id' and s.verified_email=u.email))
 );
$$;
create function app_private.require_owner(p_project_id uuid) returns void language plpgsql stable security definer set search_path='' as $$
begin
 perform app_private.verified_user();
 if not exists(select 1 from public.projects where id=p_project_id and owner_id=auth.uid()) then raise exception 'Nur der Owner darf diese Aktion ausfuehren' using errcode='42501'; end if;
end $$;
create function app_private.protect_step() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.time_min,new.id,new.scenario_id,new.project_id,new.description) is distinct from (old.time_min,old.id,old.scenario_id,old.project_id,old.description) then
 raise exception 'Importierte Arbeitsgang-ID, Beschreibung und Zeit sind unveraenderlich' using errcode='23514'; end if;
 return new;
end $$;
create trigger immutable_step before update on public.steps for each row execute function app_private.protect_step();

-- Genau ein Owner: Mitgliedschaft wird ausschliesslich durch gepruefte Funktionen erzeugt.
create function app_private.new_code(p_project_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare c text; key text;
begin
 select secret into key from app_private.code_key where id;
 loop
 c:=upper(encode(extensions.gen_random_bytes(5),'hex')); c:=substr(c,1,5)||'-'||substr(c,6,5);
 exit when not exists(select 1 from public.project_codes where code_hash=encode(extensions.digest(c,'sha256'),'hex'));
 end loop;
 insert into public.project_codes(project_id,code_hash,code_cipher) values(p_project_id,encode(extensions.digest(c,'sha256'),'hex'),extensions.pgp_sym_encrypt(c,key))
 on conflict(project_id) do update set code_hash=excluded.code_hash,code_cipher=excluded.code_cipher,created_at=now();
 return c;
end $$;
create function public.create_project(p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare p uuid; u uuid;
begin
 u:=app_private.verified_user();
 if not public.is_staff() then raise exception 'Nur freigegebene Firmenadressen duerfen Projekte anlegen' using errcode='42501'; end if;
 insert into public.projects(name,owner_id) values(trim(p_name),u) returning id into p;
 insert into public.project_members values(p,u,'owner','owner');
 perform app_private.new_code(p); return p;
end $$;
create function public.redeem_project_code(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; p uuid; email text; sid uuid; c text;
begin
 u:=app_private.verified_user(); sid:=(auth.jwt()->>'session_id')::uuid;
 -- Serialisiert parallele Versuche desselben Nutzers; Fehlversuche muessen committen.
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if (select count(*) from public.code_attempts where user_id=u and not success and at>now()-interval '15 minutes')>=5 then
 return jsonb_build_object('ok',false,'message','Zu viele Fehlversuche. Bitte nach 15 Minuten erneut versuchen.'); end if;
 c:=upper(trim(p_code));
 select project_id into p from public.project_codes where code_hash=encode(extensions.digest(c,'sha256'),'hex') for share;
 insert into public.code_attempts(user_id,success) values(u,p is not null);
 if p is null then return jsonb_build_object('ok',false,'message','Projektcode ungueltig.'); end if;
 select u2.email into email from auth.users u2 where id=u;
 insert into public.project_members values(p,u,'editor','code') on conflict do nothing;
 insert into public.member_sessions(project_id,user_id,auth_session_id,verified_email) values(p,u,sid,email)
 on conflict(project_id,user_id,auth_session_id) do update set verified_at=now(),verified_email=excluded.verified_email;
 return jsonb_build_object('ok',true,'projectId',p);
end $$;
create function public.get_project_code(p_project_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare c text;
begin
 perform app_private.require_owner(p_project_id);
 select extensions.pgp_sym_decrypt(pc.code_cipher,k.secret) into c from public.project_codes pc cross join app_private.code_key k where pc.project_id=p_project_id and k.id;
 return c;
end $$;
create function public.rotate_project_code(p_project_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare c text;
begin
 perform app_private.require_owner(p_project_id);
 perform 1 from public.project_codes where project_id=p_project_id for update;
 c:=app_private.new_code(p_project_id);
 delete from public.project_members where project_id=p_project_id and joined_via='code';
 return c;
end $$;
create function public.list_project_members(p_project_id uuid) returns table(user_id uuid,email text,role text) language plpgsql stable security definer set search_path='' as $$
begin
 perform app_private.require_owner(p_project_id);
 return query select m.user_id,u.email::text,m.role from public.project_members m join auth.users u on u.id=m.user_id where m.project_id=p_project_id order by m.role,u.email;
end $$;
create function public.remove_project_member(p_project_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.require_owner(p_project_id);
 delete from public.project_members where project_id=p_project_id and user_id=p_user_id and role='editor';
end $$;
create function public.leave_project(p_project_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.verified_user();
 if exists(select 1 from public.projects where id=p_project_id and owner_id=auth.uid()) then raise exception 'Owner koennen ihr Projekt nicht verlassen'; end if;
 delete from public.project_members where project_id=p_project_id and user_id=auth.uid();
end $$;
create function public.delete_project(p_project_id uuid,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.require_owner(p_project_id);
 if not exists(select 1 from public.projects where id=p_project_id and name=p_confirmation) then raise exception 'Projektname stimmt nicht ueberein'; end if;
 delete from public.projects where id=p_project_id;
end $$;
create function public.end_project_session() returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.verified_user();
 delete from public.member_sessions where user_id=auth.uid() and auth_session_id::text=auth.jwt()->>'session_id';
end $$;

-- Alle Tabellen fail-closed; Schreibzugriff ausschliesslich ueber die Funktionen.
do $$ declare t text; begin
 foreach t in array array['staff_domains','projects','project_members','member_sessions','project_codes','code_attempts','variants','scenarios','stations','employees','categories','steps','step_predecessors'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
end $$;
alter table app_private.code_key enable row level security;
create policy projects_read on public.projects for select to authenticated using(public.can_access_project(id));
grant select on public.projects to authenticated;
create policy members_read on public.project_members for select to authenticated using(public.can_access_project(project_id));
grant select on public.project_members to authenticated;
do $$ declare t text; begin
 foreach t in array array['variants','scenarios','stations','employees','categories','steps','step_predecessors'] loop
 execute format('create policy project_read on public.%I for select to authenticated using(public.can_access_project(project_id))',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;

create function app_private.scenario_document(p_scenario_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'id',s.id,'variantId',s.variant_id,'variantName',v.name,'name',s.name,'sourceFilename',s.source_filename,
 'importedAt',s.imported_at,'updatedAt',s.updated_at,'updatedBy',s.updated_by,'updatedByLabel',(select u.email from auth.users u where u.id=s.updated_by),'version',s.version,'copiedFrom',s.copied_from,
 'categories',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'label',c.label,'color',c.color) order by c.id),'[]'::jsonb) from public.categories c where c.scenario_id=s.id),
 'input',jsonb_build_object('taktMin',s.takt_min,'allowancePct',s.allowance_pct,
 'stations',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'label',x.label) order by x.id),'[]'::jsonb) from public.stations x where x.scenario_id=s.id),
 'employees',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'label',x.label,'stationId',x.station_id) order by x.id),'[]'::jsonb) from public.employees x where x.scenario_id=s.id),
 'steps',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'description',x.description,'timeMin',x.time_min,'sequence',x.sequence,'stationId',x.station_id,'employeeId',x.employee_id,'categoryId',x.category_id,
 'predecessorIds',(select coalesce(jsonb_agg(p.predecessor_id order by p.predecessor_id),'[]'::jsonb) from public.step_predecessors p where p.scenario_id=s.id and p.step_id=x.id)) order by x.id),'[]'::jsonb) from public.steps x where x.scenario_id=s.id)))
 from public.scenarios s join public.variants v on v.id=s.variant_id where s.id=p_scenario_id;
$$;
create function public.list_scenario_documents(p_project_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_access_project(p_project_id) then raise exception 'Kein Projektzugriff' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(app_private.scenario_document(s.id) order by s.imported_at desc),'[]'::jsonb) from public.scenarios s where s.project_id=p_project_id);
end $$;

create function app_private.write_scenario(p_project_id uuid,p_document jsonb,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
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
 with recursive walk(id,path,cycle) as (
 select id,array[id],false from public.steps where scenario_id=sid
 union all select p.predecessor_id,w.path||p.predecessor_id,p.predecessor_id=any(w.path) from walk w join public.step_predecessors p on p.scenario_id=sid and p.step_id=w.id where not w.cycle)
 select exists(select 1 from walk where cycle) into cycle_found;
 if cycle_found then raise exception 'Vorgaengerkreis ist nicht erlaubt' using errcode='23514'; end if;
 set constraints all immediate;
 set constraints all deferred;
 if old.id is not null then
 update public.scenarios set name=p_document->>'name',takt_min=(d->>'taktMin')::numeric,allowance_pct=(d->>'allowancePct')::numeric,version=version+1,updated_at=clock_timestamp(),updated_by=auth.uid() where id=sid;
 end if;
 return app_private.scenario_document(sid);
end $$;
create function public.import_scenario(p_project_id uuid,p_document jsonb) returns jsonb language sql security definer set search_path='' as $$
 select app_private.write_scenario(p_project_id,p_document,null);
$$;
create function public.save_scenario(p_project_id uuid,p_document jsonb,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_expected_version is null then raise exception 'Versionsnummer fehlt'; end if;
 return app_private.write_scenario(p_project_id,p_document,p_expected_version);
end $$;

-- Standard-EXECUTE auf PUBLIC explizit entziehen; private Helfer bleiben privat.
revoke all on all functions in schema app_private from public,anon,authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('is_staff','can_access_project','create_project','redeem_project_code','get_project_code','rotate_project_code','list_project_members','remove_project_member','leave_project','delete_project','end_project_session','list_scenario_documents','import_scenario','save_scenario') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;

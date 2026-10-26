-- F133: Personalplanung als projektbezogene, unveraenderliche Referenzstaende.
create table public.staffing_plans (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 document jsonb not null,
 imported_at timestamptz not null default now(),
 uploaded_by uuid references auth.users(id),
 unique(project_id,source_sha256)
);
alter table public.staffing_plans enable row level security;
revoke all on public.staffing_plans from anon,authenticated;
grant select on public.staffing_plans to authenticated;
create policy staffing_read on public.staffing_plans for select to authenticated using(public.can_access_project(project_id));

create function app_private.validate_staffing_document(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare r jsonb; k text;
begin
 if jsonb_typeof(d) is distinct from 'object' or d->>'taktMin' is distinct from '70'
 or jsonb_typeof(d->'filename') is distinct from 'string' or length(trim(d->>'filename')) not between 1 and 500
 or jsonb_typeof(d->'rows') is distinct from 'array' or jsonb_array_length(d->'rows') not between 1 and 2000
 or jsonb_typeof(d->'actuals') is distinct from 'array' or jsonb_array_length(d->'actuals')>1000
 or jsonb_typeof(d->'warnings') is distinct from 'array' or jsonb_array_length(d->'warnings')>500 then return false; end if;
 if d->'grossFactor' is distinct from 'null'::jsonb and
 (jsonb_typeof(d->'grossFactor') is distinct from 'number' or (d->>'grossFactor')::numeric<0) then return false; end if;
 for r in select * from jsonb_array_elements(d->'rows') loop
 if jsonb_typeof(r->'sourceRow') is distinct from 'number' or (r->>'sourceRow')::numeric<1 or (r->>'sourceRow')::numeric<>trunc((r->>'sourceRow')::numeric)
 or jsonb_typeof(r->'area') is distinct from 'string' or length(r->>'area')>500
 or jsonb_typeof(r->'support') is distinct from 'boolean'
 or jsonb_typeof(r->'productive') is distinct from 'number' or (r->>'productive')::numeric<0 then return false; end if;
 foreach k in array array['station','costCenter','teamSpeaker'] loop
 if r->k is distinct from 'null'::jsonb and (jsonb_typeof(r->k) is distinct from 'string' or length(r->>k)>500) then return false; end if;
 end loop;
 if r->'gross' is distinct from 'null'::jsonb and (jsonb_typeof(r->'gross') is distinct from 'number' or (r->>'gross')::numeric<0) then return false; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(d->'rows') x group by x->>'sourceRow' having count(*)>1) then return false; end if;
 for r in select * from jsonb_array_elements(d->'actuals') loop
 if jsonb_typeof(r->'costCenter') is distinct from 'string' or length(trim(r->>'costCenter')) not between 1 and 500 then return false; end if;
 foreach k in array array['actual','sourceGross'] loop
 if r->k is distinct from 'null'::jsonb and (jsonb_typeof(r->k) is distinct from 'number' or (r->>k)::numeric<0) then return false; end if;
 end loop;
 end loop;
 if exists(select 1 from jsonb_array_elements(d->'actuals') x group by x->>'costCenter' having count(*)>1) then return false; end if;
 for r in select * from jsonb_array_elements(d->'warnings') loop
 if jsonb_typeof(r) is distinct from 'string' or length(r#>>'{}')>500 then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
alter table public.staffing_plans add constraint staffing_document_valid check(app_private.validate_staffing_document(document));
revoke all on function app_private.validate_staffing_document(jsonb) from public,anon,authenticated;

create function public.import_staffing_plan(p_project_id uuid,p_document jsonb,p_sha256 text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform app_private.verified_user();
 if not public.can_access_project(p_project_id) then raise exception 'Kein Projektzugriff' using errcode='42501'; end if;
 if not app_private.validate_staffing_document(p_document) then raise exception 'Ungueltige Personalplanung' using errcode='23514'; end if;
 insert into public.staffing_plans(project_id,source_sha256,document,uploaded_by)
 values(p_project_id,p_sha256,p_document,auth.uid()) on conflict(project_id,source_sha256) do nothing returning id into result;
 if result is null then select id into result from public.staffing_plans where project_id=p_project_id and source_sha256=p_sha256; end if;
 return result;
end $$;
revoke all on function public.import_staffing_plan(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.import_staffing_plan(uuid,jsonb,text) to authenticated;

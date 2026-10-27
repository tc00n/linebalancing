-- E26 (Entscheidung 27.10.2026): Owner und Editoren duerfen einzelne Szenarien endgueltig loeschen.
-- Eine Variante verschwindet mit ihrem letzten Szenario. Stationen, Mitarbeiter, Kategorien, Arbeitsgaenge
-- und Vorgaenger haengen per "on delete cascade" am Szenario. Schutz vor dem Loeschen eines gerade
-- bearbeiteten Szenarios folgt mit der Szenariosperre (E27).
create function public.delete_scenario(p_project_id uuid,p_scenario_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare old public.scenarios;
begin
 perform app_private.verified_user();
 if not public.can_access_project(p_project_id) then raise exception 'Kein Projektzugriff' using errcode='42501'; end if;
 -- Dieselben Sperren wie app_private.write_scenario: kein gleichzeitiges Speichern oder Importieren in die Variante.
 perform pg_advisory_xact_lock(hashtextextended(p_scenario_id::text,1));
 select * into old from public.scenarios where id=p_scenario_id for update;
 if not found then raise exception 'Szenario nicht mehr vorhanden' using errcode='40001'; end if;
 if old.project_id<>p_project_id then raise exception 'Szenario gehoert zu anderem Projekt' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(old.variant_id::text,2));
 delete from public.scenarios where id=p_scenario_id;
 delete from public.variants v where v.id=old.variant_id and not exists(select 1 from public.scenarios s where s.variant_id=v.id);
end $$;
revoke all on function public.delete_scenario(uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_scenario(uuid,uuid) to authenticated;

-- 0021: Let partial / placeholder reports finalize
--
-- Finalizing a report auto-writes an anonymized row into valuation_records
-- (the platform's market-comparables pool). That table has NOT NULL columns
-- (district_id, unit_net_area, value_per_sqm, chosen_method, appraisal_date),
-- so finalizing a report that's missing any of them — e.g. reports created via
-- the "New Report" modal, which don't capture a district — failed the insert
-- and rolled the whole finalize back with a generic 500.
--
-- Fix: only contribute the comp record when the data it needs is actually
-- present. Incomplete reports still finalize; they just don't feed the comps
-- pool (which is correct — you don't want partial data polluting valuations).

create or replace function on_report_finalized() returns trigger as $$
begin
  if new.status = 'finalized' and (old.status is distinct from 'finalized') then
    -- A finalized valuation still needs its final values.
    if new.final_value is null or new.land_value is null or new.building_value is null then
      raise exception 'Cannot finalize report without final values';
    end if;

    -- Write the anonymized market record only when every column it requires is
    -- available. The WHERE clause gates the whole insert: if any condition
    -- fails the SELECT yields no rows and nothing is inserted, so the finalize
    -- succeeds without a comp record.
    insert into valuation_records (
      district_id, compound_id, property_type, unit_net_area, unit_land_share,
      final_value, value_per_sqm, current_age, finishing_level,
      chosen_method, appraisal_date, source
    )
    select
      p.district_id, p.compound_id, p.property_type, new.unit_net_area, new.unit_land_share,
      new.final_value, new.final_value / nullif(new.unit_net_area, 0), new.current_age,
      new.finishing_level, new.chosen_method, new.appraisal_date, new.source
    from properties p
    where p.id = new.property_id
      and p.district_id is not null
      and new.unit_net_area is not null and new.unit_net_area > 0
      and new.chosen_method is not null
      and new.appraisal_date is not null;

    new.finalized_at = now();
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Fix is_provisional to handle heuristic-parsed Excel files
-- Heuristic extraction is non-deterministic (label proximity matching)
-- and should be treated as provisional like PDF-sourced data.

create or replace function on_report_finalized() returns trigger as $$
declare
  v_is_provisional boolean := false;
  v_import_job record;
begin
  if new.status = 'finalized' and (old.status is distinct from 'finalized') then
    -- Require all final values to be set
    if new.final_value is null or new.land_value is null or new.building_value is null then
      raise exception 'Cannot finalize report without final values';
    end if;

    -- Determine if this is a provisional import
    -- Provisional sources:
    --   1. PDF-sourced (OCR is non-deterministic)
    --   2. Heuristic-parsed Excel (label proximity is non-deterministic)
    -- Only template-fingerprinted Excel is considered ground truth
    if new.import_job_id is not null then
      select * into v_import_job from import_jobs where id = new.import_job_id;
      if v_import_job.source_type = 'pdf' then
        v_is_provisional := true;
      elsif v_import_job.template_fingerprint = 'heuristic' then
        -- Heuristic extraction is also provisional
        v_is_provisional := true;
      end if;
    end if;

    -- Write anonymized record to valuation_records
    insert into valuation_records (
      district_id, compound_id, property_type, unit_net_area, unit_land_share,
      final_value, value_per_sqm, current_age, finishing_level,
      chosen_method, appraisal_date, source, is_provisional
    )
    select
      p.district_id, p.compound_id, p.property_type, new.unit_net_area, new.unit_land_share,
      new.final_value, new.final_value / nullif(new.unit_net_area, 0), new.current_age,
      new.finishing_level, new.chosen_method, new.appraisal_date, new.source, v_is_provisional
    from properties p
    where p.id = new.property_id;

    new.finalized_at = now();
  end if;
  return new;
end;
$$ language plpgsql security definer;

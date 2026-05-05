alter table public.etf_geo_breakdown
  drop constraint if exists etf_geo_breakdown_source_check;

alter table public.etf_geo_breakdown
  add constraint etf_geo_breakdown_source_check
  check (source in ('justetf', 'yahoo', 'manual'));

update public.etf_geo_breakdown
set source = 'yahoo'
where source = 'justetf';
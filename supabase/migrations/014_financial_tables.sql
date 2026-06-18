create table if not exists financial_ingresos (
  id uuid default gen_random_uuid() primary key,
  concepto text not null,
  fecha date,
  monto_ars numeric(14,2),
  monto_usd numeric(10,2),
  metodo text,
  notas text,
  created_at timestamptz default now()
);

create table if not exists financial_egresos (
  id uuid default gen_random_uuid() primary key,
  concepto text not null,
  fecha date,
  monto_ars numeric(14,2),
  metodo text,
  notas text,
  created_at timestamptz default now()
);

create table if not exists financial_inversiones_socio (
  id uuid default gen_random_uuid() primary key,
  concepto text not null,
  socio text,
  fecha date,
  monto_ars numeric(14,2),
  monto_usd numeric(10,2),
  created_at timestamptz default now()
);

alter table financial_ingresos enable row level security;
alter table financial_egresos enable row level security;
alter table financial_inversiones_socio enable row level security;

create policy "financial_owner_only" on financial_ingresos
  for all using (auth.jwt() ->> 'email' = 'control@manso.internal');

create policy "financial_owner_only" on financial_egresos
  for all using (auth.jwt() ->> 'email' = 'control@manso.internal');

create policy "financial_owner_only" on financial_inversiones_socio
  for all using (auth.jwt() ->> 'email' = 'control@manso.internal');

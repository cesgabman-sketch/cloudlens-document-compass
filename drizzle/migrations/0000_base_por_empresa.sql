create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  created_at timestamptz not null default now()
);

create table public.usuarios_empresa (
  user_id uuid primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fecha text not null,
  concepto text not null,
  monto numeric not null,
  categoria text not null,
  origen text not null default 'manual',
  created_at timestamptz not null default now()
);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo text not null,
  proveedor text not null,
  cuit_proveedor text,
  cliente text,
  cuit_cliente text,
  numero text,
  fecha text,
  items jsonb not null default '[]'::jsonb,
  campos_dudosos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index gastos_empresa_fecha on public.gastos (empresa_id, fecha);
create index documentos_empresa_fecha on public.documentos (empresa_id, fecha);

grant select, insert, update, delete on public.empresas to authenticated;
grant select, insert, delete on public.usuarios_empresa to authenticated;
grant select, insert, update, delete on public.gastos to authenticated;
grant select, insert, update, delete on public.documentos to authenticated;
grant all on public.empresas, public.usuarios_empresa, public.gastos, public.documentos to service_role;

create or replace function public.mi_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from public.usuarios_empresa where user_id = auth.uid();
$$;

create or replace function public.crear_empresa(_nombre text)
returns public.empresas
language plpgsql
security definer
set search_path = public
as $$
declare
  nueva public.empresas;
begin
  if exists (select 1 from public.usuarios_empresa where user_id = auth.uid()) then
    raise exception 'El usuario ya pertenece a una empresa';
  end if;
  insert into public.empresas (nombre, codigo)
  values (_nombre, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)))
  returning * into nueva;
  insert into public.usuarios_empresa (user_id, empresa_id) values (auth.uid(), nueva.id);
  return nueva;
end;
$$;

create or replace function public.unirse_empresa(_codigo text)
returns public.empresas
language plpgsql
security definer
set search_path = public
as $$
declare
  empresa public.empresas;
begin
  if exists (select 1 from public.usuarios_empresa where user_id = auth.uid()) then
    raise exception 'El usuario ya pertenece a una empresa';
  end if;
  select * into empresa from public.empresas where codigo = upper(btrim(_codigo));
  if not found then
    raise exception 'Codigo de empresa invalido';
  end if;
  insert into public.usuarios_empresa (user_id, empresa_id) values (auth.uid(), empresa.id);
  return empresa;
end;
$$;

revoke execute on function public.mi_empresa_id(), public.crear_empresa(text), public.unirse_empresa(text) from public, anon;
grant execute on function public.mi_empresa_id(), public.crear_empresa(text), public.unirse_empresa(text) to authenticated;

alter table public.empresas enable row level security;
alter table public.usuarios_empresa enable row level security;
alter table public.gastos enable row level security;
alter table public.documentos enable row level security;

create policy "Miembros ven su empresa"
  on public.empresas for select to authenticated
  using (id = public.mi_empresa_id());

create policy "Miembros editan su empresa"
  on public.empresas for update to authenticated
  using (id = public.mi_empresa_id())
  with check (id = public.mi_empresa_id());

create policy "Usuario ve su vinculo"
  on public.usuarios_empresa for select to authenticated
  using (user_id = auth.uid());

create policy "Gastos de mi empresa"
  on public.gastos for all to authenticated
  using (empresa_id = public.mi_empresa_id())
  with check (empresa_id = public.mi_empresa_id());

create policy "Documentos de mi empresa"
  on public.documentos for all to authenticated
  using (empresa_id = public.mi_empresa_id())
  with check (empresa_id = public.mi_empresa_id());

create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Usuario ve sus roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.licencias (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  cliente text not null,
  max_terminales integer not null default 1,
  vencimiento date,
  estado text not null default 'activa',
  created_at timestamptz not null default now()
);
grant all on public.licencias to service_role;
alter table public.licencias enable row level security;

create table public.terminales (
  id uuid primary key default gen_random_uuid(),
  licencia_id uuid not null references public.licencias(id) on delete cascade,
  machine_id text not null,
  nombre_pc text not null default '',
  activada_at timestamptz not null default now(),
  ultima_conexion timestamptz not null default now(),
  unique (licencia_id, machine_id)
);
grant all on public.terminales to service_role;
alter table public.terminales enable row level security;

-- Activación pública (la PC del cliente llama antes de iniciar sesión)
create or replace function public.activar_licencia(_clave text, _machine_id text, _nombre_pc text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  lic public.licencias%rowtype;
  usadas integer;
begin
  select * into lic from public.licencias where clave = upper(trim(_clave));
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'La clave no existe. Revisala o pedila de nuevo.');
  end if;
  if lic.estado <> 'activa' then
    return jsonb_build_object('ok', false, 'motivo', 'Esta licencia está ' || lic.estado || '. Comunicate con el proveedor.');
  end if;
  if lic.vencimiento is not null and lic.vencimiento < current_date then
    return jsonb_build_object('ok', false, 'motivo', 'La licencia venció el ' || to_char(lic.vencimiento, 'DD/MM/YYYY') || '.');
  end if;
  if exists (select 1 from public.terminales where licencia_id = lic.id and machine_id = _machine_id) then
    update public.terminales set ultima_conexion = now(), nombre_pc = coalesce(nullif(_nombre_pc, ''), nombre_pc)
      where licencia_id = lic.id and machine_id = _machine_id;
    return jsonb_build_object('ok', true, 'cliente', lic.cliente, 'vencimiento', lic.vencimiento, 'ya_registrada', true);
  end if;
  select count(*) into usadas from public.terminales where licencia_id = lic.id;
  if usadas >= lic.max_terminales then
    return jsonb_build_object('ok', false, 'motivo', 'Se superó el límite de equipos autorizados (' || lic.max_terminales || '). Pedí liberar una PC o ampliar el cupo.');
  end if;
  insert into public.terminales (licencia_id, machine_id, nombre_pc) values (lic.id, _machine_id, coalesce(nullif(_nombre_pc, ''), 'PC'));
  return jsonb_build_object('ok', true, 'cliente', lic.cliente, 'vencimiento', lic.vencimiento, 'ya_registrada', false);
end;
$$;

-- Revalidación periódica
create or replace function public.estado_licencia(_clave text, _machine_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  lic public.licencias%rowtype;
begin
  select * into lic from public.licencias where clave = upper(trim(_clave));
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'La clave no existe.');
  end if;
  if not exists (select 1 from public.terminales where licencia_id = lic.id and machine_id = _machine_id) then
    return jsonb_build_object('ok', false, 'motivo', 'Esta PC no está registrada con esa clave.');
  end if;
  update public.terminales set ultima_conexion = now() where licencia_id = lic.id and machine_id = _machine_id;
  if lic.estado <> 'activa' then
    return jsonb_build_object('ok', false, 'motivo', 'Esta licencia está ' || lic.estado || '. Comunicate con el proveedor.');
  end if;
  if lic.vencimiento is not null and lic.vencimiento < current_date then
    return jsonb_build_object('ok', false, 'motivo', 'La licencia venció el ' || to_char(lic.vencimiento, 'DD/MM/YYYY') || '.');
  end if;
  return jsonb_build_object('ok', true, 'cliente', lic.cliente, 'vencimiento', lic.vencimiento);
end;
$$;

grant execute on function public.activar_licencia(text, text, text) to anon, authenticated;
grant execute on function public.estado_licencia(text, text) to anon, authenticated;

-- Funciones de administración (solo rol admin)
create or replace function public.crear_licencia(_cliente text, _max_terminales integer default 1, _vencimiento date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  clave text;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Forbidden'; end if;
  clave := 'LIC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 5, 4));
  insert into public.licencias (clave, cliente, max_terminales, vencimiento) values (clave, _cliente, greatest(_max_terminales, 1), _vencimiento);
  return jsonb_build_object('ok', true, 'clave', clave);
end;
$$;

create or replace function public.listar_licencias()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Forbidden'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', l.id, 'clave', l.clave, 'cliente', l.cliente, 'max_terminales', l.max_terminales,
    'vencimiento', l.vencimiento, 'estado', l.estado, 'created_at', l.created_at,
    'terminales', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'machine_id', t.machine_id, 'nombre_pc', t.nombre_pc, 'activada_at', t.activada_at, 'ultima_conexion', t.ultima_conexion) order by t.activada_at) from public.terminales t where t.licencia_id = l.id), '[]'::jsonb)
  ) order by l.created_at desc) from public.licencias l), '[]'::jsonb);
end;
$$;

create or replace function public.cambiar_estado_licencia(_licencia_id uuid, _estado text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Forbidden'; end if;
  if _estado not in ('activa', 'suspendida', 'cancelada') then raise exception 'Estado inválido'; end if;
  update public.licencias set estado = _estado where id = _licencia_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.liberar_terminal(_terminal_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Forbidden'; end if;
  delete from public.terminales where id = _terminal_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.crear_licencia(text, integer, date) to authenticated;
grant execute on function public.listar_licencias() to authenticated;
grant execute on function public.cambiar_estado_licencia(uuid, text) to authenticated;
grant execute on function public.liberar_terminal(uuid) to authenticated;

-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'operacional');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users_view_own_roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins_manage_roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles (apenas email + auditoria)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Trigger: ao criar usuário, criar profile + role default operacional
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
  -- Primeiro usuário vira admin, demais operacional
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operacional');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Competencias
CREATE TABLE public.competencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano int NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  arquivo_nome text,
  registros_count int NOT NULL DEFAULT 0,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(mes, ano)
);
ALTER TABLE public.competencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_select_auth" ON public.competencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "comp_admin_all" ON public.competencias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Registros
CREATE TABLE public.registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia_id uuid NOT NULL REFERENCES public.competencias(id) ON DELETE CASCADE,
  lote text,
  data_gerado date,
  data_abertura date,
  codigo text,
  prestador text NOT NULL,
  cnpj text,
  nome_titular text,
  banco text,
  conta_financeiro text,
  valor_procedimentos numeric(14,2) DEFAULT 0,
  valor_glosa numeric(14,2) DEFAULT 0,
  valor_lote numeric(14,2) DEFAULT 0,
  valor_acerto numeric(14,2) DEFAULT 0,
  valor_bruto numeric(14,2) DEFAULT 0,
  pis numeric(14,2) DEFAULT 0,
  cofins numeric(14,2) DEFAULT 0,
  csll numeric(14,2) DEFAULT 0,
  inss numeric(14,2) DEFAULT 0,
  iss numeric(14,2) DEFAULT 0,
  ir numeric(14,2) DEFAULT 0,
  valor_liquido numeric(14,2) DEFAULT 0,
  valor_pago numeric(14,2) DEFAULT 0,
  qtde_procedimentos int DEFAULT 0,
  empresarial numeric(14,2) DEFAULT 0,
  individual numeric(14,2) DEFAULT 0,
  coletivo numeric(14,2) DEFAULT 0,
  ortodontia numeric(14,2) DEFAULT 0,
  municipio text,
  uf text,
  bairro text,
  email text,
  telefone text,
  data_pagamento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_registros_competencia ON public.registros(competencia_id);
CREATE INDEX idx_registros_prestador ON public.registros(prestador);
CREATE INDEX idx_registros_cnpj ON public.registros(cnpj);

ALTER TABLE public.registros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reg_select_auth" ON public.registros FOR SELECT TO authenticated USING (true);
CREATE POLICY "reg_admin_all" ON public.registros FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Audit log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id uuid REFERENCES public.registros(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_registro ON public.audit_log(registro_id);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_auth" ON public.audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_insert_auth" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER registros_updated BEFORE UPDATE ON public.registros
FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

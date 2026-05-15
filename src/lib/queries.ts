import { supabase } from "@/integrations/supabase/client";

export interface Competencia {
  id: string;
  mes: number;
  ano: number;
  registros_count: number;
  valor_total: number;
  arquivo_nome: string | null;
  created_at: string;
  created_by: string | null;
}

export interface Registro {
  id: string;
  competencia_id: string;
  prestador: string;
  cnpj: string | null;
  valor_procedimentos: number;
  valor_glosa: number;
  valor_bruto: number;
  valor_liquido: number;
  valor_pago: number;
  qtde_procedimentos: number;
  empresarial: number;
  individual: number;
  coletivo: number;
  ortodontia: number;
  municipio: string | null;
  uf: string | null;
  bairro: string | null;
  data_pagamento: string | null;
  pis: number;
  cofins: number;
  csll: number;
  inss: number;
  iss: number;
  ir: number;
  conta_financeiro: string | null;
  banco: string | null;
  email: string | null;
  telefone: string | null;
  lote: string | null;
}

export async function fetchCompetencias(): Promise<Competencia[]> {
  const { data, error } = await supabase
    .from("competencias")
    .select("*")
    .order("ano", { ascending: false })
    .order("mes", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Competencia[];
}

export async function fetchRegistros(competenciaId?: string | null): Promise<Registro[]> {
  let q = supabase.from("registros").select("*").limit(5000);
  if (competenciaId) q = q.eq("competencia_id", competenciaId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Registro[];
}

export async function fetchAllRegistrosWithCompetencia() {
  const { data, error } = await supabase
    .from("registros")
    .select("*, competencia:competencias(mes, ano)")
    .limit(20000);
  if (error) throw error;
  return data ?? [];
}
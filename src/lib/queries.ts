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

const REGISTROS_PAGE_SIZE = 1000;

export async function fetchCompetencias(): Promise<Competencia[]> {
  const { data, error } = await supabase
    .from("competencias")
    .select("*")
    .order("ano", { ascending: false })
    .order("mes", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Competencia[];
}

async function fetchPaginatedRegistros<T>(
  selectClause: string,
  filters?: {
    competenciaId?: string | null;
    competenciaIds?: string[];
  },
) {
  const rows: T[] = [];

  for (let from = 0; ; from += REGISTROS_PAGE_SIZE) {
    let query = supabase
      .from("registros")
      .select(selectClause)
      .range(from, from + REGISTROS_PAGE_SIZE - 1);

    if (filters?.competenciaId) {
      query = query.eq("competencia_id", filters.competenciaId);
    }

    if (filters?.competenciaIds?.length) {
      query = query.in("competencia_id", filters.competenciaIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data ?? []) as T[];
    rows.push(...batch);

    if (batch.length < REGISTROS_PAGE_SIZE) break;
  }

  return rows;
}

export async function fetchRegistros(competenciaId?: string | null): Promise<Registro[]> {
  return fetchPaginatedRegistros<Registro>("*", { competenciaId });
}

export async function fetchRegistrosByCompetencias<T extends object = Registro>(
  competenciaIds: string[],
  selectClause = "*",
): Promise<T[]> {
  if (!competenciaIds.length) return [];
  return fetchPaginatedRegistros<T>(selectClause, { competenciaIds });
}

export async function fetchAllRegistrosWithCompetencia() {
  const { data, error } = await supabase
    .from("registros")
    .select("*, competencia:competencias(mes, ano)")
    .limit(20000);
  if (error) throw error;
  return data ?? [];
}

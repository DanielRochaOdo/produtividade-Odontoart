import * as XLSX from "xlsx";

export interface ParsedRegistro {
  lote: string | null;
  data_gerado: string | null;
  data_abertura: string | null;
  codigo: string | null;
  prestador: string;
  cnpj: string | null;
  nome_titular: string | null;
  banco: string | null;
  conta_financeiro: string | null;
  valor_procedimentos: number;
  valor_glosa: number;
  valor_lote: number;
  valor_acerto: number;
  valor_bruto: number;
  pis: number;
  cofins: number;
  csll: number;
  inss: number;
  iss: number;
  ir: number;
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
  email: string | null;
  telefone: string | null;
  data_pagamento: string | null;
}

export interface ParseResult {
  registros: ParsedRegistro[];
  errors: string[];
  competencia: { mes: number; ano: number } | null;
  totalLinhas: number;
}

const num = (v: unknown): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return isFinite(n) ? n : 0;
};

const str = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  return String(v).trim();
};

const dateToISO = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v);
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
};

export async function parseExcel(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true,
  });

  const errors: string[] = [];
  const registros: ParsedRegistro[] = [];
  let competencia: { mes: number; ano: number } | null = null;

  rows.forEach((r, idx) => {
    const prestador = str(r["Prestador"]);
    if (!prestador) {
      // skip empty rows silently
      if (Object.values(r).every((v) => v == null || v === "")) return;
      errors.push(`Linha ${idx + 2}: prestador ausente`);
      return;
    }
    const dpag = dateToISO(r["Data Pagamento"]);
    if (dpag && !competencia) {
      const [y, m] = dpag.split("-");
      competencia = { ano: Number(y), mes: Number(m) };
    }
    registros.push({
      lote: str(r["Lote"]),
      data_gerado: dateToISO(r["Data Gerado"]),
      data_abertura: dateToISO(r["Data Abertura"]),
      codigo: str(r["Código"]),
      prestador,
      cnpj: str(r["CPF/CNPJ"]),
      nome_titular: str(r["Nome Titular"]),
      banco: str(r["Banco"]),
      conta_financeiro: str(r["Conta Financeiro"]),
      valor_procedimentos: num(r["Valor Procedimentos (+)"]),
      valor_glosa: num(r["Valor Glosa (-)"]),
      valor_lote: num(r["Valor Lote (=)"]),
      valor_acerto: num(r["Valor Acerto (+)"]),
      valor_bruto: num(r["Valor Bruto (=)"]),
      pis: num(r["PIS (-)"]),
      cofins: num(r["COFINS (-)"]),
      csll: num(r["CSLL (-)"]),
      inss: num(r["INSS (-)"]),
      iss: num(r["ISS (-)"]),
      ir: num(r["IR (-)"]),
      valor_liquido: num(r["Líquido (=)"]),
      valor_pago: num(r["Valor Pago"]),
      qtde_procedimentos: Math.round(num(r["Qtde Procedimentos"])),
      empresarial: num(r["Empresarial"]),
      individual: num(r["Individual"]),
      coletivo: num(r["Coletivo"]),
      ortodontia: num(r["Ortodontia"]),
      municipio: str(r["Município"]),
      uf: str(r["UF"]),
      bairro: str(r["Bairro"]),
      email: str(r["Email"]),
      telefone: str(r["Telefone"]),
      data_pagamento: dpag,
    });
  });

  return { registros, errors, competencia, totalLinhas: rows.length };
}

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const monthName = (m: number) =>
  ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m - 1];
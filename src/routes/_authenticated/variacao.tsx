import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { fetchCompetencias } from "@/lib/queries";
import { formatBRL, monthName } from "@/lib/excel/parser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  TrendingDown,
  TrendingUp,
  Wallet,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/variacao")({
  component: VariacaoPage,
});

type PeriodMode = "all" | "year" | "range";
type SortKey = "nome" | "total" | "var" | string; // string = "m:YYYY-MM"

interface Row {
  prestador: string;
  municipio: string | null;
  uf: string | null;
  porMes: Record<string, number>;
  total: number;
  varPct: number | null; // último vs primeiro mês com pagamento
}

async function fetchVariacaoData() {
  const { data, error } = await supabase
    .from("registros")
    .select(
      "prestador, municipio, uf, valor_liquido, competencia:competencias(mes, ano)",
    )
    .limit(50000);
  if (error) throw error;
  return data ?? [];
}

function VariacaoPage() {
  const { data: comps = [] } = useQuery({
    queryKey: ["competencias"],
    queryFn: fetchCompetencias,
  });
  const { data: raw = [], isLoading } = useQuery({
    queryKey: ["variacao-data"],
    queryFn: fetchVariacaoData,
  });

  const [mode, setMode] = useState<PeriodMode>("all");
  const [year, setYear] = useState<string>("");
  const [fromKey, setFromKey] = useState<string>("");
  const [toKey, setToKey] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const allMonthKeys = useMemo(() => {
    const set = new Set<string>();
    for (const c of comps) {
      set.add(`${c.ano}-${String(c.mes).padStart(2, "0")}`);
    }
    return Array.from(set).sort();
  }, [comps]);

  const years = useMemo(
    () => Array.from(new Set(comps.map((c) => c.ano))).sort((a, b) => b - a),
    [comps],
  );

  const monthKeys = useMemo(() => {
    if (mode === "year" && year) {
      return allMonthKeys.filter((k) => k.startsWith(year));
    }
    if (mode === "range" && fromKey && toKey) {
      return allMonthKeys.filter((k) => k >= fromKey && k <= toKey);
    }
    return allMonthKeys;
  }, [mode, year, fromKey, toKey, allMonthKeys]);

  const rows: Row[] = useMemo(() => {
    if (!raw.length || !monthKeys.length) return [];
    const monthSet = new Set(monthKeys);
    const map = new Map<string, Row>();
    for (const r of raw as any[]) {
      const c = r.competencia;
      if (!c) continue;
      const k = `${c.ano}-${String(c.mes).padStart(2, "0")}`;
      if (!monthSet.has(k)) continue;
      const nome = r.prestador as string;
      let row = map.get(nome);
      if (!row) {
        row = {
          prestador: nome,
          municipio: r.municipio,
          uf: r.uf,
          porMes: {},
          total: 0,
          varPct: null,
        };
        map.set(nome, row);
      }
      const v = Number(r.valor_liquido) || 0;
      row.porMes[k] = (row.porMes[k] ?? 0) + v;
      row.total += v;
    }
    // garantir 0 nos meses sem pagamento + variação
    // Regra: comparar SEMPRE o primeiro mês do período selecionado vs o último.
    const firstKey = monthKeys[0];
    const lastKey = monthKeys[monthKeys.length - 1];
    for (const row of map.values()) {
      for (const k of monthKeys) {
        row.porMes[k] = row.porMes[k] ?? 0;
      }
      const firstVal = row.porMes[firstKey] ?? 0;
      const lastVal = row.porMes[lastKey] ?? 0;

      if (firstVal === 0 && lastVal === 0) {
        // sem produção nas pontas — nada mudou entre início e fim do período
        row.varPct = 0;
      } else if (firstVal === 0 && lastVal > 0) {
        // novo: não produzia no início, passou a produzir no fim
        row.varPct = 1;
      } else if (firstVal > 0 && lastVal === 0) {
        // deixou de produzir no fim do período
        row.varPct = -1;
      } else {
        row.varPct = (lastVal - firstVal) / firstVal;
      }
    }
    return Array.from(map.values());
  }, [raw, monthKeys]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let arr = s
      ? rows.filter((r) => r.prestador.toLowerCase().includes(s))
      : rows;
    arr = [...arr].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "nome") {
        av = a.prestador;
        bv = b.prestador;
      } else if (sortKey === "total") {
        av = a.total;
        bv = b.total;
      } else if (sortKey === "var") {
        av = a.varPct ?? -Infinity;
        bv = b.varPct ?? -Infinity;
      } else if (sortKey.startsWith("m:")) {
        const k = sortKey.slice(2);
        av = a.porMes[k] ?? 0;
        bv = b.porMes[k] ?? 0;
      } else {
        av = 0;
        bv = 0;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return arr;
  }, [rows, search, sortKey, sortDir]);

  const totalGeral = useMemo(
    () => filtered.reduce((s, r) => s + r.total, 0),
    [filtered],
  );
  const totalsPorMes = useMemo(() => {
    const t: Record<string, number> = {};
    for (const k of monthKeys) t[k] = 0;
    for (const r of filtered) {
      for (const k of monthKeys) t[k] += r.porMes[k] ?? 0;
    }
    return t;
  }, [filtered, monthKeys]);

  const variacaoGlobal = useMemo(() => {
    if (monthKeys.length < 2) return 0;
    const first = totalsPorMes[monthKeys[0]] ?? 0;
    const last = totalsPorMes[monthKeys[monthKeys.length - 1]] ?? 0;
    if (!first) return 0;
    return (last - first) / first;
  }, [totalsPorMes, monthKeys]);

  const cresc = useMemo(
    () => filtered.filter((r) => (r.varPct ?? 0) > 0).length,
    [filtered],
  );
  const queda = useMemo(
    () => filtered.filter((r) => (r.varPct ?? 0) < 0).length,
    [filtered],
  );

  const chartData = useMemo(
    () =>
      monthKeys.map((k) => {
        const [y, m] = k.split("-");
        return {
          mes: `${monthName(Number(m))}/${y.slice(2)}`,
          total: totalsPorMes[k] ?? 0,
        };
      }),
    [monthKeys, totalsPorMes],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "nome" ? "asc" : "desc");
    }
    setPage(1);
  };

  const exportXlsx = () => {
    const header = [
      "Prestador",
      "Município/UF",
      ...monthKeys.map((k) => {
        const [y, m] = k.split("-");
        return `Valor Líquido ${m}/${y}`;
      }),
      "Total",
      "Variação %",
    ];
    const body = filtered.map((r) => [
      r.prestador,
      [r.municipio, r.uf].filter(Boolean).join("/"),
      ...monthKeys.map((k) => r.porMes[k] ?? 0),
      r.total,
      r.varPct ?? 0,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Variação");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `analise_variacao_pagamentos_${stamp}.xlsx`);
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? (
      <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />
    ) : sortDir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Variação de Pagamentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Evolução mensal por prestador, com comparação e variação percentual.
          </p>
        </div>
        <Button onClick={exportXlsx} className="gap-2">
          <Download className="h-4 w-4" /> Exportar Excel
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Período
            </label>
            <Select
              value={mode}
              onValueChange={(v) => {
                setMode(v as PeriodMode);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                <SelectItem value="year">Ano inteiro</SelectItem>
                <SelectItem value="range">Intervalo personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "year" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Ano
              </label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "range" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  De
                </label>
                <Select value={fromKey} onValueChange={setFromKey}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Mês inicial" />
                  </SelectTrigger>
                  <SelectContent>
                    {allMonthKeys.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Até
                </label>
                <Select value={toKey} onValueChange={setToKey}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Mês final" />
                  </SelectTrigger>
                  <SelectContent>
                    {allMonthKeys.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="ml-auto space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Buscar prestador
            </label>
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Nome..."
              className="w-[260px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Wallet className="h-4 w-4 text-primary" /> Total no período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatBRL(totalGeral)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4 text-primary" /> Prestadores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Em crescimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{cresc}</p>
            <p className="text-xs text-muted-foreground">
              Variação global: {(variacaoGlobal * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingDown className="h-4 w-4 text-red-500" /> Em queda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{queda}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico evolução */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução mensal — total pago</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="mes" />
              <YAxis
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
              />
              <Tooltip formatter={(v: number) => formatBRL(v)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="total"
                name="Total pago"
                stroke="var(--primary)"
                strokeWidth={3}
                dot={{ fill: "var(--gold)", r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Análise por prestador ({filtered.length})
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Página {page} de {totalPages}
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("nome")}
                  >
                    Prestador <SortIcon k="nome" />
                  </TableHead>
                  <TableHead>Município/UF</TableHead>
                  {monthKeys.map((k) => {
                    const [y, m] = k.split("-");
                    return (
                      <TableHead
                        key={k}
                        className="cursor-pointer text-right"
                        onClick={() => toggleSort(`m:${k}`)}
                      >
                        {monthName(Number(m))}/{y.slice(2)}{" "}
                        <SortIcon k={`m:${k}`} />
                      </TableHead>
                    );
                  })}
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => toggleSort("total")}
                  >
                    Total <SortIcon k="total" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => toggleSort("var")}
                  >
                    Var % <SortIcon k="var" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.prestador}>
                    <TableCell className="font-medium">{r.prestador}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[r.municipio, r.uf].filter(Boolean).join("/")}
                    </TableCell>
                    {monthKeys.map((k) => {
                      const v = r.porMes[k] ?? 0;
                      return (
                        <TableCell
                          key={k}
                          className={`text-right tabular-nums ${
                            v === 0 ? "text-muted-foreground" : ""
                          }`}
                        >
                          {formatBRL(v)}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatBRL(r.total)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${
                        r.varPct == null
                          ? "text-muted-foreground"
                          : r.varPct > 0
                            ? "text-emerald-600"
                            : r.varPct < 0
                              ? "text-red-600"
                              : ""
                      }`}
                    >
                      {r.varPct == null
                        ? "—"
                        : `${r.varPct > 0 ? "+" : ""}${(r.varPct * 100).toFixed(1)}%`}
                    </TableCell>
                  </TableRow>
                ))}
                {!pageRows.length && (
                  <TableRow>
                    <TableCell
                      colSpan={monthKeys.length + 4}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Nenhum dado para o período selecionado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
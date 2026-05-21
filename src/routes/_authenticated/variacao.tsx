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
import { fetchCompetencias, fetchRegistrosForVariacao, type VariacaoRegistro } from "@/lib/queries";
import { formatBRL, monthName } from "@/lib/excel/parser";
import { getPaymentScope, PAYMENT_SCOPE_OPTIONS, type PaymentScope } from "@/lib/payment-type";
import { calculatePercentChange } from "@/lib/variation";
import { normalizeText } from "@/lib/text-normalization";
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
type SortKey = "nome" | "total" | "var" | string;

interface Row {
  prestador: string;
  municipio: string | null;
  uf: string | null;
  porMes: Record<string, number>;
  total: number;
  varPct: number | null;
}

function VariacaoPage() {
  const { data: comps = [] } = useQuery({
    queryKey: ["competencias"],
    queryFn: fetchCompetencias,
  });
  const { data: raw = [], isLoading } = useQuery({
    queryKey: ["variacao-data"],
    queryFn: fetchRegistrosForVariacao,
  });

  const [mode, setMode] = useState<PeriodMode>("all");
  const [year, setYear] = useState<string>("");
  const [fromKey, setFromKey] = useState<string>("");
  const [toKey, setToKey] = useState<string>("");
  const [search, setSearch] = useState("");
  const [paymentScope, setPaymentScope] = useState<PaymentScope>("all");
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
    if (mode === "year" && year) return allMonthKeys.filter((k) => k.startsWith(year));
    if (mode === "range" && fromKey && toKey) {
      return allMonthKeys.filter((k) => k >= fromKey && k <= toKey);
    }
    return allMonthKeys;
  }, [mode, year, fromKey, toKey, allMonthKeys]);

  const rows: Row[] = useMemo(() => {
    if (!raw.length || !monthKeys.length) return [];
    const monthSet = new Set(monthKeys);
    const map = new Map<string, Row>();

    for (const r of raw as VariacaoRegistro[]) {
      if (paymentScope !== "all" && getPaymentScope(r.conta_financeiro) !== paymentScope) continue;
      const c = r.competencia;
      if (!c) continue;
      const key = `${c.ano}-${String(c.mes).padStart(2, "0")}`;
      if (!monthSet.has(key)) continue;

      const nome = r.prestador;
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

      const value = Number(r.valor_liquido) || 0;
      row.porMes[key] = (row.porMes[key] ?? 0) + value;
      row.total += value;
    }

    const firstKey = monthKeys[0];
    const lastKey = monthKeys[monthKeys.length - 1];
    for (const row of map.values()) {
      for (const key of monthKeys) row.porMes[key] = row.porMes[key] ?? 0;
      const firstVal = row.porMes[firstKey] ?? 0;
      const lastVal = row.porMes[lastKey] ?? 0;

      const pct = calculatePercentChange(lastVal, firstVal);
      row.varPct = pct === null ? (lastVal === 0 ? 0 : null) : pct / 100;
    }

    return Array.from(map.values());
  }, [raw, monthKeys, paymentScope]);

  const filtered = useMemo(() => {
    const s = normalizeText(search);
    let arr = s ? rows.filter((r) => normalizeText(r.prestador).includes(s)) : rows;
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
        const monthKey = sortKey.slice(2);
        av = a.porMes[monthKey] ?? 0;
        bv = b.porMes[monthKey] ?? 0;
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
    () => filtered.reduce((sum, row) => sum + row.total, 0),
    [filtered],
  );
  const totalsPorMes = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const key of monthKeys) totals[key] = 0;
    for (const row of filtered) {
      for (const key of monthKeys) totals[key] += row.porMes[key] ?? 0;
    }
    return totals;
  }, [filtered, monthKeys]);

  const variacaoGlobal = useMemo<number | null>(() => {
    if (monthKeys.length < 2) return 0;
    const first = totalsPorMes[monthKeys[0]] ?? 0;
    const last = totalsPorMes[monthKeys[monthKeys.length - 1]] ?? 0;
    const pct = calculatePercentChange(last, first);
    if (pct === null) return last === 0 ? 0 : null;
    return pct / 100;
  }, [totalsPorMes, monthKeys]);

  const cresc = useMemo(
    () => filtered.filter((row) => (row.varPct ?? 0) > 0).length,
    [filtered],
  );
  const queda = useMemo(
    () => filtered.filter((row) => (row.varPct ?? 0) < 0).length,
    [filtered],
  );

  const chartData = useMemo(
    () =>
      monthKeys.map((key) => {
        const [yearValue, monthValue] = key.split("-");
        return {
          mes: `${monthName(Number(monthValue))}/${yearValue.slice(2)}`,
          total: totalsPorMes[key] ?? 0,
        };
      }),
    [monthKeys, totalsPorMes],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "nome" ? "asc" : "desc");
    }
    setPage(1);
  };

  const exportXlsx = () => {
    const header = [
      "Prestador",
      "Município/UF",
      ...monthKeys.map((key) => {
        const [yearValue, monthValue] = key.split("-");
        return `Valor Líquido ${monthValue}/${yearValue}`;
      }),
      "Total",
      "Variação %",
    ];
    const body = filtered.map((row) => [
      row.prestador,
      [row.municipio, row.uf].filter(Boolean).join("/"),
      ...monthKeys.map((key) => row.porMes[key] ?? 0),
      row.total,
      row.varPct == null ? null : Number((row.varPct * 100).toFixed(2)),
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

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Período
            </label>
            <Select
              value={mode}
              onValueChange={(value) => {
                setMode(value as PeriodMode);
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
                  {years.map((yearValue) => (
                    <SelectItem key={yearValue} value={String(yearValue)}>
                      {yearValue}
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
                    {allMonthKeys.map((key) => (
                      <SelectItem key={key} value={key}>
                        {key}
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
                    {allMonthKeys.map((key) => (
                      <SelectItem key={key} value={key}>
                        {key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Tipo de pagamento
            </label>
            <Select
              value={paymentScope}
              onValueChange={(value) => {
                setPaymentScope(value as PaymentScope);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              Variação global:{" "}
              {variacaoGlobal == null ? "—" : `${(variacaoGlobal * 100).toFixed(1)}%`}
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
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("nome")}>
                    Prestador <SortIcon k="nome" />
                  </TableHead>
                  <TableHead>Município/UF</TableHead>
                  {monthKeys.map((key) => {
                    const [yearValue, monthValue] = key.split("-");
                    return (
                      <TableHead
                        key={key}
                        className="cursor-pointer text-right"
                        onClick={() => toggleSort(`m:${key}`)}
                      >
                        {monthName(Number(monthValue))}/{yearValue.slice(2)}{" "}
                        <SortIcon k={`m:${key}`} />
                      </TableHead>
                    );
                  })}
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("total")}>
                    Total <SortIcon k="total" />
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("var")}>
                    Var % <SortIcon k="var" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow key={row.prestador}>
                    <TableCell className="font-medium">{row.prestador}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[row.municipio, row.uf].filter(Boolean).join("/")}
                    </TableCell>
                    {monthKeys.map((key) => {
                      const value = row.porMes[key] ?? 0;
                      return (
                        <TableCell
                          key={key}
                          className={`text-right tabular-nums ${value === 0 ? "text-muted-foreground" : ""}`}
                        >
                          {formatBRL(value)}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatBRL(row.total)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${
                        row.varPct == null
                          ? "text-muted-foreground"
                          : row.varPct > 0
                            ? "text-emerald-600"
                            : row.varPct < 0
                              ? "text-red-600"
                              : ""
                      }`}
                    >
                      {row.varPct == null
                        ? "—"
                        : `${row.varPct > 0 ? "+" : ""}${(row.varPct * 100).toFixed(1)}%`}
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

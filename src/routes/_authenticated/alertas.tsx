import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { fetchCompetencias, fetchAllRegistrosWithCompetencia } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AlertTriangle, TrendingDown, TrendingUp, Ban, Sparkles, Download, Filter } from "lucide-react";
import { formatBRL, monthName } from "@/lib/excel/parser";

export const Route = createFileRoute("/_authenticated/alertas")({
  component: AlertasPage,
});

type Tipo = "queda" | "alta" | "zero" | "nova" | "anomalia";

interface Alerta {
  tipo: Tipo;
  prestador: string;
  cnpj: string;
  competencia: string;
  competenciaAnterior: string;
  valorAnterior: number;
  valorAtual: number;
  variacaoPct: number;
  desc: string;
  ano: number;
  mes: number;
}

const meta: Record<Tipo, { icon: React.ComponentType<{ className?: string }>; cls: string; label: string }> = {
  queda: { icon: TrendingDown, cls: "border-destructive/40 bg-destructive/5", label: "Queda" },
  alta: { icon: TrendingUp, cls: "border-warning/40 bg-warning/5", label: "Crescimento atípico" },
  zero: { icon: Ban, cls: "border-destructive/40 bg-destructive/5", label: "Sem produção" },
  nova: { icon: Sparkles, cls: "border-success/40 bg-success/5", label: "Nova entrada" },
  anomalia: { icon: AlertTriangle, cls: "border-warning/40 bg-warning/5", label: "Anomalia" },
};

const compKey = (c: { ano: number; mes: number }) => `${c.ano}-${String(c.mes).padStart(2, "0")}`;
const compLabel = (c: { ano: number; mes: number }) => `${monthName(c.mes)}/${c.ano}`;

function AlertasPage() {
  const { data: comps = [] } = useQuery({ queryKey: ["competencias"], queryFn: fetchCompetencias });
  const { data: allRegs = [] } = useQuery({
    queryKey: ["regs-all-with-comp"],
    queryFn: fetchAllRegistrosWithCompetencia,
  });

  const sortedComps = useMemo(
    () => [...comps].sort((a, b) => (a.ano - b.ano) || (a.mes - b.mes)),
    [comps],
  );

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [tipos, setTipos] = useState<Tipo[]>(["queda", "alta", "zero", "nova"]);

  const effectiveFrom = from || (sortedComps[0] ? compKey(sortedComps[0]) : "");
  const effectiveTo = to || (sortedComps.at(-1) ? compKey(sortedComps.at(-1)!) : "");

  const alertas = useMemo<Alerta[]>(() => {
    if (!sortedComps.length || !allRegs.length) return [];

    // Group registros by competencia key
    const byComp = new Map<string, Map<string, { nome: string; total: number }>>();
    for (const r of allRegs as any[]) {
      const c = r.competencia;
      if (!c) continue;
      const ck = compKey(c);
      if (!byComp.has(ck)) byComp.set(ck, new Map());
      const m = byComp.get(ck)!;
      const k = r.cnpj || r.prestador;
      const e = m.get(k) ?? { nome: r.prestador, total: 0 };
      e.total += Number(r.valor_liquido) || 0;
      m.set(k, e);
    }

    const list: Alerta[] = [];
    for (let i = 1; i < sortedComps.length; i++) {
      const cur = sortedComps[i];
      const prev = sortedComps[i - 1];
      const ck = compKey(cur);
      if (ck < effectiveFrom || ck > effectiveTo) continue;

      const a = byComp.get(ck) ?? new Map();
      const b = byComp.get(compKey(prev)) ?? new Map();

      // Quedas / Altas / Zero baseadas em quem produzia antes
      for (const [k, v] of b) {
        const at = a.get(k);
        if (!at || at.total === 0) {
          list.push({
            tipo: "zero",
            prestador: v.nome,
            cnpj: k,
            competencia: compLabel(cur),
            competenciaAnterior: compLabel(prev),
            valorAnterior: v.total,
            valorAtual: 0,
            variacaoPct: -100,
            desc: `Produzia ${formatBRL(v.total)} em ${compLabel(prev)} e zerou em ${compLabel(cur)}`,
            ano: cur.ano,
            mes: cur.mes,
          });
        } else {
          const delta = ((at.total - v.total) / v.total) * 100;
          if (delta < -30) {
            list.push({
              tipo: "queda",
              prestador: v.nome,
              cnpj: k,
              competencia: compLabel(cur),
              competenciaAnterior: compLabel(prev),
              valorAnterior: v.total,
              valorAtual: at.total,
              variacaoPct: delta,
              desc: `Queda de ${delta.toFixed(1)}% — ${formatBRL(v.total)} → ${formatBRL(at.total)}`,
              ano: cur.ano,
              mes: cur.mes,
            });
          } else if (delta > 50) {
            list.push({
              tipo: "alta",
              prestador: v.nome,
              cnpj: k,
              competencia: compLabel(cur),
              competenciaAnterior: compLabel(prev),
              valorAnterior: v.total,
              valorAtual: at.total,
              variacaoPct: delta,
              desc: `Crescimento de ${delta.toFixed(1)}% — ${formatBRL(v.total)} → ${formatBRL(at.total)}`,
              ano: cur.ano,
              mes: cur.mes,
            });
          }
        }
      }

      // Novas entradas: estavam zerados/ausentes antes e produziram agora
      for (const [k, at] of a) {
        if (!b.has(k) && at.total > 0) {
          list.push({
            tipo: "nova",
            prestador: at.nome,
            cnpj: k,
            competencia: compLabel(cur),
            competenciaAnterior: compLabel(prev),
            valorAnterior: 0,
            valorAtual: at.total,
            variacaoPct: 100,
            desc: `Nova produção em ${compLabel(cur)} — ${formatBRL(at.total)}`,
            ano: cur.ano,
            mes: cur.mes,
          });
        }
      }
    }

    return list.sort((a, b) => {
      if (a.ano !== b.ano) return b.ano - a.ano;
      if (a.mes !== b.mes) return b.mes - a.mes;
      return Math.abs(b.variacaoPct) - Math.abs(a.variacaoPct);
    });
  }, [sortedComps, allRegs, effectiveFrom, effectiveTo]);

  const filtrados = useMemo(
    () => alertas.filter((a) => tipos.includes(a.tipo)),
    [alertas, tipos],
  );

  const counts = useMemo(() => {
    const c: Record<Tipo, number> = { queda: 0, alta: 0, zero: 0, nova: 0, anomalia: 0 };
    for (const a of alertas) c[a.tipo]++;
    return c;
  }, [alertas]);

  const exportar = () => {
    const rows = filtrados.map((a) => ({
      Competência: a.competencia,
      "Competência Anterior": a.competenciaAnterior,
      Motivo: meta[a.tipo].label,
      Prestador: a.prestador,
      CNPJ: a.cnpj,
      "Valor Anterior": Number(a.valorAnterior.toFixed(2)),
      "Valor Atual": Number(a.valorAtual.toFixed(2)),
      "Variação %": Number(a.variacaoPct.toFixed(2)),
      Descrição: a.desc,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alertas");
    XLSX.writeFile(wb, `alertas-${effectiveFrom}_${effectiveTo}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alertas Gerenciais</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Variações relevantes por prestador entre competências
          </p>
        </div>
        <Button onClick={exportar} disabled={!filtrados.length} className="gap-2">
          <Download className="h-4 w-4" /> Exportar Excel
        </Button>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">De</label>
              <Select value={effectiveFrom} onValueChange={setFrom}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {sortedComps.map((c) => (
                    <SelectItem key={compKey(c)} value={compKey(c)}>{compLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Até</label>
              <Select value={effectiveTo} onValueChange={setTo}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {sortedComps.map((c) => (
                    <SelectItem key={compKey(c)} value={compKey(c)}>{compLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Motivos</label>
            <ToggleGroup
              type="multiple"
              value={tipos}
              onValueChange={(v) => v.length && setTipos(v as Tipo[])}
              className="flex-wrap justify-start gap-2"
            >
              {(Object.keys(meta) as Tipo[]).filter((t) => t !== "anomalia").map((t) => {
                const M = meta[t];
                return (
                  <ToggleGroupItem key={t} value={t} className="gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    <M.icon className="h-4 w-4" />
                    {M.label}
                    <span className="ml-1 text-xs opacity-70">({counts[t]})</span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        {filtrados.length} alerta{filtrados.length === 1 ? "" : "s"} no período
      </div>

      {!filtrados.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum alerta com os filtros atuais.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((a, i) => {
            const M = meta[a.tipo];
            return (
              <Card key={i} className={`shadow-card border-l-4 ${M.cls}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <M.icon className="h-4 w-4" />
                      {M.label}
                    </CardTitle>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {a.competencia}
                    </span>
                  </div>
                  <CardDescription className="font-medium text-foreground text-sm truncate">
                    {a.prestador}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

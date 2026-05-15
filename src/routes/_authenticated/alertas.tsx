import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { fetchCompetencias, fetchAllRegistrosWithCompetencia } from "@/lib/queries";
import { getPaymentScope, PAYMENT_SCOPE_OPTIONS, type PaymentScope } from "@/lib/payment-type";
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

interface RegistroComCompetencia {
  prestador: string;
  cnpj: string | null;
  valor_liquido: number | null;
  conta_financeiro: string | null;
  competencia: { mes: number; ano: number } | null;
}

const meta: Record<Tipo, { icon: React.ComponentType<{ className?: string }>; cls: string; label: string }> = {
  queda: { icon: TrendingDown, cls: "border-destructive/40 bg-destructive/5", label: "Queda" },
  alta: { icon: TrendingUp, cls: "border-warning/40 bg-warning/5", label: "Crescimento atipico" },
  zero: { icon: Ban, cls: "border-destructive/40 bg-destructive/5", label: "Sem producao" },
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
  const [paymentScope, setPaymentScope] = useState<PaymentScope>("all");
  const [tipos, setTipos] = useState<Tipo[]>(["queda", "alta", "zero", "nova"]);

  const effectiveFrom = from || (sortedComps[0] ? compKey(sortedComps[0]) : "");
  const effectiveTo = to || (sortedComps.at(-1) ? compKey(sortedComps.at(-1)!) : "");

  const alertas = useMemo<Alerta[]>(() => {
    if (!sortedComps.length || !allRegs.length) return [];

    const byComp = new Map<string, Map<string, { nome: string; total: number }>>();
    for (const r of allRegs as RegistroComCompetencia[]) {
      if (paymentScope !== "all" && getPaymentScope(r.conta_financeiro) !== paymentScope) continue;
      const c = r.competencia;
      if (!c) continue;
      const competenciaKey = compKey(c);
      if (!byComp.has(competenciaKey)) byComp.set(competenciaKey, new Map());
      const competenciaMap = byComp.get(competenciaKey)!;
      const key = r.cnpj || r.prestador;
      const entry = competenciaMap.get(key) ?? { nome: r.prestador, total: 0 };
      entry.total += Number(r.valor_liquido) || 0;
      competenciaMap.set(key, entry);
    }

    const list: Alerta[] = [];
    for (let i = 1; i < sortedComps.length; i++) {
      const current = sortedComps[i];
      const previous = sortedComps[i - 1];
      const currentKey = compKey(current);
      if (currentKey < effectiveFrom || currentKey > effectiveTo) continue;

      const currentMap = byComp.get(currentKey) ?? new Map();
      const previousMap = byComp.get(compKey(previous)) ?? new Map();

      for (const [key, value] of previousMap) {
        const currentValue = currentMap.get(key);
        if (!currentValue || currentValue.total === 0) {
          list.push({
            tipo: "zero",
            prestador: value.nome,
            cnpj: key,
            competencia: compLabel(current),
            competenciaAnterior: compLabel(previous),
            valorAnterior: value.total,
            valorAtual: 0,
            variacaoPct: -100,
            desc: `Produzia ${formatBRL(value.total)} em ${compLabel(previous)} e zerou em ${compLabel(current)}`,
            ano: current.ano,
            mes: current.mes,
          });
        } else {
          const delta = ((currentValue.total - value.total) / value.total) * 100;
          if (delta < -30) {
            list.push({
              tipo: "queda",
              prestador: value.nome,
              cnpj: key,
              competencia: compLabel(current),
              competenciaAnterior: compLabel(previous),
              valorAnterior: value.total,
              valorAtual: currentValue.total,
              variacaoPct: delta,
              desc: `Queda de ${delta.toFixed(1)}% - ${formatBRL(value.total)} -> ${formatBRL(currentValue.total)}`,
              ano: current.ano,
              mes: current.mes,
            });
          } else if (delta > 50) {
            list.push({
              tipo: "alta",
              prestador: value.nome,
              cnpj: key,
              competencia: compLabel(current),
              competenciaAnterior: compLabel(previous),
              valorAnterior: value.total,
              valorAtual: currentValue.total,
              variacaoPct: delta,
              desc: `Crescimento de ${delta.toFixed(1)}% - ${formatBRL(value.total)} -> ${formatBRL(currentValue.total)}`,
              ano: current.ano,
              mes: current.mes,
            });
          }
        }
      }

      for (const [key, currentValue] of currentMap) {
        if (!previousMap.has(key) && currentValue.total > 0) {
          list.push({
            tipo: "nova",
            prestador: currentValue.nome,
            cnpj: key,
            competencia: compLabel(current),
            competenciaAnterior: compLabel(previous),
            valorAnterior: 0,
            valorAtual: currentValue.total,
            variacaoPct: 100,
            desc: `Nova producao em ${compLabel(current)} - ${formatBRL(currentValue.total)}`,
            ano: current.ano,
            mes: current.mes,
          });
        }
      }
    }

    return list.sort((a, b) => {
      if (a.ano !== b.ano) return b.ano - a.ano;
      if (a.mes !== b.mes) return b.mes - a.mes;
      return Math.abs(b.variacaoPct) - Math.abs(a.variacaoPct);
    });
  }, [sortedComps, allRegs, effectiveFrom, effectiveTo, paymentScope]);

  const filtrados = useMemo(
    () => alertas.filter((alerta) => tipos.includes(alerta.tipo)),
    [alertas, tipos],
  );

  const counts = useMemo(() => {
    const result: Record<Tipo, number> = { queda: 0, alta: 0, zero: 0, nova: 0, anomalia: 0 };
    for (const alerta of alertas) result[alerta.tipo]++;
    return result;
  }, [alertas]);

  const exportar = () => {
    const rows = filtrados.map((alerta) => ({
      Competencia: alerta.competencia,
      "Competencia Anterior": alerta.competenciaAnterior,
      Motivo: meta[alerta.tipo].label,
      Prestador: alerta.prestador,
      CNPJ: alerta.cnpj,
      "Valor Anterior": Number(alerta.valorAnterior.toFixed(2)),
      "Valor Atual": Number(alerta.valorAtual.toFixed(2)),
      "Variacao %": Number(alerta.variacaoPct.toFixed(2)),
      Descricao: alerta.desc,
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
            Variacoes relevantes por prestador entre competencias
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
          <div className="grid gap-3 sm:grid-cols-3">
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
              <label className="text-xs font-medium text-muted-foreground">Ate</label>
              <Select value={effectiveTo} onValueChange={setTo}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {sortedComps.map((c) => (
                    <SelectItem key={compKey(c)} value={compKey(c)}>{compLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tipo de pagamento</label>
              <Select value={paymentScope} onValueChange={(value) => setPaymentScope(value as PaymentScope)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_SCOPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
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
              onValueChange={(value) => value.length && setTipos(value as Tipo[])}
              className="flex-wrap justify-start gap-2"
            >
              {(Object.keys(meta) as Tipo[]).filter((tipo) => tipo !== "anomalia").map((tipo) => {
                const itemMeta = meta[tipo];
                return (
                  <ToggleGroupItem key={tipo} value={tipo} className="gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    <itemMeta.icon className="h-4 w-4" />
                    {itemMeta.label}
                    <span className="ml-1 text-xs opacity-70">({counts[tipo]})</span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        {filtrados.length} alerta{filtrados.length === 1 ? "" : "s"} no periodo
      </div>

      {!filtrados.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum alerta com os filtros atuais.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((alerta, index) => {
            const itemMeta = meta[alerta.tipo];
            return (
              <Card key={index} className={`shadow-card border-l-4 ${itemMeta.cls}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <itemMeta.icon className="h-4 w-4" />
                      {itemMeta.label}
                    </CardTitle>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {alerta.competencia}
                    </span>
                  </div>
                  <CardDescription className="font-medium text-foreground text-sm truncate">
                    {alerta.prestador}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{alerta.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

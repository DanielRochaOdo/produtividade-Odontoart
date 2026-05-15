import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchCompetencias, fetchRegistros } from "@/lib/queries";
import { PAYMENT_SCOPE_OPTIONS, filterRegistrosByPaymentScope, type PaymentScope } from "@/lib/payment-type";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL, monthName } from "@/lib/excel/parser";
import { Trophy, Medal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rankings")({
  component: RankingsPage,
});

function RankingsPage() {
  const { data: comps = [] } = useQuery({ queryKey: ["competencias"], queryFn: fetchCompetencias });
  const [compId, setCompId] = useState("");
  const [paymentScope, setPaymentScope] = useState<PaymentScope>("all");
  const cur = compId || comps[0]?.id;
  const { data: regs = [] } = useQuery({
    queryKey: ["regs", cur],
    queryFn: () => fetchRegistros(cur),
    enabled: !!cur,
  });

  const ranking = useMemo(() => {
    const filteredRegs = filterRegistrosByPaymentScope(regs, paymentScope);
    const map = new Map<string, { valor: number; qtd: number; municipio?: string | null }>();
    for (const r of filteredRegs) {
      const k = r.prestador;
      const e = map.get(k) ?? { valor: 0, qtd: 0, municipio: r.municipio };
      e.valor += Number(r.valor_liquido);
      e.qtd += r.qtde_procedimentos;
      map.set(k, e);
    }
    return Array.from(map.entries())
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.valor - a.valor);
  }, [regs, paymentScope]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rankings</h1>
          <p className="text-muted-foreground text-sm mt-1">Maiores e menores produções</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={paymentScope} onValueChange={(value) => setPaymentScope(value as PaymentScope)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_SCOPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {comps.length > 0 && (
            <Select value={cur} onValueChange={setCompId}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {comps.map((c) => <SelectItem key={c.id} value={c.id}>{monthName(c.mes)}/{c.ano}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RankList title="Maior produção" icon={Trophy} items={ranking.slice(0, 10)} variant="top" />
        <RankList title="Menor produção" icon={Medal} items={[...ranking].reverse().slice(0, 10)} variant="bottom" />
      </div>
    </div>
  );
}

function RankList({
  title,
  icon: Icon,
  items,
  variant,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { nome: string; valor: number; qtd: number; municipio?: string | null }[];
  variant: "top" | "bottom";
}) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${variant === "top" ? "text-gold" : "text-muted-foreground"}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados</p>
        ) : (
          items.map((it, i) => (
            <div key={it.nome} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${i < 3 && variant === "top" ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground"}`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{it.nome}</p>
                <p className="text-xs text-muted-foreground">{it.qtd} atendimentos · {it.municipio ?? "—"}</p>
              </div>
              <p className="font-bold text-sm">{formatBRL(it.valor)}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  fetchAllRegistrosWithCompetencia,
  fetchCompetencias,
  type Competencia,
  type Registro,
} from "@/lib/queries";
import {
  PAYMENT_SCOPE_OPTIONS,
  filterRegistrosByPaymentScope,
  type PaymentScope,
} from "@/lib/payment-type";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Users,
  Building2,
  ArrowRight,
} from "lucide-react";
import { formatBRL, monthName } from "@/lib/excel/parser";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

type RegistroWithCompetencia = Registro & {
  competencia?: { mes: number; ano: number } | null;
};

function Dashboard() {
  const { data: comps = [] } = useQuery({ queryKey: ["competencias"], queryFn: fetchCompetencias });
  const { data: allRegs = [] } = useQuery({
    queryKey: ["regs-all-with-comp"],
    queryFn: fetchAllRegistrosWithCompetencia,
    enabled: comps.length > 0,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [paymentScope, setPaymentScope] = useState<PaymentScope>("all");

  const currentComp = selected
    ? comps.find((c) => c.id === selected)
    : comps[0];
  const previousComp = currentComp
    ? comps[comps.findIndex((c) => c.id === currentComp.id) + 1]
    : null;

  const registrosFiltrados = useMemo(
    () => filterRegistrosByPaymentScope(allRegs as RegistroWithCompetencia[], paymentScope),
    [allRegs, paymentScope],
  );
  const regCurrent = useMemo(
    () =>
      currentComp
        ? registrosFiltrados.filter((registro) => registro.competencia_id === currentComp.id)
        : [],
    [currentComp, registrosFiltrados],
  );
  const regPrev = useMemo(
    () =>
      previousComp
        ? registrosFiltrados.filter((registro) => registro.competencia_id === previousComp.id)
        : [],
    [previousComp, registrosFiltrados],
  );

  const kpis = useMemo(() => computeKpis(regCurrent, regPrev), [regCurrent, regPrev]);
  const topPrestadores = useMemo(() => topBy(regCurrent, "prestador", "valor_liquido", 10), [regCurrent]);
  const topMunicipios = useMemo(() => topBy(regCurrent, "municipio", "valor_liquido", 6), [regCurrent]);
  const evolucao = useMemo(
    () => buildEvolucao(comps, registrosFiltrados),
    [comps, registrosFiltrados],
  );
  const breakdown = useMemo(() => {
    const sum = (k: keyof Registro) => regCurrent.reduce((a, r) => a + Number(r[k] || 0), 0);
    return [
      { name: "Empresarial", value: sum("empresarial") },
      { name: "Individual", value: sum("individual") },
      { name: "Coletivo", value: sum("coletivo") },
      { name: "Ortodontia", value: sum("ortodontia") },
    ].filter((d) => d.value > 0);
  }, [regCurrent]);

  if (!comps.length) {
    return (
      <EmptyState
        title="Nenhuma competência importada ainda"
        description="Importe sua primeira planilha mensal para visualizar análises e indicadores."
        action={{ label: "Importar planilha", to: "/upload" }}
      />
    );
  }

  const COLORS = ["hsl(var(--primary))", "var(--gold)", "var(--chart-3)", "var(--chart-4)"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Gerencial</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão consolidada da produtividade odontológica
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={paymentScope} onValueChange={(value) => setPaymentScope(value as PaymentScope)}>
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
          <Select value={currentComp?.id} onValueChange={setSelected}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {comps.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {monthName(c.mes)}/{c.ano} — {c.registros_count} reg.
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label="Total Produzido"
          value={formatBRL(kpis.total)}
          delta={kpis.totalDelta}
        />
        <KpiCard
          icon={Activity}
          label="Atendimentos"
          value={kpis.qtdProc.toLocaleString("pt-BR")}
          delta={kpis.qtdDelta}
        />
        <KpiCard
          icon={Building2}
          label="Clínicas Ativas"
          value={kpis.clinicas.toString()}
          delta={null}
        />
        <KpiCard
          icon={Users}
          label="Ticket Médio"
          value={formatBRL(kpis.ticket)}
          delta={kpis.ticketDelta}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle>Evolução mensal</CardTitle>
            <CardDescription>Produção líquida por competência</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={3} dot={{ fill: "var(--gold)", r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Mix de procedimentos</CardTitle>
            <CardDescription>Distribuição por tipo</CardDescription>
          </CardHeader>
          <CardContent>
            {breakdown.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={breakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {breakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Top 10 clínicas / dentistas</CardTitle>
            <CardDescription>Por produção líquida</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={topPrestadores} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={150} stroke="var(--muted-foreground)" fontSize={10} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Top municípios</CardTitle>
            <CardDescription>Concentração geográfica</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={topMunicipios}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="value" fill="var(--gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta: number | null;
}) {
  return (
    <Card className="shadow-card overflow-hidden relative">
      <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-[var(--gradient-primary)] opacity-10 -translate-y-8 translate-x-8" />
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </span>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {delta !== null && (
          <div className="flex items-center gap-1 mt-2">
            {delta >= 0 ? (
              <TrendingUp className="h-3 w-3 text-success" />
            ) : (
              <TrendingDown className="h-3 w-3 text-destructive" />
            )}
            <span
              className={`text-xs font-medium ${
                delta >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">vs. mês anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: { label: string; to: string };
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center shadow-elegant">
        <CardContent className="pt-12 pb-10 px-8">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-[var(--gradient-primary)] flex items-center justify-center mb-4">
            <Activity className="h-8 w-8 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">{title}</h2>
          <p className="text-sm text-muted-foreground mb-6">{description}</p>
          <Link
            to={action.to}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            {action.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function computeKpis(curr: Registro[], prev: Registro[]) {
  const sum = (arr: Registro[], k: keyof Registro) =>
    arr.reduce((a, r) => a + Number(r[k] || 0), 0);
  const total = sum(curr, "valor_liquido");
  const totalPrev = sum(prev, "valor_liquido");
  const qtd = sum(curr, "qtde_procedimentos");
  const qtdPrev = sum(prev, "qtde_procedimentos");
  const ticket = qtd ? total / qtd : 0;
  const ticketPrev = qtdPrev ? totalPrev / qtdPrev : 0;
  const clinicas = new Set(curr.map((r) => r.cnpj || r.prestador)).size;
  const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);
  return {
    total,
    qtdProc: qtd,
    ticket,
    clinicas,
    totalDelta: pct(total, totalPrev),
    qtdDelta: pct(qtd, qtdPrev),
    ticketDelta: pct(ticket, ticketPrev),
  };
}

function topBy(regs: Registro[], key: keyof Registro, valKey: keyof Registro, n: number) {
  const map = new Map<string, number>();
  for (const r of regs) {
    const k = String(r[key] || "—");
    map.set(k, (map.get(k) || 0) + Number(r[valKey] || 0));
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name: name.length > 28 ? name.slice(0, 28) + "…" : name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

function buildEvolucao(comps: Competencia[], registros: Registro[]) {
  const totalsByCompetencia = new Map<string, number>();
  for (const registro of registros) {
    totalsByCompetencia.set(
      registro.competencia_id,
      (totalsByCompetencia.get(registro.competencia_id) ?? 0) + Number(registro.valor_liquido || 0),
    );
  }

  return [...comps]
    .reverse()
    .map((c) => ({
      label: `${monthName(c.mes)}/${String(c.ano).slice(2)}`,
      total: totalsByCompetencia.get(c.id) ?? 0,
    }));
}

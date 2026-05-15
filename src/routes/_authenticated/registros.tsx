import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchCompetencias, fetchRegistros, type Registro } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { formatBRL, monthName } from "@/lib/excel/parser";
import { PAYMENT_SCOPE_OPTIONS, filterRegistrosByPaymentScope, type PaymentScope } from "@/lib/payment-type";
import { normalizeText } from "@/lib/text-normalization";
import { Pencil, Search, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/registros")({
  component: RegistrosPage,
});

function RegistrosPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const { data: comps = [] } = useQuery({ queryKey: ["competencias"], queryFn: fetchCompetencias });
  const [compId, setCompId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [paymentScope, setPaymentScope] = useState<PaymentScope>("all");
  const [editing, setEditing] = useState<Registro | null>(null);

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["regs", compId],
    queryFn: () => fetchRegistros(compId || comps[0]?.id),
    enabled: comps.length > 0,
  });

  const filtered = useMemo(() => {
    const scoped = filterRegistrosByPaymentScope(registros, paymentScope);
    const s = normalizeText(search);
    if (!s) return scoped;
    return scoped.filter(
      (r) =>
        normalizeText(r.prestador).includes(s) ||
        normalizeText(r.cnpj).includes(s) ||
        normalizeText(r.municipio).includes(s)
    );
  }, [registros, paymentScope, search]);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registros");
    XLSX.writeFile(wb, `registros-${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Registros</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Edição individual de lançamentos
          </p>
        </div>
        <Button variant="outline" onClick={exportExcel} disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-2" /> Exportar Excel
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">Competência</Label>
            <Select value={compId || comps[0]?.id || ""} onValueChange={setCompId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {comps.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{monthName(c.mes)}/{c.ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo de pagamento</Label>
            <Select value={paymentScope} onValueChange={(value) => setPaymentScope(value as PaymentScope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input className="pl-9" placeholder="Prestador, CNPJ ou município..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left p-3">Prestador</th>
                <th className="text-left p-3">CNPJ</th>
                <th className="text-left p-3">Município/UF</th>
                <th className="text-right p-3">Procedimentos</th>
                <th className="text-right p-3">Líquido</th>
                <th className="text-right p-3">Qtd</th>
                {isAdmin && <th className="w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
              ) : !filtered.length ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum registro</td></tr>
              ) : (
                filtered.slice(0, 500).map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium max-w-[260px] truncate">{r.prestador}</td>
                    <td className="p-3 text-muted-foreground text-xs">{r.cnpj}</td>
                    <td className="p-3 text-xs">{r.municipio}/{r.uf}</td>
                    <td className="p-3 text-right">{formatBRL(Number(r.valor_procedimentos))}</td>
                    <td className="p-3 text-right font-semibold">{formatBRL(Number(r.valor_liquido))}</td>
                    <td className="p-3 text-right">{r.qtde_procedimentos}</td>
                    {isAdmin && (
                      <td className="p-3">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {filtered.length > 500 && (
            <p className="text-xs text-muted-foreground text-center py-2 border-t">
              Mostrando 500 de {filtered.length} registros — refine a busca para ver mais
            </p>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditDialog
          registro={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries();
            setEditing(null);
          }}
          userId={user?.id ?? null}
        />
      )}
    </div>
  );
}

function EditDialog({
  registro,
  onClose,
  onSaved,
  userId,
}: {
  registro: Registro;
  onClose: () => void;
  onSaved: () => void;
  userId: string | null;
}) {
  const [form, setForm] = useState({
    prestador: registro.prestador,
    cnpj: registro.cnpj ?? "",
    valor_procedimentos: registro.valor_procedimentos,
    valor_liquido: registro.valor_liquido,
    qtde_procedimentos: registro.qtde_procedimentos,
    municipio: registro.municipio ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const changes: { campo: string; antigo: string; novo: string }[] = [];
      for (const k of Object.keys(form) as (keyof typeof form)[]) {
        const old = (registro as unknown as Record<string, unknown>)[k];
        const nv = form[k];
        if (String(old ?? "") !== String(nv ?? "")) {
          changes.push({ campo: k, antigo: String(old ?? ""), novo: String(nv ?? "") });
        }
      }
      const { error } = await supabase.from("registros").update(form).eq("id", registro.id);
      if (error) throw error;
      if (userId && changes.length) {
        await supabase.from("audit_log").insert(
          changes.map((c) => ({
            registro_id: registro.id,
            user_id: userId,
            campo: c.campo,
            valor_anterior: c.antigo,
            valor_novo: c.novo,
          }))
        );
      }
      toast.success("Registro atualizado");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar registro</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Prestador</Label>
            <Input value={form.prestador} onChange={(e) => setForm({ ...form, prestador: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Município</Label>
              <Input value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Procedimentos R$</Label>
              <Input type="number" step="0.01" value={form.valor_procedimentos} onChange={(e) => setForm({ ...form, valor_procedimentos: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Líquido R$</Label>
              <Input type="number" step="0.01" value={form.valor_liquido} onChange={(e) => setForm({ ...form, valor_liquido: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Qtd</Label>
              <Input type="number" value={form.qtde_procedimentos} onChange={(e) => setForm({ ...form, qtde_procedimentos: Number(e.target.value) })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

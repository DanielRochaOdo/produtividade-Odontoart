import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { parseExcel, type ParseResult, formatBRL, monthName } from "@/lib/excel/parser";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/upload")({
  component: UploadPage,
});

function UploadPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [overrideMes, setOverrideMes] = useState<number>(0);
  const [overrideAno, setOverrideAno] = useState<number>(0);

  if (!isAdmin) return <Navigate to="/" />;

  const handleFile = async (f: File) => {
    setFile(f);
    setParsed(null);
    setParsing(true);
    try {
      const result = await parseExcel(f);
      setParsed(result);
      if (result.competencia) {
        setOverrideMes(result.competencia.mes);
        setOverrideAno(result.competencia.ano);
      }
    } catch (e) {
      toast.error("Falha ao ler planilha: " + (e as Error).message);
    }
    setParsing(false);
  };

  const handleImport = async () => {
    if (!parsed || !overrideMes || !overrideAno || !user) return;
    setImporting(true);
    setProgress(5);

    try {
      // Verifica/cria competência
      const { data: existing } = await supabase
        .from("competencias")
        .select("id")
        .eq("mes", overrideMes)
        .eq("ano", overrideAno)
        .maybeSingle();

      let compId: string | undefined = existing?.id;
      if (existing) {
        if (!confirm(`Competência ${monthName(overrideMes)}/${overrideAno} já existe. Sobrescrever?`)) {
          setImporting(false);
          return;
        }
        await supabase.from("registros").delete().eq("competencia_id", existing.id);
      } else {
        const { data: nc, error } = await supabase
          .from("competencias")
          .insert({
            mes: overrideMes,
            ano: overrideAno,
            arquivo_nome: file?.name ?? null,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        compId = nc.id;
      }

      setProgress(20);

      // Insere em chunks de 200
      const total = parsed.registros.length;
      if (!compId) throw new Error("Falha ao obter competência");
      const chunkSize = 200;
      let valorTotal = 0;
      for (let i = 0; i < total; i += chunkSize) {
        const slice = parsed.registros.slice(i, i + chunkSize).map((r) => ({
          ...r,
          competencia_id: compId as string,
        }));
        valorTotal += slice.reduce((a, r) => a + r.valor_liquido, 0);
        const { error } = await supabase.from("registros").insert(slice);
        if (error) throw error;
        setProgress(20 + Math.round(((i + chunkSize) / total) * 75));
      }

      await supabase
        .from("competencias")
        .update({ registros_count: total, valor_total: valorTotal })
        .eq("id", compId!);

      setProgress(100);
      toast.success(`${total} registros importados com sucesso!`);
      qc.invalidateQueries();
      setFile(null);
      setParsed(null);
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    } finally {
      setImporting(false);
      setTimeout(() => setProgress(0), 1500);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importar Planilha</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Faça upload do arquivo Excel mensal de produtividade.
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Arquivo .xlsx</CardTitle>
          <CardDescription>Formato padrão NF para pagamento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            htmlFor="file-input"
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-xl p-12 cursor-pointer hover:border-primary hover:bg-primary/5 transition"
          >
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium">
                {file ? file.name : "Clique para selecionar a planilha"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Formatos: .xlsx, .xls — máx. 20MB
              </p>
            </div>
            <Input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>

          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lendo planilha...
            </div>
          )}
        </CardContent>
      </Card>

      {parsed && (
        <Card className="shadow-card border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Pré-visualização
            </CardTitle>
            <CardDescription>
              {parsed.registros.length} registros prontos para importação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Linhas lidas" value={parsed.totalLinhas.toString()} />
              <Stat label="Registros válidos" value={parsed.registros.length.toString()} />
              <Stat
                label="Valor total líquido"
                value={formatBRL(parsed.registros.reduce((a, r) => a + r.valor_liquido, 0))}
              />
              <Stat
                label="Atendimentos"
                value={parsed.registros.reduce((a, r) => a + r.qtde_procedimentos, 0).toLocaleString("pt-BR")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mês da competência</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={overrideMes || ""}
                  onChange={(e) => setOverrideMes(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ano da competência</Label>
                <Input
                  type="number"
                  min={2000}
                  max={2100}
                  value={overrideAno || ""}
                  onChange={(e) => setOverrideAno(Number(e.target.value))}
                />
              </div>
            </div>

            {parsed.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{parsed.errors.length} avisos</AlertTitle>
                <AlertDescription>
                  <ul className="text-xs mt-1 max-h-24 overflow-auto">
                    {parsed.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Prestador</th>
                    <th className="text-left p-2">CNPJ</th>
                    <th className="text-right p-2">Procedimentos</th>
                    <th className="text-right p-2">Líquido</th>
                    <th className="text-right p-2">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.registros.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 max-w-[260px] truncate">{r.prestador}</td>
                      <td className="p-2 text-muted-foreground">{r.cnpj}</td>
                      <td className="p-2 text-right">{formatBRL(r.valor_procedimentos)}</td>
                      <td className="p-2 text-right font-medium">{formatBRL(r.valor_liquido)}</td>
                      <td className="p-2 text-right">{r.qtde_procedimentos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.registros.length > 5 && (
                <p className="text-xs text-muted-foreground text-center py-2 border-t">
                  + {parsed.registros.length - 5} registros
                </p>
              )}
            </div>

            {progress > 0 && <Progress value={progress} className="h-2" />}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setParsed(null);
                  setFile(null);
                }}
                disabled={importing}
              >
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={importing || !overrideMes || !overrideAno}>
                {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmar importação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
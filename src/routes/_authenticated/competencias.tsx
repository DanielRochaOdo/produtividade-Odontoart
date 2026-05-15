import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCompetencias } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatBRL, monthName } from "@/lib/excel/parser";
import { Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/competencias")({
  component: CompetenciasPage,
});

function CompetenciasPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: comps = [] } = useQuery({ queryKey: ["competencias"], queryFn: fetchCompetencias });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("competencias").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Competência excluída");
      qc.invalidateQueries();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Competências</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Histórico de importações mensais
        </p>
      </div>

      {!comps.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma competência importada.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {comps.map((c) => (
            <Card key={c.id} className="shadow-card hover:shadow-elegant transition">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {monthName(c.mes)} / {c.ano}
                  </CardTitle>
                  <CardDescription>
                    Importado em {format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}
                  </CardDescription>
                </div>
                <Badge variant="secondary">{c.registros_count} reg.</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Valor total líquido</p>
                  <p className="text-2xl font-bold text-primary">{formatBRL(Number(c.valor_total))}</p>
                </div>
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir competência
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir competência?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Todos os {c.registros_count} registros de {monthName(c.mes)}/{c.ano} serão removidos. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(c.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
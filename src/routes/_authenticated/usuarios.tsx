import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsuariosPage,
});

interface Row {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
}

function UsuariosPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();

  const { data = [] } = useQuery<Row[]>({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, email, created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profs ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        created_at: p.created_at,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      }));
    },
  });

  if (!isAdmin) return <Navigate to="/" />;

  const toggleAdmin = async (uid: string, makeAdmin: boolean) => {
    if (uid === user?.id && !makeAdmin) {
      toast.error("Você não pode remover seu próprio acesso de administrador.");
      return;
    }
    if (makeAdmin) {
      await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    } else {
      await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
    }
    qc.invalidateQueries({ queryKey: ["usuarios"] });
    toast.success("Permissão atualizada");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerenciar permissões de acesso</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadastrados ({data.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.map((u) => {
            const isAdminUser = u.roles.includes("admin");
            return (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-md border bg-card">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center ${isAdminUser ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground"}`}>
                    {isAdminUser ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.email}</p>
                    <div className="flex gap-1 mt-0.5">
                      {u.roles.map((r) => (
                        <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-[10px]">{r}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAdmin(u.id, !isAdminUser)}
                >
                  {isAdminUser ? "Remover admin" : "Tornar admin"}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
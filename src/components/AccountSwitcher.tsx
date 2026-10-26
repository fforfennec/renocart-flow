import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Space = "client" | "admin" | "supplier";
const LABEL: Record<Space, string> = { client: "Espace client", admin: "Espace admin", supplier: "Espace fournisseur" };
const PATH: Record<Space, string> = { client: "/projets", admin: "/admin", supplier: "/supplier" };

/** Lists the account spaces the signed-in user may open. Access itself stays enforced by each portal's guard. */
export function useAccountSpaces(): Space[] {
  const { user } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  useEffect(() => {
    if (!user) { setSpaces([]); return; }
    let live = true;
    Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("staff_accounts").select("status").eq("user_id", user.id).maybeSingle(),
    ]).then(([{ data: roles }, { data: staff }]) => {
      if (!live) return;
      const list = (roles ?? []).map((r) => r.role as string);
      const active = !staff || staff.status === "active";
      const s: Space[] = ["client"];
      if (active && list.includes("admin")) s.push("admin");
      if (active && (list.includes("supplier") || list.includes("partner"))) s.push("supplier");
      setSpaces(s);
    });
    return () => { live = false; };
  }, [user]);
  return spaces;
}

export function AccountSwitcher({ current, className }: { current: Space; className?: string }) {
  const spaces = useAccountSpaces();
  const navigate = useNavigate();
  if (spaces.length < 2) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("h-11 font-bold", className)}><ArrowLeftRight className="h-4 w-4 mr-2" />Changer de compte</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Type de compte</DropdownMenuLabel>
        {spaces.map((s) => (
          <DropdownMenuItem key={s} disabled={s === current} onSelect={() => navigate(PATH[s])}>
            {LABEL[s]}{s === current && " (actuel)"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

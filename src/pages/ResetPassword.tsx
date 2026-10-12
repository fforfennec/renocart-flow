import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ResetPassword() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Mot de passe changé."); nav("/projets");
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-card rounded-2xl p-6 shadow-soft space-y-4">
        <h1 className="text-2xl font-black">Nouveau mot de passe</h1>
        <div className="space-y-1.5"><Label htmlFor="np">Mot de passe</Label><Input id="np" type="password" minLength={8} required className="h-11" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button className="w-full h-12 font-bold" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}</Button>
      </form>
    </div>
  );
}

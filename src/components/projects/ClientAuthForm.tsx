import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function ClientAuthForm({ redirectPath = "/projets" }: { redirectPath?: string }) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${redirectPath}`, data: { full_name: name } } });
        if (error) throw error;
        setSent("Vérifie tes courriels : clique sur le lien de confirmation pour activer ton compte.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent("Si ce courriel existe, tu vas recevoir un lien pour choisir un nouveau mot de passe.");
      }
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  if (sent) return <div className="text-center space-y-4"><p>{sent}</p><Button variant="ghost" onClick={() => { setSent(null); setMode("login"); }}>Retour à la connexion</Button></div>;

  return (
    <form onSubmit={submit} className="space-y-3 text-left">
      <p className="text-sm text-muted-foreground">Utilise le même courriel que pour tes commandes : tes factures s'y retrouvent automatiquement.</p>
      {mode === "signup" && <div className="space-y-1.5"><Label htmlFor="ca-name">Nom</Label><Input id="ca-name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} required /></div>}
      <div className="space-y-1.5"><Label htmlFor="ca-email">Courriel</Label><Input id="ca-email" type="email" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
      {mode !== "forgot" && <div className="space-y-1.5"><Label htmlFor="ca-pw">Mot de passe</Label><Input id="ca-pw" type="password" minLength={8} className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></div>}
      <Button type="submit" className="w-full h-12 font-bold" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Envoyer le lien"}
      </Button>
      <div className="flex justify-between text-sm">
        {mode === "login" ? <>
          <button type="button" className="font-semibold text-secondary hover:underline" onClick={() => setMode("signup")}>Créer un compte</button>
          <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMode("forgot")}>Mot de passe oublié ?</button>
        </> : <button type="button" className="font-semibold text-secondary hover:underline" onClick={() => setMode("login")}>J'ai déjà un compte</button>}
      </div>
    </form>
  );
}

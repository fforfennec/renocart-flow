import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup" | "forgot";

const L = {
  fr: {
    signup: "Créer un profil",
    login: "J'ai déjà un compte",
    hint: "Utilise le même courriel que pour tes commandes : tes factures s'y retrouvent automatiquement.",
    google: "Continuer avec Google",
    or: "ou avec courriel",
    name: "Nom",
    email: "Courriel",
    password: "Mot de passe",
    send: "Créer mon profil",
    signIn: "Se connecter",
    sendLink: "Envoyer le lien",
    forgot: "Mot de passe oublié ?",
    back: "Retour",
    sentSignup: "Ton profil est presque prêt : vérifie tes courriels et clique sur le lien pour l'activer.",
    sentForgot: "Si ce courriel existe, tu vas recevoir un lien pour choisir un nouveau mot de passe.",
  },
  en: {
    signup: "Create a profile",
    login: "I already have an account",
    hint: "Use the same email as your orders: your invoices are linked automatically.",
    google: "Continue with Google",
    or: "or with email",
    name: "Name",
    email: "Email",
    password: "Password",
    send: "Create my profile",
    signIn: "Sign in",
    sendLink: "Send the link",
    forgot: "Forgot your password?",
    back: "Back",
    sentSignup: "Your profile is almost ready: check your email and click the link to activate it.",
    sentForgot: "If this email exists, you'll get a link to choose a new password.",
  },
};

export function ClientAuthForm({ redirectPath = "/projets", initialMode = "login", lang = "fr" }: {
  redirectPath?: string; initialMode?: "login" | "signup"; lang?: "fr" | "en";
}) {
  const t = L[lang];
  const [mode, setMode] = useState<Mode>(initialMode);
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
        setSent(t.sentSignup);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent(t.sentForgot);
      }
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  if (sent) return <div className="text-center space-y-4"><p>{sent}</p><Button variant="ghost" onClick={() => { setSent(null); setMode("login"); }}>{t.back}</Button></div>;

  const googleSignIn = async () => {
    setBusy(true);
    try {
      sessionStorage.setItem("client-auth-redirect", redirectPath);
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) toast.error(result.error.message ?? "Connexion Google impossible.");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-3 text-left">
      <div className="flex gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label={lang === "fr" ? "Accès au profil" : "Profile access"}>
        {(["signup", "login"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m}
            onClick={() => { setMode(m); setSent(null); }}
            className={cn("min-h-10 flex-1 rounded-lg px-3 text-sm font-bold transition-colors",
              mode === m ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t[m]}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{t.hint}</p>
      <Button type="button" variant="outline" className="w-full h-12 font-semibold gap-2" disabled={busy} onClick={googleSignIn}>
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c1 .7 2.4 1.2 4.2 1.2-3.2 0-5.9-2.1-6.8-5.1l-3.9 3C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.2 14.3c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.3l3.9-3z"/><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.7l3.9 3c.9-2.9 3.6-5 6.8-5z"/></svg>
        {t.google}
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />{t.or}<span className="h-px flex-1 bg-border" /></div>
      {mode === "signup" && <div className="space-y-1.5"><Label htmlFor="ca-name">{t.name}</Label><Input id="ca-name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} required /></div>}
      <div className="space-y-1.5"><Label htmlFor="ca-email">{t.email}</Label><Input id="ca-email" type="email" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
      {mode !== "forgot" && <div className="space-y-1.5"><Label htmlFor="ca-pw">{t.password}</Label><Input id="ca-pw" type="password" minLength={8} className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></div>}
      <Button type="submit" className="w-full h-12 font-bold" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? t.signIn : mode === "signup" ? t.send : t.sendLink}
      </Button>
      <div className="flex justify-between text-sm">
        {mode === "login" ? <>
          <button type="button" className="font-semibold text-secondary hover:underline" onClick={() => setMode("signup")}>{t.signup}</button>
          <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMode("forgot")}>{t.forgot}</button>
        </> : <button type="button" className="font-semibold text-secondary hover:underline" onClick={() => setMode("login")}>{t.login}</button>}
      </div>
    </form>
  );
}

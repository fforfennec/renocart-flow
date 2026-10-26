import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Shield, Truck, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ClientHeader } from "@/portals/client/components/ClientHeader";
import { ClientAuthForm } from "@/portals/client/components/projects/ClientAuthForm";

const CHOICES = [
  { id: "client", label: "Client", desc: "Commandes, projets et factures", icon: User },
  { id: "admin", label: "Admin", desc: "Équipe RenoCart", icon: Shield },
  { id: "supplier", label: "Fournisseur", desc: "Matériaux et livraison", icon: Truck },
] as const;

export default function Connexion() {
  const { user, loading } = useAuth();
  const [client, setClient] = useState(false);
  useEffect(() => { document.title = "RenoCart — Connexion"; }, []);
  if (!loading && user) return <Navigate to="/projets" replace />;
  const cls = "w-full flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-muted";
  return (
    <div className="min-h-screen bg-background">
      <ClientHeader />
      <main className="max-w-md mx-auto px-4 py-12">
        <h1 className="text-3xl font-black tracking-tight mb-6">Connexion</h1>
        <div className="bg-card rounded-2xl p-6 shadow-soft">
          {client ? <>
            <button type="button" onClick={() => setClient(false)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Changer de type de compte</button>
            <ClientAuthForm initialMode="login" />
          </> : <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Choisissez votre type de compte.</p>
            {CHOICES.map((c) => {
              const inner = <><div className="h-11 w-11 rounded-lg bg-secondary flex items-center justify-center"><c.icon className="h-5 w-5 text-primary" /></div><div><p className="font-bold">{c.label}</p><p className="text-xs text-muted-foreground">{c.desc}</p></div></>;
              return c.id === "client"
                ? <button key={c.id} type="button" className={cls} onClick={() => setClient(true)}>{inner}</button>
                : <Link key={c.id} to={`/equipe?portal=${c.id}`} className={cls}>{inner}</Link>;
            })}
          </div>}
        </div>
      </main>
    </div>
  );
}

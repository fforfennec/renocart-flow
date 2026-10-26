import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ClientHeader } from "@/portals/client/components/ClientHeader";
import { ClientAuthForm } from "@/portals/client/components/projects/ClientAuthForm";

export default function Connexion() {
  const { user, loading } = useAuth();
  useEffect(() => { document.title = "RenoCart — Connexion"; }, []);
  if (!loading && user) return <Navigate to="/projets" replace />;
  return (
    <div className="min-h-screen bg-background">
      <ClientHeader />
      <main className="max-w-md mx-auto px-4 py-12">
        <h1 className="text-3xl font-black tracking-tight mb-6">Connexion</h1>
        <div className="bg-card rounded-2xl p-6 shadow-soft"><ClientAuthForm initialMode="login" /></div>
      </main>
    </div>
  );
}

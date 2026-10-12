import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Search, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAdminClients, type AdminClient } from "@/portals/team/lib/adminClients";
import { money } from "@/lib/clientProjects";
import Projets from "@/portals/client/pages/Projets";

export default function Clients() {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [selected, setSelected] = useState<AdminClient | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const load = () => {
    setBusy(true); setError("");
    listAdminClients().then((data) => setClients(data.clients)).catch((e) => setError(e.message)).finally(() => setBusy(false));
  };
  useEffect(load, []);
  if (selected) return <div><div className="px-6 pt-4 flex flex-wrap justify-between gap-2"><Button variant="ghost" onClick={() => { setSelected(null); load(); }}><ArrowLeft />Profils clients</Button><Button variant="outline" asChild><Link to="/commander"><ShoppingCart />Page de commande</Link></Button></div><Projets key={selected.id} adminClient={selected} /></div>;
  const filtered = clients.filter((c) => `${c.name} ${c.email} ${c.company}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="p-6 md:p-8 space-y-6">
    <div><h1 className="text-2xl font-bold">Profils clients</h1><p className="text-muted-foreground mt-1">{clients.length} client(s)</p></div>
    <div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-10" aria-label="Rechercher un client" placeholder="Rechercher un nom, un courriel ou une compagnie" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
    {busy ? <Loader2 className="animate-spin h-6 w-6" /> : error ? <div role="alert" className="space-y-3"><p className="text-destructive">{error}</p><Button variant="outline" onClick={load}>Réessayer</Button></div> : <div className="overflow-x-auto border rounded-lg bg-card"><table className="w-full text-sm text-left"><thead className="border-b bg-muted/50"><tr>{["Client", "Projets", "Commandes", "Dépenses", ""].map((label) => <th key={label} className="p-4 font-semibold">{label}</th>)}</tr></thead><tbody>{filtered.map((c) => <tr key={c.id} className="border-b last:border-0"><td className="p-4"><Button variant="link" className="p-0 h-auto text-foreground font-semibold" onClick={() => setSelected(c)}>{c.name}</Button><p className="text-muted-foreground mt-1">{c.email}</p>{c.company && <p className="text-muted-foreground">{c.company}</p>}</td><td className="p-4">{c.projects}</td><td className="p-4">{c.orders}</td><td className="p-4 whitespace-nowrap font-semibold">{money(c.spent)}</td><td className="p-4"><Button variant="outline" onClick={() => setSelected(c)}>Ouvrir le profil</Button></td></tr>)}</tbody></table>{!filtered.length && <p className="p-6 text-muted-foreground">Aucun client trouvé.</p>}</div>}
  </div>;
}
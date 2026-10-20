import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inviteMember, listMembers, listProjectMemberIds, setProjectMember, updateMember, ROLE_LABEL, type AccountRole, type ClientMember } from "@/lib/clientProjects";

type SubRole = ClientMember["role"];
const ROLES: SubRole[] = ["super_admin", "project_manager", "employee"];
const ROLE_HINT: Record<SubRole, string> = {
  super_admin: "Mêmes permissions que le compte principal.",
  project_manager: "Voit et commande pour ses projets assignés. Ne crée pas de projets.",
  employee: "Voit ses projets assignés, sans commander.",
};

/** Sub-account management: invite, change role, remove. Owner and super admins only. */
export function AccountTeam({ selfMemberId }: { selfMemberId: string | null }) {
  const [members, setMembers] = useState<ClientMember[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<SubRole>("employee");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => listMembers().then(setMembers).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await inviteMember(email, role);
      toast.success(r.emailed ? `Invitation envoyée à ${email}.` : `Accès ajouté pour ${email}. Le courriel n'a pas pu partir : préviens la personne.`);
      setEmail(""); load();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  const change = async (m: ClientMember, r: SubRole | null) => {
    if (r === null && !confirm(`Retirer ${m.email} du compte ?`)) return;
    try { await updateMember(m.id, r); toast.success(r ? "Rôle modifié." : "Accès retiré."); load(); }
    catch (err) { toast.error((err as Error).message); }
  };

  return (
    <section className="bg-card rounded-2xl shadow-soft border mt-8">
      <h2 className="p-4 border-b font-bold flex items-center gap-2"><Users className="h-5 w-5" />Équipe du compte</h2>
      <form onSubmit={invite} className="p-4 border-b flex flex-wrap gap-2 items-start">
        <Input type="email" required placeholder="courriel@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 flex-1 min-w-[200px]" aria-label="Courriel" />
        <Select value={role} onValueChange={(v) => setRole(v as SubRole)}>
          <SelectTrigger className="h-11 w-56" aria-label="Rôle"><SelectValue /></SelectTrigger>
          <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
        </Select>
        <Button className="h-11 font-bold" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4 mr-2" />Inviter</>}</Button>
        <p className="basis-full text-xs text-muted-foreground">{ROLE_HINT[role]}</p>
      </form>
      {!members ? <Loader2 className="h-5 w-5 animate-spin m-6" /> : !members.length ? <p className="p-6 text-sm text-muted-foreground">Aucun sous-compte pour l'instant.</p> : (
        <ul>{members.map((m) => (
          <li key={m.id} className="p-4 border-b last:border-0 flex flex-wrap items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-[160px]">
              <p className="font-semibold break-all">{m.email}</p>
              <p className="text-xs text-muted-foreground">{m.status === "invited" ? "Invitation envoyée" : "Actif"}</p>
            </div>
            {m.id === selfMemberId ? <span className="text-sm font-semibold">{ROLE_LABEL[m.role]} (vous)</span> : <>
              <Select value={m.role} onValueChange={(v) => change(m, v as SubRole)}>
                <SelectTrigger className="h-11 w-56" aria-label={`Rôle de ${m.email}`}><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-11 w-11" aria-label={`Retirer ${m.email}`} onClick={() => change(m, null)}><Trash2 className="h-4 w-4" /></Button>
            </>}
          </li>
        ))}</ul>
      )}
    </section>
  );
}

/** Who is assigned to one project. Owner/super admin assign anyone; project managers assign employees only. */
export function ProjectMembers({ projectId, role, selfMemberId }: { projectId: string; role: AccountRole; selfMemberId: string | null }) {
  const [members, setMembers] = useState<ClientMember[] | null>(null);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const load = useCallback(async () => {
    try {
      const [m, ids] = await Promise.all([listMembers(), listProjectMemberIds(projectId)]);
      setMembers(m.filter((x) => x.role !== "super_admin")); setAssigned(new Set(ids));
    } catch (e) { toast.error((e as Error).message); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  const canEdit = (m: ClientMember) => m.id !== selfMemberId && (role === "owner" || role === "super_admin" || (role === "project_manager" && m.role === "employee"));
  const toggle = async (m: ClientMember, on: boolean) => {
    try { await setProjectMember(projectId, m.id, on); setAssigned((s) => { const n = new Set(s); on ? n.add(m.id) : n.delete(m.id); return n; }); }
    catch (e) { toast.error((e as Error).message); }
  };
  if (members && !members.length) return null;
  return (
    <section className="bg-card rounded-2xl shadow-soft border self-start mt-6">
      <h2 className="p-4 border-b font-bold flex items-center gap-2"><Users className="h-5 w-5" />Membres du projet</h2>
      {!members ? <Loader2 className="h-5 w-5 animate-spin m-6" /> : (
        <ul>{members.map((m) => (
          <li key={m.id} className="px-4 border-b last:border-0">
            <label className="flex items-center gap-3 min-h-11 py-2">
              <Checkbox checked={assigned.has(m.id)} disabled={!canEdit(m)} onCheckedChange={(v) => toggle(m, v === true)} aria-label={`Assigner ${m.email}`} />
              <span className="flex-1 min-w-0 text-sm break-all">{m.email}</span>
              <span className="text-xs text-muted-foreground shrink-0">{ROLE_LABEL[m.role]}</span>
            </label>
          </li>
        ))}</ul>
      )}
    </section>
  );
}

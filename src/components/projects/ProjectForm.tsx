import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { emptyProject, saveProject, type ClientProject, type ProjectInput } from "@/lib/clientProjects";

export function ProjectForm({ project, onSaved, onCancel, compact }: { project?: ClientProject; onSaved: (p: ClientProject) => void; onCancel?: () => void; compact?: boolean }) {
  const [v, setV] = useState<ProjectInput>(project ? { ...emptyProject, ...Object.fromEntries(Object.keys(emptyProject).map((k) => [k, (project as never)[k] ?? ""])) } as ProjectInput : emptyProject);
  const [saving, setSaving] = useState(false);
  const f = (k: keyof ProjectInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`pf-${k}`}>{label}</Label>
      <Input id={`pf-${k}`} value={v[k] ?? ""} onChange={(e) => setV((p) => ({ ...p, [k]: e.target.value }))} className="h-11" {...props} />
    </div>
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { onSaved(await saveProject(v, project?.id)); } catch (err) { toast.error((err as Error).message); } finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3 text-left">
      <div className="grid sm:grid-cols-2 gap-3">
        {f("name", "Nom du projet *", { required: true, maxLength: 120, placeholder: "Ex. Duplex rue Fullum" })}
        {f("code", "Code de projet *", { required: true, maxLength: 40, placeholder: "Ex. FUL-2026" })}
      </div>
      {f("address1", "Adresse de livraison", { placeholder: "1234 rue Fullum" })}
      <div className="grid grid-cols-3 gap-3">
        {f("city", "Ville", { placeholder: "Montréal" })}
        {f("province", "Province", { maxLength: 2 })}
        {f("postal_code", "Code postal", { placeholder: "H2K 3L1" })}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {f("contact_name", "Contact du projet", { placeholder: "Nom et prénom" })}
        {f("contact_phone", "Téléphone du contact", { type: "tel" })}
      </div>
      {!compact && (
        <div className="space-y-1.5">
          <Label htmlFor="pf-notes">Notes</Label>
          <Textarea id="pf-notes" value={v.notes ?? ""} onChange={(e) => setV((p) => ({ ...p, notes: e.target.value }))} />
        </div>
      )}
      <div className="flex gap-2 justify-end pt-1">
        {onCancel && <Button type="button" variant="ghost" className="h-11" onClick={onCancel}>Annuler</Button>}
        <Button type="submit" className="h-11 font-bold" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : project ? "Enregistrer" : "Créer le projet"}</Button>
      </div>
    </form>
  );
}

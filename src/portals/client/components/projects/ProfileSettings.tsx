import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function ProfileSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase.from("profiles").select("full_name, phone, company_name").eq("user_id", user.id).maybeSingle();
      if (error) toast.error(error.message);
      setFullName(data?.full_name ?? (user.user_metadata?.full_name as string) ?? "");
      setPhone(data?.phone ?? "");
      setCompany(data?.company_name ?? "");
      setLoading(false);
    })();
  }, [open, user]);

  const save = async () => {
    if (!user || !fullName.trim()) { toast.error("Le nom est requis."); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert(
      { user_id: user.id, full_name: fullName.trim(), phone: phone.trim() || null, company_name: company.trim() || null },
      { onConflict: "user_id" },
    );
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Profil enregistré."); onClose(); }
  };

  const changePassword = async () => {
    if (pw.length < 6) { toast.error("Le mot de passe doit faire au moins 6 caractères."); return; }
    if (pw !== pw2) { toast.error("Les deux mots de passe ne correspondent pas."); return; }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Mot de passe modifié."); setPw(""); setPw2(""); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mon profil</DialogTitle></DialogHeader>
        {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" /> : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pf-email">Courriel</Label>
              <Input id="pf-email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-name">Nom complet</Label>
              <Input id="pf-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-phone">Téléphone</Label>
              <Input id="pf-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-company">Entreprise (optionnel)</Label>
              <Input id="pf-company" value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" />
            </div>
            <Button className="w-full h-11 font-bold" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer
            </Button>
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-bold">Changer le mot de passe</p>
              <div className="space-y-1.5">
                <Label htmlFor="pf-pw">Nouveau mot de passe</Label>
                <Input id="pf-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-pw2">Confirmer le mot de passe</Label>
                <Input id="pf-pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
              </div>
              <Button variant="outline" className="w-full h-11 font-bold" onClick={changePassword} disabled={pwBusy || !pw}>
                {pwBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Modifier le mot de passe
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

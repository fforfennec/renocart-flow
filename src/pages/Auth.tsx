import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Truck, Handshake, ArrowLeft, Clock } from 'lucide-react';

type Portal = 'admin' | 'supplier' | 'partner';
const PORTALS: { id: Portal; label: string; icon: typeof Shield; desc: string }[] = [
  { id: 'admin', label: 'Admin', icon: Shield, desc: 'Équipe RenoCart' },
  { id: 'supplier', label: 'Fournisseur', icon: Truck, desc: 'Matériaux et livraison' },
  { id: 'partner', label: 'Partenaire', icon: Handshake, desc: 'Partenaire RenoCart' },
];

const Auth = () => {
  const [portal, setPortal] = useState<Portal | null>(null);
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const banned = /banned/i.test(error.message);
      throw new Error(banned ? 'Ce compte est suspendu. Contacte admin@renocart.ca.' : 'Courriel ou mot de passe invalide.');
    }
    const uid = data.user.id;
    const [{ data: staff }, { data: roles }] = await Promise.all([
      supabase.from('staff_accounts').select('status').eq('user_id', uid).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', uid),
    ]);
    const list = (roles ?? []).map((r) => r.role as string);
    if (staff && staff.status !== 'active') {
      await supabase.auth.signOut();
      setPendingMsg(staff.status === 'pending'
        ? "Ton compte est en attente d'approbation par RenoCart. Tu recevras l'accès dès qu'il sera approuvé."
        : "Ce compte n'a pas accès au portail. Contacte admin@renocart.ca.");
      return;
    }
    if (list.includes('admin')) navigate('/admin');
    else if (list.includes('supplier') || list.includes('partner')) navigate('/supplier');
    else {
      await supabase.auth.signOut();
      setPendingMsg("Ce compte n'a pas accès au portail. Contacte admin@renocart.ca.");
    }
  };

  const handleSignup = async () => {
    if (password.length < 8) throw new Error('Le mot de passe doit avoir au moins 8 caractères.');
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: fullName.trim(), company_name: company.trim(), staff_role: portal },
      },
    });
    if (error) throw error;
    await supabase.functions.invoke('staff-access', { body: { action: 'notify', email } }).catch(() => {});
    await supabase.auth.signOut();
    setPendingMsg("Demande envoyée. Confirme ton courriel, puis RenoCart approuvera ton accès. Tu pourras ensuite te connecter.");
  };

  const handleForgot = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    setPendingMsg(`Lien de réinitialisation envoyé à ${email}. Ouvre le courriel et suis le lien pour choisir un nouveau mot de passe.`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') await handleLogin(); else if (mode === 'forgot') await handleForgot(); else await handleSignup();
    } catch (err: any) {
      toast({ title: mode === 'login' ? 'Connexion impossible' : mode === 'forgot' ? 'Envoi impossible' : 'Inscription impossible', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const current = PORTALS.find((p) => p.id === portal);

  return (
    <div className="min-h-screen flex items-center justify-center bg-rc-beige p-4">
      <Card className="w-full max-w-md shadow-soft">
        <CardHeader className="space-y-3 text-center">
          <div className="w-20 h-20 mx-auto bg-rc-navy rounded-lg flex items-center justify-center">
            <span className="text-4xl font-bold text-rc-gold">R</span>
          </div>
          <CardTitle className="text-2xl font-bold text-rc-navy">RenoCart Portal</CardTitle>
          <CardDescription>
            {current ? `${current.label} — ${mode === 'login' ? 'connexion' : 'demande d\u2019accès'}` : 'Choisis ton accès'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingMsg ? (
            <div className="space-y-4 text-center">
              <Clock className="mx-auto h-10 w-10 text-rc-gold" />
              <p className="text-sm text-foreground">{pendingMsg}</p>
              <Button variant="outline" className="w-full" onClick={() => { setPendingMsg(null); setMode('login'); }}>Retour</Button>
            </div>
          ) : !portal ? (
            <div className="space-y-3">
              {PORTALS.map((p) => (
                <button key={p.id} type="button" onClick={() => setPortal(p.id)}
                  className="w-full flex items-center gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:border-rc-gold hover:bg-muted">
                  <div className="h-11 w-11 rounded-md bg-rc-navy flex items-center justify-center"><p.icon className="h-5 w-5 text-rc-gold" /></div>
                  <div><p className="font-semibold text-rc-navy">{p.label}</p><p className="text-xs text-muted-foreground">{p.desc}</p></div>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <button type="button" onClick={() => { setPortal(null); setMode('login'); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Changer d'accès
              </button>
              {mode === 'signup' && (
                <>
                  <div className="space-y-2"><Label htmlFor="name">Nom complet</Label>
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} disabled={loading} /></div>
                  {portal !== 'admin' && (
                    <div className="space-y-2"><Label htmlFor="company">Compagnie</Label>
                      <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} required maxLength={120} disabled={loading} /></div>
                  )}
                </>
              )}
              <div className="space-y-2"><Label htmlFor="email">Courriel</Label>
                <Input id="email" type="email" placeholder="ton@courriel.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} /></div>
              <div className="space-y-2"><Label htmlFor="password">Mot de passe</Label>
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} /></div>
              <Button type="submit" className="w-full bg-rc-gold hover:bg-rc-gold/90 text-rc-navy font-semibold" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'login' ? 'Se connecter' : "Demander l'accès"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {mode === 'login' ? "Pas encore de compte ? " : 'Déjà un compte ? '}
                <button type="button" className="font-medium text-rc-navy underline" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
                  {mode === 'login' ? "Demander l'accès" : 'Se connecter'}
                </button>
              </p>
              {mode === 'signup' && <p className="text-center text-xs text-muted-foreground">Chaque nouveau compte doit être approuvé par RenoCart.</p>}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;

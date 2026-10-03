import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, PencilLine, Loader2, MapPin, Calendar, Clock, Truck, Minus, Plus, Trash2, Undo2 } from 'lucide-react';

type Action = 'accept' | 'decline' | 'modify';
type Info = {
  order: { order_number: string; client_address: string; delivery_date: string | null; delivery_time_window: string | null; truck_type: string | null };
  items: { id: string; name: string; sku: string | null; quantity: number }[];
  supplier_name: string;
  status: string;
};

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/supplier-respond`;
const HEADERS = { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };

const COPY: Record<Action, { title: string; button: string; icon: typeof CheckCircle2; tone: string; done: string }> = {
  accept: { title: 'Accepter la commande', button: 'Confirmer l\'acceptation', icon: CheckCircle2, tone: 'bg-success text-success-foreground hover:bg-success/90', done: 'Merci ! La commande est acceptée. RenoCart a été avisé.' },
  decline: { title: 'Refuser la commande', button: 'Confirmer le refus', icon: XCircle, tone: 'bg-destructive text-destructive-foreground hover:bg-destructive/90', done: 'C\'est noté. RenoCart a été avisé de votre refus.' },
  modify: { title: 'Proposer une modification', button: 'Envoyer ma proposition', icon: PencilLine, tone: 'bg-warning text-warning-foreground hover:bg-warning/90', done: 'Merci ! Votre proposition a été envoyée à RenoCart.' },
};

export default function SupplierRespond() {
  const [params] = useSearchParams();
  const assignmentId = params.get('a');
  const initial = (params.get('action') as Action) || 'accept';
  const [action, setAction] = useState<Action>(['accept', 'decline', 'modify'].includes(initial) ? initial : 'accept');
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState('');
  const [altDate, setAltDate] = useState('');
  const [altTime, setAltTime] = useState('');
  const [altTruck, setAltTruck] = useState('');
  const [qty, setQty] = useState<Record<string, number>>({});
  const qOf = (id: string, orig: number) => qty[id] ?? orig;
  const setQ = (id: string, v: number, orig: number) => setQty(q => ({ ...q, [id]: Math.max(0, Math.min(orig, v)) }));
  const itemsChanged = !!info?.items?.some(i => qOf(i.id, i.quantity) < i.quantity);

  useEffect(() => {
    if (!assignmentId) { setError('Lien invalide.'); setLoading(false); return; }
    fetch(`${FN_URL}?a=${assignmentId}`, { headers: HEADERS })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error === 'expired' ? 'Cette commande n\'est plus disponible (elle a peut-être été réassignée).' : 'Lien invalide.');
        setInfo(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await fetch(FN_URL, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ assignment_id: assignmentId, action, note: note || null, alternative_date: altDate || null, alternative_time: altTime || null, alternative_truck: altTruck || null, items: action === 'modify' ? (info?.items || []).map(i => ({ item_id: i.id, quantity: qOf(i.id, i.quantity) })) : null }),
      });
      const d = await r.json();
      if (r.status === 409) throw new Error('Vous avez déjà répondu à cette commande.');
      if (!r.ok) throw new Error(typeof d.error === 'string' ? d.error : 'Erreur, veuillez réessayer.');
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const already = info && ['confirmed', 'declined', 'expired', 'needs_modification'].includes(info.status);
  const c = COPY[action];
  const Icon = c.icon;

  return (
    <div className="min-h-screen bg-rc-beige flex items-start justify-center p-4 pt-10">
      <div className="w-full max-w-lg space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-rc-gold rounded flex items-center justify-center font-bold text-rc-navy">R</div>
          <span className="text-xl font-bold text-rc-navy">RenoCart</span>
        </div>
        <Card>
          <CardContent className="p-6 space-y-5">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : error && !info ? (
              <p className="text-center py-8 text-muted-foreground">{error}</p>
            ) : done ? (
              <div className="text-center py-8 space-y-3">
                <Icon className="h-12 w-12 mx-auto text-success" />
                <p className="font-semibold">{c.done}</p>
                <p className="text-sm text-muted-foreground">Vous pouvez fermer cette page.</p>
              </div>
            ) : info && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Bonjour {info.supplier_name},</p>
                  <h1 className="text-2xl font-bold">Commande {info.order.order_number}</h1>
                </div>
                <div className="grid gap-2 text-sm bg-muted/50 rounded-lg p-4">
                  <span className="flex gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{info.order.client_address}</span>
                  <span className="flex gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{info.order.delivery_date || 'À confirmer'}</span>
                  <span className="flex gap-2"><Clock className="h-4 w-4 text-muted-foreground" />{info.order.delivery_time_window || 'À confirmer'}</span>
                  <span className="flex gap-2"><Truck className="h-4 w-4 text-muted-foreground" />{info.order.truck_type || 'À confirmer'}</span>
                </div>

                {already ? (
                  <p className="text-center text-muted-foreground py-4">Vous avez déjà répondu à cette commande. Merci !</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(COPY) as Action[]).map(a => {
                        const I = COPY[a].icon;
                        return (
                          <Button key={a} variant={a === action ? 'default' : 'outline'} className="h-auto py-3 flex-col gap-1 text-xs whitespace-normal" onClick={() => setAction(a)}>
                            <I className="h-5 w-5" />{COPY[a].title}
                          </Button>
                        );
                      })}
                    </div>

                    {action === 'modify' && (
                      <div className="grid gap-3">
                        <div>
                          <Label>Articles — retirez ou réduisez ce que vous ne pouvez pas fournir</Label>
                          <div className="mt-2 divide-y border rounded-lg">
                            {(info.items || []).map(i => {
                              const q = qOf(i.id, i.quantity);
                              const removed = q === 0;
                              return (
                                <div key={i.id} className="flex items-center gap-2 p-3">
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${removed ? 'line-through text-muted-foreground' : ''}`}>{i.name}</p>
                                    <p className="text-xs text-muted-foreground">{i.sku ? `SKU ${i.sku} · ` : ''}Demandé : {i.quantity}</p>
                                  </div>
                                  {removed ? (
                                    <Button size="sm" variant="ghost" onClick={() => setQ(i.id, i.quantity, i.quantity)}><Undo2 className="h-4 w-4" />Remettre</Button>
                                  ) : (
                                    <>
                                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQ(i.id, q - 1, i.quantity)}><Minus className="h-3 w-3" /></Button>
                                      <Input type="number" min={0} max={i.quantity} value={q} onChange={e => setQ(i.id, parseInt(e.target.value || '0', 10), i.quantity)} className="w-16 h-8 text-center" />
                                      <Button size="icon" variant="outline" className="h-8 w-8" disabled={q >= i.quantity} onClick={() => setQ(i.id, q + 1, i.quantity)}><Plus className="h-3 w-3" /></Button>
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setQ(i.id, 0, i.quantity)}><Trash2 className="h-4 w-4" /></Button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label>Autre date</Label><Input type="date" value={altDate} onChange={e => setAltDate(e.target.value)} /></div>
                          <div>
                            <Label>Autre plage horaire</Label>
                            <Select value={altTime} onValueChange={setAltTime}>
                              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AM">AM (avant midi)</SelectItem>
                                <SelectItem value="PM">PM (après-midi)</SelectItem>
                                <SelectItem value="Early">Tôt (avant 10h)</SelectItem>
                                <SelectItem value="Day">Journée</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>Autre camion</Label>
                          <Select value={altTruck} onValueChange={setAltTruck}>
                            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {['Boom', 'Boom 90ft', 'Van/Cube', 'Hiab', 'Other'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    <div>
                      <Label>{action === 'modify' ? 'Votre proposition' : 'Message (optionnel)'}</Label>
                      <Textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={action === 'decline' ? 'Raison du refus…' : action === 'modify' ? 'Ex. : article X en rupture, je peux livrer jeudi…' : ''} />
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button className={`w-full ${c.tone}`} size="lg" disabled={submitting || (action === 'modify' && !note && !altDate && !altTime && !altTruck && !itemsChanged)} onClick={submit}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                      {c.button}
                    </Button>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

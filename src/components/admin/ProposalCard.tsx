import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, X, Loader2, PencilLine } from 'lucide-react';

type Item = { item_id: string; name: string; original_qty: number; proposed_qty: number };
type Proposal = {
  id: string; status: string; supplier_name: string | null; items: Item[];
  proposed_date: string | null; proposed_time_window: string | null; proposed_truck: string | null; note: string | null;
};

export default function ProposalCard({ proposalId }: { proposalId: string }) {
  const [p, setP] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState<'accept' | 'refuse' | null>(null);

  const load = async () => {
    const { data } = await supabase.from('order_modification_proposals').select('*').eq('id', proposalId).maybeSingle();
    setP(data as unknown as Proposal);
  };
  useEffect(() => { load(); }, [proposalId]);

  const decide = async (decision: 'accept' | 'refuse') => {
    setBusy(decision);
    const { data, error } = await supabase.functions.invoke('decide-proposal', { body: { proposal_id: proposalId, decision } });
    setBusy(null);
    if (error) {
      const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
      toast.error(`Échec : ${details}`);
      return;
    }
    toast.success(decision === 'accept'
      ? (data?.split_order ? `Acceptée. La partie retirée devient ${data.split_order.order_number}.` : 'Proposition acceptée.')
      : 'Proposition refusée. Commande envoyée au fournisseur suivant.');
    load();
  };

  if (!p) return null;
  const changed = p.items.filter(i => i.proposed_qty < i.original_qty);

  return (
    <div className="border border-warning/40 bg-warning/10 rounded-2xl px-4 py-3 max-w-md space-y-2 text-sm">
      <div className="flex items-center gap-2 font-semibold text-warning"><PencilLine className="h-4 w-4" />Modification proposée — {p.supplier_name}</div>
      {changed.length > 0 && (
        <ul className="space-y-1 text-foreground">
          {changed.map(i => (
            <li key={i.item_id} className="flex justify-between gap-3">
              <span className={i.proposed_qty === 0 ? 'line-through text-muted-foreground' : ''}>{i.name}</span>
              <span className="shrink-0 tabular-nums">{i.original_qty} → <b>{i.proposed_qty}</b></span>
            </li>
          ))}
        </ul>
      )}
      <div className="text-foreground space-y-0.5">
        {p.proposed_date && <p>Date : <b>{p.proposed_date}</b></p>}
        {p.proposed_time_window && <p>Plage horaire : <b>{p.proposed_time_window}</b></p>}
        {p.proposed_truck && <p>Camion : <b>{p.proposed_truck}</b></p>}
        {p.note && <p className="italic text-muted-foreground whitespace-pre-wrap">« {p.note} »</p>}
      </div>
      {changed.length > 0 && p.status === 'pending' && (
        <p className="text-xs text-muted-foreground">Si tu acceptes, la commande sera divisée : la partie retirée part au fournisseur suivant.</p>
      )}
      {p.status === 'pending' ? (
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" disabled={!!busy} onClick={() => decide('accept')}>
            {busy === 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Accepter
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => decide('refuse')}>
            {busy === 'refuse' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}Refuser
          </Button>
        </div>
      ) : (
        <Badge variant={p.status === 'accepted' ? 'default' : 'secondary'}>{p.status === 'accepted' ? 'Acceptée' : 'Refusée'}</Badge>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, Loader2, Package, MapPin, Calendar, Clock, Truck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type OrderData = {
  id: string;
  order_number: string;
  client_address: string;
  delivery_date: string;
  delivery_time_window: string;
  truck_type: string | null;
  internal_notes: string | null;
};

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  sku: string | null;
  image_url: string | null;
  client_note: string | null;
};

export default function SupplierRespond() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const autoConfirm = searchParams.get('action') === 'confirm';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [responseId, setResponseId] = useState<string | null>(null);

  // Response state
  const [canDeliverDate, setCanDeliverDate] = useState(true);
  const [canDeliverTime, setCanDeliverTime] = useState(true);
  const [canDeliverTruck, setCanDeliverTruck] = useState(true);
  const [alternativeDate, setAlternativeDate] = useState('');
  const [alternativeTime, setAlternativeTime] = useState('');
  const [alternativeTruck, setAlternativeTruck] = useState('');
  const [generalNote, setGeneralNote] = useState('');
  const [itemDecisions, setItemDecisions] = useState<Record<string, { canFulfill: boolean; note: string }>>({});

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    if (!token) {
      setError('Lien invalide — aucun jeton trouvé.');
      setLoading(false);
      return;
    }
    loadOrder();
  }, [token]);

  useEffect(() => {
    if (autoConfirm && order && !submitted) {
      handleConfirmAll();
    }
  }, [autoConfirm, order]);

  const loadOrder = async () => {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/supplier-respond?token=${token}`);
      const data = await res.json();

      if (!res.ok) {
        if (data.already_responded) {
          setSubmitted(true);
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Erreur de chargement');
      }

      setOrder(data.order);
      setItems(data.items);
      setResponseId(data.response_id);

      // Init item decisions
      const decisions: Record<string, { canFulfill: boolean; note: string }> = {};
      data.items.forEach((item: OrderItem) => {
        decisions[item.id] = { canFulfill: true, note: '' };
      });
      setItemDecisions(decisions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAll = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/supplier-respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'confirm_all' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubmitted(true);
      toast.success('Commande confirmée !');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitModify = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/supplier-respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'modify',
          can_deliver_date: canDeliverDate,
          can_deliver_time: canDeliverTime,
          can_deliver_truck: canDeliverTruck,
          alternative_date: alternativeDate || null,
          alternative_time: alternativeTime || null,
          alternative_truck: alternativeTruck || null,
          supplier_general_note: generalNote || null,
          item_responses: Object.entries(itemDecisions).map(([itemId, d]) => ({
            item_id: itemId,
            can_fulfill: d.canFulfill,
            supplier_note: d.note || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubmitted(true);
      toast.success('Réponse envoyée !');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Merci pour votre réponse !</h2>
            <p className="text-gray-500">L'équipe RenoCart a été notifiée. Vous pouvez fermer cette page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Lien expiré ou invalide</h2>
            <p className="text-gray-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) return null;

  const YesNoButton = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        variant={value ? 'default' : 'outline'}
        className={value ? 'bg-green-600 hover:bg-green-700' : ''}
        onClick={() => onChange(true)}
      >
        Oui
      </Button>
      <Button
        type="button"
        size="sm"
        variant={!value ? 'destructive' : 'outline'}
        onClick={() => onChange(false)}
      >
        Non
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">RenoCart</h1>
          <p className="text-gray-500 mt-1">Répondre à la commande</p>
        </div>

        {/* Order summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Commande {order.order_number}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-gray-400" />
              <span>{order.client_address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>{new Date(order.delivery_date).toLocaleDateString('fr-CA')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span>{order.delivery_time_window}</span>
            </div>
            {order.truck_type && (
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-gray-400" />
                <span>{order.truck_type}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick confirm */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-6 text-center">
            <p className="font-medium text-green-800 mb-3">Tout est correct ?</p>
            <Button
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white px-8"
              onClick={handleConfirmAll}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              ✅ Je confirme tout
            </Button>
          </CardContent>
        </Card>

        {/* Delivery details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détails de livraison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Date</p>
                <p className="text-xs text-gray-500">{new Date(order.delivery_date).toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <YesNoButton value={canDeliverDate} onChange={setCanDeliverDate} />
            </div>
            {!canDeliverDate && (
              <Input
                type="date"
                placeholder="Date alternative"
                value={alternativeDate}
                onChange={(e) => setAlternativeDate(e.target.value)}
              />
            )}

            {/* Time */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Heure</p>
                <p className="text-xs text-gray-500">{order.delivery_time_window}</p>
              </div>
              <YesNoButton value={canDeliverTime} onChange={setCanDeliverTime} />
            </div>
            {!canDeliverTime && (
              <Input
                placeholder="Plage horaire alternative"
                value={alternativeTime}
                onChange={(e) => setAlternativeTime(e.target.value)}
              />
            )}

            {/* Truck */}
            {order.truck_type && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Camion</p>
                    <p className="text-xs text-gray-500">{order.truck_type}</p>
                  </div>
                  <YesNoButton value={canDeliverTruck} onChange={setCanDeliverTruck} />
                </div>
                {!canDeliverTruck && (
                  <Input
                    placeholder="Type de camion alternatif"
                    value={alternativeTruck}
                    onChange={(e) => setAlternativeTruck(e.target.value)}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Matériaux ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {items.map((item) => {
                const decision = itemDecisions[item.id] || { canFulfill: true, note: '' };
                return (
                  <div key={item.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-10 h-10 object-cover rounded" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                            <Package className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-gray-500">Qté: {item.quantity}</p>
                        </div>
                      </div>
                      <YesNoButton
                        value={decision.canFulfill}
                        onChange={(v) => setItemDecisions(prev => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], canFulfill: v },
                        }))}
                      />
                    </div>
                    {item.client_note && (
                      <p className="text-xs bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-yellow-800">
                        <strong>Note client:</strong> {item.client_note}
                      </p>
                    )}
                    {!decision.canFulfill && (
                      <Textarea
                        placeholder="Note (optionnel) — ex: disponible mardi prochain"
                        value={decision.note}
                        onChange={(e) => setItemDecisions(prev => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], note: e.target.value },
                        }))}
                        className="text-sm"
                        rows={2}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* General note */}
        <Card>
          <CardContent className="pt-6">
            <Textarea
              placeholder="Note générale (optionnel)"
              value={generalNote}
              onChange={(e) => setGeneralNote(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          size="lg"
          onClick={handleSubmitModify}
          disabled={submitting}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Envoyer ma réponse
        </Button>
      </div>
    </div>
  );
}

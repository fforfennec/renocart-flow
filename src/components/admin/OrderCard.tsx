import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];

export type AssignmentInfo = {
  supplier_id: string;
  assignment_type: string;
  profiles?: { full_name: string; company_name: string | null } | null;
};

export const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: any; label: string }> = {
    pending: { variant: 'secondary', label: 'New' },
    in_progress: { variant: 'default', label: 'Contacted' },
    delivered: { variant: 'outline', label: 'Done' },
    cancelled: { variant: 'destructive', label: 'Cancelled' },
  };
  const config = variants[status] || { variant: 'secondary', label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export const isLate = (deliveryDate: string, status: string) => {
  if (status === 'delivered') return false;
  return new Date(deliveryDate) < new Date();
};

export const getSupplierInitial = (s: AssignmentInfo) =>
  ((s.profiles as any)?.company_name || (s.profiles as any)?.full_name || '?').charAt(0).toUpperCase();

export const getSupplierName = (s: AssignmentInfo) =>
  (s.profiles as any)?.company_name || (s.profiles as any)?.full_name || 'Unknown';

export function LateBadge() {
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertCircle className="h-3 w-3" />
      Late
    </Badge>
  );
}

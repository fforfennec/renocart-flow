import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { AssignmentInfo, getStatusBadge, isLate, LateBadge } from './OrderCard';

type Order = Database['public']['Tables']['orders']['Row'];

interface Props {
  orders: Order[];
  assignmentsByOrder: Record<string, AssignmentInfo[]>;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function OrderCalendarView({ orders, assignmentsByOrder }: Props) {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const ordersByDate = useMemo(() => {
    const map: Record<string, Order[]> = {};
    orders.forEach(o => {
      const key = o.delivery_date; // YYYY-MM-DD
      if (!map[key]) map[key] = [];
      map[key].push(o);
    });
    return map;
  }, [orders]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = () => setCurrentDate(new Date(year, month - 1, 1));
  const next = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = new Date();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-foreground">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <Button variant="ghost" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground mb-1">
        {DAYS.map(d => <div key={d} className="py-2">{d}</div>)}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-t border-l">
        {cells.map((day, i) => {
          const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
          const dayOrders = day ? (ordersByDate[dateStr] || []) : [];
          const isToday = day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

          return (
            <div
              key={i}
              className={`border-r border-b min-h-[100px] p-1 ${
                day ? 'bg-background' : 'bg-muted/30'
              } ${isToday ? 'ring-2 ring-inset ring-primary/40' : ''}`}
            >
              {day && (
                <>
                  <span className={`text-xs font-medium ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                    {day}
                  </span>
                  <div className="space-y-0.5 mt-0.5">
                    {dayOrders.slice(0, 3).map(o => (
                      <div
                        key={o.id}
                        onClick={() => navigate(`/admin/orders/${o.id}`)}
                        className="text-[10px] leading-tight px-1 py-0.5 rounded cursor-pointer truncate hover:opacity-80 transition-opacity bg-primary/10 text-primary font-medium"
                      >
                        {o.order_number}
                        {isLate(o.delivery_date, o.status) && (
                          <span className="text-destructive ml-1">●</span>
                        )}
                      </div>
                    ))}
                    {dayOrders.length > 3 && (
                      <p className="text-[10px] text-muted-foreground px-1">+{dayOrders.length - 3} more</p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

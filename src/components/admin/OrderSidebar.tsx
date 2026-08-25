import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Lock, Send, PanelRightClose, Mail, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  orderId: string;
}

type Tab = 'internal' | 'chat';
type MessageSource = 'app' | 'email';

interface Message {
  id: string;
  content: string;
  sender_name: string;
  created_at: string;
  user_id: string;
  supplier_id: string | null;
  source: MessageSource;
  is_broadcast: boolean;
}

interface SupplierThread {
  supplier_id: string;
  supplier_name: string;
  lastMessageAt: string;
  unread: number;
}

export default function OrderSidebar({ orderId }: Props) {
  const { user, profile, userRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('internal');
  const [comments, setComments] = useState<Message[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newText, setNewText] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadComments, setUnreadComments] = useState(0);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | 'all'>('all');
  const [showSupplierList, setShowSupplierList] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    loadComments();
    loadMessages();

    const commentChannel = supabase
      .channel(`order-comments-${orderId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_comments',
        filter: `order_id=eq.${orderId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setComments(prev => [...prev, msg]);
        if (!open || activeTab !== 'internal' || msg.user_id !== user?.id) {
          setUnreadComments(prev => prev + 1);
        }
      })
      .subscribe();

    const messageChannel = supabase
      .channel(`order-messages-${orderId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_messages',
        filter: `order_id=eq.${orderId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => [...prev, msg]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(commentChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [orderId, open, activeTab, user?.id]);

  useEffect(() => {
    if (open && activeTab === 'internal') setUnreadComments(0);
  }, [open, activeTab]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments, messages, activeTab, open, selectedSupplierId]);

  const loadComments = async () => {
    const { data } = await supabase
      .from('order_comments')
      .select('id, content, created_at, user_id')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (data) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, company_name')
        .in('user_id', userIds);

      const nameMap: Record<string, string> = {};
      profiles?.forEach(p => {
        nameMap[p.user_id] = p.company_name || p.full_name;
      });

      setComments(data.map(c => ({
        ...c,
        sender_name: nameMap[c.user_id] || 'Admin',
        supplier_id: null,
        source: 'app' as MessageSource,
        is_broadcast: false,
      })));
    }
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from('order_messages')
      .select('id, content, sender_name, created_at, user_id, supplier_id, source, is_broadcast')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map(m => ({ ...m, source: (m.source || 'app') as MessageSource })));
    }
  };

  const handleSend = async () => {
    if (!newText.trim() || !user) return;
    setSending(true);

    const senderName = profile?.company_name || profile?.full_name || 'Unknown';

    try {
      if (activeTab === 'internal') {
        const { error } = await supabase.from('order_comments').insert({
          order_id: orderId,
          user_id: user.id,
          content: newText.trim(),
        });
        if (error) throw error;
      } else {
        const isBroadcast = selectedSupplierId === 'all';
        const supplierId = isBroadcast ? null : selectedSupplierId;

        // Admin replies go through email
        if (isAdmin) {
          const { error: fnError } = await supabase.functions.invoke('send-supplier-email', {
            body: {
              order_id: orderId,
              supplier_id: supplierId,
              content: newText.trim(),
              broadcast: isBroadcast,
            },
          });
          if (fnError) throw fnError;
        } else {
          const { error } = await supabase.from('order_messages').insert({
            order_id: orderId,
            user_id: user.id,
            sender_name: senderName,
            content: newText.trim(),
            supplier_id: supplierId,
            source: 'app',
            is_broadcast: isBroadcast,
          });
          if (error) throw error;
        }
      }
      setNewText('');
    } catch (error) {
      console.error(error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Build supplier threads
  const supplierThreads: SupplierThread[] = [];
  const supplierMap: Record<string, SupplierThread> = {};

  messages.forEach(msg => {
    const sid = msg.supplier_id;
    if (!sid) return;
    if (!supplierMap[sid]) {
      supplierMap[sid] = {
        supplier_id: sid,
        supplier_name: msg.sender_name || 'Fournisseur',
        lastMessageAt: msg.created_at,
        unread: 0,
      };
    }
    if (new Date(msg.created_at) > new Date(supplierMap[sid].lastMessageAt)) {
      supplierMap[sid].lastMessageAt = msg.created_at;
      supplierMap[sid].supplier_name = msg.sender_name || supplierMap[sid].supplier_name;
    }
    if (msg.source === 'email' && msg.user_id !== user?.id) {
      supplierMap[sid].unread += 1;
    }
  });

  Object.values(supplierMap).forEach(t => supplierThreads.push(t));
  supplierThreads.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  const totalUnreadMessages = supplierThreads.reduce((sum, t) => sum + t.unread, 0);
  const totalUnread = unreadComments + totalUnreadMessages;

  const filteredMessages = activeTab === 'chat'
    ? selectedSupplierId === 'all'
      ? messages
      : messages.filter(m => m.supplier_id === selectedSupplierId || m.is_broadcast)
    : comments;

  const selectedSupplierName = selectedSupplierId === 'all'
    ? 'Tous les fournisseurs'
    : supplierThreads.find(t => t.supplier_id === selectedSupplierId)?.supplier_name || 'Fournisseur';

  // Collapsed state — just show a floating button
  if (!open) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setOpen(true)}
          className="h-14 w-14 rounded-full bg-rc-navy hover:bg-rc-navy/90 shadow-lg relative"
          size="icon"
        >
          <MessageSquare className="h-6 w-6" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center px-1">
              {totalUnread}
            </span>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-[420px] shrink-0 border-l bg-background flex flex-col h-full relative">
      {/* Collapse arrow */}
      <button
        onClick={() => setOpen(false)}
        className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-4 bg-muted border border-r-0 rounded-l-md flex items-center justify-center hover:bg-muted-foreground/10 transition-colors"
        title="Close panel"
      >
        <PanelRightClose className="h-3 w-3 text-muted-foreground" />
      </button>

      {/* Tab header */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('internal')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors relative ${
            activeTab === 'internal'
              ? 'border-rc-navy text-rc-navy'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Lock className="h-3.5 w-3.5" />
          Internal
          {unreadComments > 0 && activeTab !== 'internal' && (
            <span className="ml-1 h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {unreadComments}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors relative ${
            activeTab === 'chat'
              ? 'border-rc-navy text-rc-navy'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Supplier Chat
          {totalUnreadMessages > 0 && activeTab !== 'chat' && (
            <span className="ml-1 h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {totalUnreadMessages}
            </span>
          )}
        </button>
      </div>

      {/* Tab description */}
      <div className="px-3 py-2 bg-muted/50 text-xs text-muted-foreground">
        {activeTab === 'internal'
          ? '🔒 Private — only RenoCart employees can see these comments'
          : '💬 Live chat — each supplier has their own thread; replies also go by email'}
      </div>

      {/* Supplier selector (chat only) */}
      {activeTab === 'chat' && isAdmin && (
        <div className="border-b">
          <button
            onClick={() => setShowSupplierList(!showSupplierList)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {selectedSupplierId === 'all' ? (
                <Users className="h-4 w-4 text-muted-foreground" />
              ) : (
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-medium">{selectedSupplierName}</span>
            </div>
            {showSupplierList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showSupplierList && (
            <div className="max-h-48 overflow-y-auto border-t">
              <button
                onClick={() => { setSelectedSupplierId('all'); setShowSupplierList(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 ${selectedSupplierId === 'all' ? 'bg-muted' : ''}`}
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                Tous les fournisseurs
              </button>
              {supplierThreads.map(thread => (
                <button
                  key={thread.supplier_id}
                  onClick={() => { setSelectedSupplierId(thread.supplier_id); setShowSupplierList(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 ${selectedSupplierId === thread.supplier_id ? 'bg-muted' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>{thread.supplier_name}</span>
                  </div>
                  {thread.unread > 0 && (
                    <span className="h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                      {thread.unread}
                    </span>
                  )}
                </button>
              ))}
              {supplierThreads.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Aucun fournisseur assigné</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {activeTab === 'internal' ? 'No internal comments yet' : 'No messages yet'}
          </p>
        ) : (
          filteredMessages.map((msg) => {
            const isOwn = msg.user_id === user?.id;
            const isEmail = msg.source === 'email';
            return (
              <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 ${
                    isOwn
                      ? activeTab === 'internal'
                        ? 'bg-rc-navy text-white'
                        : 'bg-primary text-primary-foreground'
                      : isEmail
                        ? 'bg-blue-50 border border-blue-100'
                        : 'bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {isEmail && <Mail className="h-3 w-3 text-blue-600" />}
                    {msg.is_broadcast && <Users className="h-3 w-3" />}
                    <span className="text-[10px] font-semibold opacity-80">
                      {msg.sender_name}
                      {isEmail && ' (email)'}
                      {msg.is_broadcast && ' — à tous'}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-1 px-1">
                  <span className="text-[10px] text-muted-foreground/60">
                    {new Date(msg.created_at).toLocaleString('fr-CA', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {(activeTab === 'chat' || isAdmin) && (
        <div className="border-t p-3">
          <div className="flex gap-2">
            <Textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeTab === 'internal' ? 'Add internal note...' : `Message ${selectedSupplierId === 'all' ? 'à tous' : selectedSupplierName}...`}
              className="min-h-[60px] max-h-[120px] resize-none text-sm"
              rows={2}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!newText.trim() || sending}
              className="shrink-0 self-end bg-rc-navy hover:bg-rc-navy/90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {activeTab === 'chat' && (
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {isAdmin
                ? `Envoyé par email à ${selectedSupplierId === 'all' ? 'tous les fournisseurs' : selectedSupplierName}.`
                : 'Visible par tous les fournisseurs assignés.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

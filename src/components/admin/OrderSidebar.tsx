import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Lock, Send } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  orderId: string;
}

type Tab = 'internal' | 'chat';

interface Message {
  id: string;
  content: string;
  sender_name: string;
  created_at: string;
  user_id: string;
}

export default function OrderSidebar({ orderId }: Props) {
  const { user, profile, userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('internal');
  const [comments, setComments] = useState<Message[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newText, setNewText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load comments
  useEffect(() => {
    loadComments();
    loadMessages();

    // Realtime subscriptions
    const commentChannel = supabase
      .channel(`order-comments-${orderId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_comments',
        filter: `order_id=eq.${orderId}`,
      }, (payload) => {
        setComments(prev => [...prev, payload.new as Message]);
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
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(commentChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments, messages, activeTab]);

  const loadComments = async () => {
    const { data } = await supabase
      .from('order_comments')
      .select('id, content, created_at, user_id')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (data) {
      // For comments, load profile names
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
      })));
    }
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from('order_messages')
      .select('id, content, sender_name, created_at, user_id')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (data) setMessages(data);
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
        const { error } = await supabase.from('order_messages').insert({
          order_id: orderId,
          user_id: user.id,
          sender_name: senderName,
          content: newText.trim(),
        });
        if (error) throw error;
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

  const currentMessages = activeTab === 'internal' ? comments : messages;
  const isAdmin = userRole === 'admin';

  return (
    <div className="w-[340px] shrink-0 border-l bg-background flex flex-col h-full">
      {/* Tab header */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('internal')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'internal'
              ? 'border-rc-navy text-rc-navy'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Lock className="h-3.5 w-3.5" />
          Internal
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'chat'
              ? 'border-rc-navy text-rc-navy'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Supplier Chat
        </button>
      </div>

      {/* Tab description */}
      <div className="px-3 py-2 bg-muted/50 text-xs text-muted-foreground">
        {activeTab === 'internal'
          ? '🔒 Private — only RenoCart employees can see these comments'
          : '💬 Live chat — visible to all assigned suppliers & DSPs'}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {currentMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {activeTab === 'internal' ? 'No internal comments yet' : 'No messages yet'}
          </p>
        ) : (
          currentMessages.map((msg) => {
            const isOwn = msg.user_id === user?.id;
            return (
              <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    isOwn
                      ? activeTab === 'internal'
                        ? 'bg-rc-navy text-white'
                        : 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-1 px-1">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {msg.sender_name}
                  </span>
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

      {/* Input — hide internal tab for non-admins */}
      {(activeTab === 'chat' || isAdmin) && (
        <div className="border-t p-3">
          <div className="flex gap-2">
            <Textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeTab === 'internal' ? 'Add internal note...' : 'Message suppliers...'}
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
        </div>
      )}
    </div>
  );
}

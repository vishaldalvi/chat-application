import { useState, useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  message_type: 'direct' | 'group';
  group_id?: string;
  profiles?: {
    display_name: string;
    avatar_url?: string;
  };
}

interface ChatWindowProps {
  chatId: string | null;
  chatType: 'direct' | 'group';
  chatName?: string;
}

export const ChatWindow = ({ chatId, chatType, chatName }: ChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch initial messages
    const fetchMessages = async () => {
      try {
        let query = supabase
          .from('messages')
          .select(`
            *,
            profiles (
              display_name,
              avatar_url
            )
          `)
          .eq('message_type', chatType);

        // Filter by chat context
        if (chatType === 'group' && chatId) {
          query = query.eq('group_id', chatId);
        } else if (chatType === 'direct') {
          query = query.is('group_id', null);
        }

        const { data, error } = await query.order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Set up real-time subscription
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          // Only add messages that belong to current chat context
          const newMessage = payload.new as Message;
          const belongsToCurrentChat = 
            (chatType === 'direct' && newMessage.message_type === 'direct' && !newMessage.group_id) ||
            (chatType === 'group' && newMessage.message_type === 'group' && newMessage.group_id === chatId);

          if (!belongsToCurrentChat) return;

          // Fetch the new message with profile data
          const { data } = await supabase
            .from('messages')
            .select(`
              *,
              profiles (
                display_name,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => [...prev, data]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, chatType]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          {chatType === 'group' && <Users className="h-5 w-5 text-muted-foreground" />}
          <h2 className="text-lg font-semibold">
            {chatName || (chatType === 'direct' ? 'General Chat' : 'Group Chat')}
          </h2>
        </div>
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.user_id === user?.id}
            />
          ))}
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              No messages yet. Start the conversation!
            </div>
          )}
        </div>
      </ScrollArea>
      <MessageInput chatId={chatId} chatType={chatType} />
    </div>
  );
};
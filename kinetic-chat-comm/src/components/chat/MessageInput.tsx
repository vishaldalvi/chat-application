import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface MessageInputProps {
  chatId: string | null;
  chatType: 'direct' | 'group';
}

export const MessageInput = ({ chatId, chatType }: MessageInputProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || sending) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          content: message.trim(),
          user_id: user.id,
          message_type: chatType,
          group_id: chatType === 'group' ? chatId : null,
        });

      if (error) {
        throw error;
      }

      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={sendMessage} className="flex gap-2 p-4 border-t bg-card">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        className="flex-1"
        disabled={sending}
      />
      <Button type="submit" disabled={!message.trim() || sending}>
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
};
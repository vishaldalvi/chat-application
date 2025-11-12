import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, MessageCircle } from 'lucide-react';

export const ChatHeader = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="flex items-center justify-between p-4 border-b bg-card">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">Chat App</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          Welcome, {user?.user_metadata?.display_name || 'User'}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={signOut}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};
import { useState } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { AuthModal } from '@/components/auth/AuthModal';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { Button } from '@/components/ui/button';

const ChatApp = () => {
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatType, setSelectedChatType] = useState<'direct' | 'group'>('direct');
  const [selectedChatName, setSelectedChatName] = useState<string>();

  const handleSelectChat = (chatId: string | null, chatType: 'direct' | 'group', chatName?: string) => {
    setSelectedChatId(chatId);
    setSelectedChatType(chatType);
    setSelectedChatName(chatName);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-6 max-w-md">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Welcome to Chat</h1>
            <p className="text-xl text-muted-foreground">Connect and chat with others in real-time</p>
          </div>
          <Button 
            onClick={() => setShowAuthModal(true)}
            size="lg"
            className="w-full"
          >
            Get Started
          </Button>
        </div>
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
        />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex">
      <ChatSidebar 
        onSelectChat={handleSelectChat}
        selectedChatId={selectedChatId}
        selectedChatType={selectedChatType}
      />
      <div className="flex-1 flex flex-col">
        <ChatHeader />
        <ChatWindow 
          chatId={selectedChatId}
          chatType={selectedChatType}
          chatName={selectedChatName}
        />
      </div>
    </div>
  );
};

const Index = () => {
  return (
    <AuthProvider>
      <ChatApp />
    </AuthProvider>
  );
};

export default Index;
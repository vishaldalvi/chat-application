import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Users, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CreateGroupModal } from './CreateGroupModal';

interface Group {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  member_count?: number;
}

interface ChatSidebarProps {
  onSelectChat: (chatId: string | null, chatType: 'direct' | 'group', chatName?: string) => void;
  selectedChatId: string | null;
  selectedChatType: 'direct' | 'group';
}

export const ChatSidebar = ({ onSelectChat, selectedChatId, selectedChatType }: ChatSidebarProps) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchGroups = async () => {
      try {
        const { data, error } = await supabase
          .from('groups')
          .select(`
            *,
            group_members!inner(id)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Count members for each group
        const groupsWithCount = await Promise.all(
          (data || []).map(async (group) => {
            const { count } = await supabase
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', group.id);
            
            return {
              ...group,
              member_count: count || 0
            };
          })
        );

        setGroups(groupsWithCount);
      } catch (error) {
        console.error('Error fetching groups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();

    // Subscribe to group changes
    const channel = supabase
      .channel('groups')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'groups',
        },
        () => {
          fetchGroups();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <div className="w-80 bg-secondary/20 border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Messages</h2>
      </div>
      
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {/* Direct Messages Section */}
          <div className="mb-4">
            <Button
              variant={selectedChatType === 'direct' && !selectedChatId ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => onSelectChat(null, 'direct')}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              General Chat
            </Button>
          </div>

          {/* Groups Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground px-2">Groups</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCreateGroup(true)}
                className="h-6 w-6 p-0"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            
            {loading ? (
              <div className="px-2 py-4 text-sm text-muted-foreground">Loading groups...</div>
            ) : groups.length === 0 ? (
              <div className="px-2 py-4 text-sm text-muted-foreground">
                No groups yet. Create one to get started!
              </div>
            ) : (
              groups.map((group) => (
                <Button
                  key={group.id}
                  variant={selectedChatId === group.id && selectedChatType === 'group' ? 'secondary' : 'ghost'}
                  className="w-full justify-start mb-1"
                  onClick={() => onSelectChat(group.id, 'group', group.name)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  <div className="flex-1 text-left">
                    <div className="truncate">{group.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </Button>
              ))
            )}
          </div>
        </div>
      </ScrollArea>

      <CreateGroupModal
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        onGroupCreated={(group) => {
          setGroups(prev => [group, ...prev]);
          onSelectChat(group.id, 'group', group.name);
        }}
      />
    </div>
  );
};
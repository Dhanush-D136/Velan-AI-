import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import { Send, Users, MessageSquare, Pin, ChevronUp } from 'lucide-react';

interface ChatMsg {
  id: string;
  content: string;
  createdAt: string;
  isPinned?: boolean;
  sender: { id: string; name: string; role: string };
}

interface ChatRoomItem {
  classId: string;
  className: string;
  roomId: string;
  lastMessage: string | null;
  lastMessageSender: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export const ClassChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const canPin = user?.role === 'FACULTY' || user?.role === 'ADMIN';

  const [rooms, setRooms] = useState<ChatRoomItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(user?.studentProfile?.classId || '');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isPinnedAnnouncement, setIsPinnedAnnouncement] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const res = await api.get('/api/chat/rooms');
      const list: ChatRoomItem[] = res.data?.rooms || [];
      setRooms(list);
      if (list.length > 0 && (!selectedClassId || !list.some((r) => r.classId === selectedClassId))) {
        setSelectedClassId(list[0].classId);
      }
    } catch {
      // fallback if no rooms
    }
  }, [selectedClassId]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const fetchMessages = useCallback(async () => {
    if (!selectedClassId) return;
    try {
      const res = await api.get(`/api/chat/room/${selectedClassId}?limit=50`);
      setMessages(res.data.messages || []);
      setHasMore(!!res.data.hasMore);
      setRooms((prev) =>
        prev.map((r) => (r.classId === selectedClassId ? { ...r, unreadCount: 0 } : r))
      );
    } catch {
      // handled
    }
  }, [selectedClassId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleLoadOlder = async () => {
    if (!selectedClassId || messages.length === 0 || isLoadingOlder) return;
    setIsLoadingOlder(true);
    try {
      const oldestId = messages[0].id;
      const res = await api.get(`/api/chat/room/${selectedClassId}?before=${oldestId}&limit=50`);
      const older: ChatMsg[] = res.data.messages || [];
      setMessages((prev) => [...older, ...prev]);
      setHasMore(!!res.data.hasMore);
    } catch {
      showToast('Failed to load older messages', 'error');
    } finally {
      setIsLoadingOlder(false);
    }
  };

  useRealtimeSync(
    ['chat:new_message', 'chat:message', 'timetable:updated', 'data:updated'],
    (payload: any) => {
      if (payload?.id && payload?.classId === selectedClassId) {
        setMessages((prev) => (prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]));
      } else {
        loadRooms();
        if (payload?.classId === selectedClassId || !payload?.classId) {
          fetchMessages();
        }
      }
    },
    { classId: selectedClassId || undefined, userId: user?.id }
  );

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedClassId) return;

    setIsSending(true);
    try {
      const res = await api.post('/api/chat/message', {
        classId: selectedClassId,
        content: inputText.trim(),
        type: 'TEXT',
        isPinned: canPin && isPinnedAnnouncement,
      });
      const sent = res.data.message;
      if (sent) {
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      }
      setInputText('');
      setIsPinnedAnnouncement(false);
      loadRooms();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to send message', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const pinnedMessages = messages.filter((m) => m.isPinned);
  const currentRoom = rooms.find((r) => r.classId === selectedClassId);

  if (!selectedClassId && rooms.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <EmptyState
          icon={MessageSquare}
          title="No class chat room available"
          description="Faculty automatically join class chats based on timetable assignments and advisor roles."
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-10rem)]">
      {/* Room List Sidebar (shown when 2+ rooms or on desktop) */}
      {rooms.length > 0 && (
        <Card className="lg:col-span-4 p-3 flex flex-col overflow-hidden">
          <div className="px-2 py-2 border-b border-border flex items-center justify-between">
            <h3 className="font-heading font-bold text-sm text-content">My Class Groups</h3>
            <Badge variant="neutral" size="sm">{rooms.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border mt-1">
            {rooms.map((r) => (
              <button
                key={r.classId}
                onClick={() => setSelectedClassId(r.classId)}
                className={`w-full text-left p-3 rounded-xl transition flex items-start justify-between gap-2 ${
                  r.classId === selectedClassId ? 'bg-brand-50 border border-brand-200' : 'hover:bg-surface-soft'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs text-content truncate">{r.className}</div>
                  <div className="text-[11px] text-content-secondary truncate mt-0.5">
                    {r.lastMessage ? `${r.lastMessageSender}: ${r.lastMessage}` : 'No messages yet'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {r.lastMessageAt && (
                    <span className="text-[10px] text-content-muted">
                      {new Date(r.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {r.unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-bold">
                      {r.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Active Chat Area */}
      <div className={`${rooms.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'} flex flex-col space-y-3 h-full min-h-0`}>
        <Card className="p-4 flex items-center justify-between shadow-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-gradient text-white flex items-center justify-center font-bold shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-content">
                {currentRoom?.className || 'Class Group Chat'}
              </h2>
              <span className="text-[11px] text-content-secondary">Auto-synced from timetable &amp; advisor assignments</span>
            </div>
          </div>
        </Card>

        {pinnedMessages.length > 0 && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 space-y-1 shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 uppercase">
              <Pin className="w-3.5 h-3.5" />
              Pinned Announcement
            </div>
            <p className="text-xs text-amber-950 font-medium">
              {pinnedMessages[pinnedMessages.length - 1].content}
            </p>
          </div>
        )}

        <Card className="flex-1 overflow-y-auto p-5 space-y-4">
          {hasMore && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleLoadOlder}
                isLoading={isLoadingOlder}
                leftIcon={<ChevronUp className="w-3.5 h-3.5" />}
              >
                Load Older Messages
              </Button>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-content-secondary">
              No messages yet. Start the conversation with your class!
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.sender?.id === user?.id;
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-content-secondary">
                      {m.sender?.name || 'User'}
                    </span>
                    <Badge variant="neutral" size="sm">{m.sender?.role || 'USER'}</Badge>
                    {m.isPinned && (
                      <Badge variant="warning" size="sm">Announcement</Badge>
                    )}
                    <span className="text-[10px] text-content-muted">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm max-w-[80%] ${
                      m.isPinned
                        ? 'bg-amber-50 border border-amber-300 text-amber-950'
                        : isMe
                          ? 'bg-brand-600 text-white rounded-br-none'
                          : 'bg-surface-soft border border-border text-content rounded-bl-none'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })
          )}
        </Card>

        <form onSubmit={handleSendMessage} className="space-y-2 shrink-0">
          {canPin && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-content-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={isPinnedAnnouncement}
                onChange={(e) => setIsPinnedAnnouncement(e.target.checked)}
                className="rounded border-border"
              />
              <Pin className="w-3.5 h-3.5 text-amber-600" />
              Mark as Pinned Announcement
            </label>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message to your class..."
              className="flex-1"
            />
            <Button type="submit" isLoading={isSending} leftIcon={<Send className="w-4 h-4" />}>
              Send
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

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
import { Send, Users, MessageSquare } from 'lucide-react';

interface ChatMsg {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string; role: string };
}

export const ClassChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToast();

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(user?.studentProfile?.classId || '');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const loadClasses = async () => {
      if (user?.studentProfile?.classId) {
        setSelectedClassId(user.studentProfile.classId);
        return;
      }
      try {
        const res = await api.get('/api/academics/classes');
        const list = res.data.classes || res.data.data || [];
        setClasses(list);
        if (list.length > 0 && !selectedClassId) {
          setSelectedClassId(list[0].id);
        }
      } catch {
        // handled
      }
    };
    loadClasses();
  }, [user?.studentProfile?.classId]);

  const fetchMessages = useCallback(async () => {
    if (!selectedClassId) return;
    try {
      const res = await api.get(`/api/chat/room/${selectedClassId}`);
      setMessages(res.data.messages || []);
    } catch {
      // handled
    }
  }, [selectedClassId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useRealtimeSync(
    ['chat:message'],
    (msg: ChatMsg) => {
      if (msg?.id) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      } else {
        fetchMessages();
      }
    },
    { classId: selectedClassId || undefined }
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
      });
      const sent = res.data.message;
      if (sent) {
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      }
      setInputText('');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to send message', 'error');
    } finally {
      setIsSending(false);
    }
  };

  if (!selectedClassId) {
    return (
      <div className="max-w-4xl mx-auto">
        <EmptyState
          icon={MessageSquare}
          title="No class chat room available"
          description="Once a class is created and you are assigned to it, your class-exclusive real-time chat will appear here."
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-10rem)] flex flex-col space-y-4">
      <Card className="p-4 flex items-center justify-between shadow-subtle shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-gradient text-white flex items-center justify-center font-bold shadow-md">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-content">Class Group Chat</h2>
            <span className="text-[11px] text-content-secondary">Real-time class-scoped communication</span>
          </div>
        </div>

        {classes.length > 0 && (
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-border bg-white text-xs font-semibold outline-none"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </Card>

      <Card className="flex-1 overflow-y-auto p-5 space-y-4">
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
                  <span className="text-[10px] text-content-muted">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm max-w-[80%] ${
                    isMe
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

      <form onSubmit={handleSendMessage} className="flex items-center gap-2 shrink-0">
        <Input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message to your class..."
          className="flex-1"
        />
        <Button type="submit" isLoading={isSending} leftIcon={<Send className="w-4 h-4" />}>
          Send
        </Button>
      </form>
    </div>
  );
};

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import {
  Send,
  Paperclip,
  Smile,
  Users,
  ShieldCheck,
  Megaphone,
  CheckCheck,
} from 'lucide-react';

interface Message {
  id: string;
  senderName: string;
  senderRole: string;
  isMe: boolean;
  content: string;
  timestamp: string;
  isAnnouncement?: boolean;
}

export const ClassChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const [inputText, setInputText] = useState('');

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      senderName: 'Dr. Ramesh Kumar',
      senderRole: 'FACULTY',
      isMe: user?.role === 'FACULTY',
      content: 'Good morning everyone! Please check the Study Materials tab for the Binary Search Tree and AVL tree notes for upcoming internals.',
      timestamp: '09:15 AM',
      isAnnouncement: true,
    },
    {
      id: '2',
      senderName: 'Bhavani S',
      senderRole: 'STUDENT',
      isMe: false,
      content: 'Thank you Sir! Will the lab assignment on Dijkstra algorithm be due this Friday?',
      timestamp: '09:22 AM',
    },
    {
      id: '3',
      senderName: 'Dr. Ramesh Kumar',
      senderRole: 'FACULTY',
      isMe: user?.role === 'FACULTY',
      content: 'Yes Bhavani, please upload your GitHub repo link or zip by Friday 5:00 PM.',
      timestamp: '09:25 AM',
    },
    {
      id: '4',
      senderName: 'Chandran M',
      senderRole: 'STUDENT',
      isMe: false,
      content: 'Noted sir!',
      timestamp: '09:30 AM',
    },
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: Message = {
      id: String(Date.now()),
      senderName: user?.name || 'Me',
      senderRole: user?.role || 'STUDENT',
      isMe: true,
      content: inputText,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-10rem)] flex flex-col space-y-4">
      {/* Room Header */}
      <Card className="p-4 flex items-center justify-between shadow-subtle shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-gradient text-white flex items-center justify-center font-bold shadow-md">
            CSE
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-content">
              CSE – Year 2 – Section A Class Room
            </h2>
            <p className="text-xs text-content-secondary flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent-emerald inline-block" />
              <span>32 Enrolled Students • 4 Faculty Assigned</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="brand" size="sm">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Class-Exclusive
          </Badge>
        </div>
      </Card>

      {/* Message Stream */}
      <Card className="flex-1 overflow-y-auto p-6 space-y-4 shadow-subtle">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'} max-w-xl ${
              msg.isMe ? 'ml-auto' : 'mr-auto'
            }`}
          >
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-[11px] font-bold text-content-secondary">
                {msg.senderName}
              </span>
              <span className="text-[10px] text-content-muted font-mono">{msg.timestamp}</span>
              {msg.senderRole === 'FACULTY' && (
                <Badge variant="faculty" size="sm">
                  Faculty
                </Badge>
              )}
            </div>

            <div
              className={`p-4 rounded-3xl text-sm leading-relaxed ${
                msg.isAnnouncement
                  ? 'bg-amber-50 border border-amber-200 text-amber-950 font-medium'
                  : msg.isMe
                  ? 'bg-brand-gradient text-white shadow-glass rounded-tr-sm'
                  : 'bg-surface-soft border border-border text-content rounded-tl-sm'
              }`}
            >
              {msg.isAnnouncement && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-accent-amber uppercase mb-1">
                  <Megaphone className="w-3.5 h-3.5" /> Faculty Announcement
                </span>
              )}
              {msg.content}
            </div>
          </div>
        ))}
      </Card>

      {/* Input Bar */}
      <Card className="p-3 shadow-subtle shrink-0">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <button
            type="button"
            className="p-2.5 rounded-2xl text-content-muted hover:text-content hover:bg-slate-100 transition-colors"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input
            type="text"
            placeholder="Send a message to CSE Year 2 Section A..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-surface-soft border border-border text-sm outline-none focus:border-brand-500"
          />

          <Button
            type="submit"
            size="md"
            variant="primary"
            className="rounded-2xl px-5"
            rightIcon={<Send className="w-4 h-4" />}
          >
            Send
          </Button>
        </form>
      </Card>
    </div>
  );
};

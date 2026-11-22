import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Sparkles, Send, Bot, BookOpen, Lightbulb, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export const AIAssistantPage: React.FC = () => {
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [chatLog, setChatLog] = useState([
    {
      role: 'assistant',
      text: `Hello ${user?.name || 'there'}! I am Velan AI, your collegiate academic assistant. You can ask me to explain syllabus topics, generate flashcards, summarize lecture notes, or analyze attendance trends.`,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userText = query;
    setChatLog((prev) => [...prev, { role: 'user', text: userText }]);
    setQuery('');
    setIsLoading(true);

    setTimeout(() => {
      let reply = '';
      const lower = userText.toLowerCase();

      if (lower.includes('attendance') || lower.includes('shortage')) {
        reply =
          'Attendance Analysis: CSE 2nd Year Section A currently holds a 94.2% average attendance. 4 students are flagged below the 75% boundary (Karthik Raja S, Sneha R, etc.). No systemic timetable clashes observed.';
      } else if (lower.includes('tree') || lower.includes('data structure')) {
        reply =
          'Binary Search Tree (BST) Concept: A binary tree where each node has at most two children. The left subtree contains only nodes with keys lesser than the node’s key, and the right subtree contains only nodes with keys greater. Average search time complexity is O(log n).';
      } else if (lower.includes('quiz') || lower.includes('flashcard')) {
        reply =
          'Flashcard Quiz (CS301):\nQ1: What is the worst-case time complexity of QuickSort?\nA: O(n²) when the pivot chosen is consistently the smallest or largest element.\nQ2: Which data structure is used in Breadth-First Search (BFS)?\nA: Queue (FIFO).';
      } else {
        reply = `Velan AI Insight: Regarding "${userText}" — this aligns with your Semester 4 curriculum. I have retrieved relevant reference materials from the department repository.`;
      }

      setChatLog((prev) => [...prev, { role: 'assistant', text: reply }]);
      setIsLoading(false);
    }, 900);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-brand-gradient text-white flex items-center justify-between shadow-glass">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-extrabold">Velan AI Academic Assistant</h1>
            <p className="text-xs text-white/80">
              Provider-agnostic intelligence engine with collegiate rule fallback.
            </p>
          </div>
        </div>
        <Badge variant="brand" className="bg-white/20 text-white border-white/30 text-xs">
          Active Mode
        </Badge>
      </div>

      {/* Suggested prompts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setQuery('Explain AVL tree rotations with simple examples')}
          className="p-3 rounded-2xl border border-border bg-white hover:border-brand-300 text-left text-xs transition-all"
        >
          <span className="font-bold text-brand-600 block mb-1">Concept Explanation</span>
          <span className="text-content-secondary">"Explain AVL tree rotations with simple examples"</span>
        </button>

        <button
          onClick={() => setQuery('Generate 3 quick quiz flashcards for Data Structures')}
          className="p-3 rounded-2xl border border-border bg-white hover:border-brand-300 text-left text-xs transition-all"
        >
          <span className="font-bold text-cyan-600 block mb-1">Study Quiz</span>
          <span className="text-content-secondary">"Generate 3 quick quiz flashcards for Data Structures"</span>
        </button>

        <button
          onClick={() => setQuery('Which students are below 75% attendance?')}
          className="p-3 rounded-2xl border border-border bg-white hover:border-brand-300 text-left text-xs transition-all"
        >
          <span className="font-bold text-pink-600 block mb-1">Attendance Intelligence</span>
          <span className="text-content-secondary">"Which students are below 75% attendance?"</span>
        </button>
      </div>

      {/* Chat Stream */}
      <Card className="min-h-[360px] max-h-[480px] overflow-y-auto p-6 space-y-4">
        {chatLog.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="p-2 rounded-2xl bg-brand-50 text-brand-600 shrink-0 mt-1">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div
              className={`p-4 rounded-3xl text-sm leading-relaxed max-w-xl whitespace-pre-line ${
                msg.role === 'user'
                  ? 'bg-brand-gradient text-white rounded-tr-sm shadow-glass'
                  : 'bg-surface-soft border border-border text-content rounded-tl-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-content-muted">
            <Sparkles className="w-4 h-4 animate-spin text-brand-500" /> Velan AI is analyzing syllabus and logs...
          </div>
        )}
      </Card>

      {/* Input Form */}
      <form onSubmit={handleAsk} className="flex gap-2">
        <input
          type="text"
          placeholder="Ask Velan AI a question, doubt or request attendance analysis..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 p-3.5 rounded-2xl border border-border bg-white text-sm outline-none focus:border-brand-500 shadow-sm"
        />
        <Button size="lg" type="submit" rightIcon={<Send className="w-4 h-4" />}>
          Ask AI
        </Button>
      </form>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Bot,
  RotateCcw,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react';
import { generateLocalAssistantReply, getStoredToken } from '../api/client.ts';
import type { ChatMessage, UserRole } from '../types/store.ts';

interface AssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  lowStockCount: number;
  expiringCount: number;
}

const STARTER_PROMPTS = [
  'Which items are low in stock?',
  'What will sell more next week?',
  "Summarize today's profit",
  'Which items are expiring soon and how should we clear them?',
  'Build a restocking priority list with total budget',
];

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  isOpen,
  onClose,
  userRole,
  lowStockCount,
  expiringCount,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const sendMessage = async (textOverride?: string) => {
    const trimmed = (textOverride ?? input).trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    const assistantId = `a-${Date.now() + 1}`;
    const nextHistory = [...messages, userMsg];

    setMessages([
      ...nextHistory,
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    if (!textOverride) setInput('');
    setIsStreaming(true);

    const respondLocally = () => {
      const reply = generateLocalAssistantReply(trimmed);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: reply } : m))
      );
    };

    try {
      const token = getStoredToken();

      if (token?.startsWith('local_')) {
        respondLocally();
        return;
      }

      let response: Response;
      try {
        response = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            messages: nextHistory.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });
      } catch {
        respondLocally();
        return;
      }

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        const isBackendMissing =
          response.status === 404 ||
          response.status === 405 ||
          response.status === 502 ||
          response.status === 503 ||
          !contentType.includes('application/json');

        if (isBackendMissing) {
          respondLocally();
          return;
        }

        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Assistant error (${response.status})`);
      }

      if (!contentType.includes('text/event-stream')) {
        respondLocally();
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        respondLocally();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const payloadStr = line.slice(5).trim();
          if (!payloadStr) continue;

          try {
            const payload = JSON.parse(payloadStr) as {
              type: 'chunk' | 'done' | 'error';
              text?: string;
              error?: string;
            };
            if (payload.type === 'chunk' && payload.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + payload.text }
                    : m
                )
              );
            } else if (payload.type === 'error') {
              throw new Error(payload.error || 'Gemini assistant failed.');
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to reach SmartStock AI right now.';
      setError(msg);
      setMessages((prev) =>
        prev.filter((m) => !(m.id === assistantId && m.content.trim() === ''))
      );
    } finally {
      setIsStreaming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/35"
      role="dialog"
      aria-modal="true"
      aria-label="SmartStock Gemini AI Assistant"
    >
      <div className="flex-1" onClick={onClose} />
      <aside className="w-full max-w-lg bg-white border-l border-slate-200 h-full flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm font-semibold text-slate-900 truncate">
                SmartStock Gemini Assistant
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Live store analytics · {lowStockCount} low stock · {expiringCount} expiring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setError(null);
                }}
                disabled={isStreaming}
                title="Clear conversation"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close assistant"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Read-only Governance Bar */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-xs text-slate-600">
          <ShieldAlert className="w-3.5 h-3.5 text-teal-700 shrink-0" />
          <span>
            Read-only advisor ({userRole} session) — answers from live store records without
            altering sales or inventory.
          </span>
        </div>

        {/* Conversation Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-5">
              <div>
                <p className="font-display text-base font-semibold text-slate-900">
                  Ask anything about your store
                </p>
                <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                  Every answer reads your current stock quantities, today&apos;s bills,
                  operating expenses, expiry dates, and daily sales pace in real time.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500">Suggested questions</p>
                <div className="flex flex-col gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="text-left px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-teal-600 hover:bg-teal-50/40 text-sm text-slate-700 transition-colors cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={
                  msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'
                }
              >
                <div
                  className={
                    msg.role === 'user'
                      ? 'max-w-[85%] rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm leading-relaxed'
                      : 'w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3'
                  }
                >
                  {msg.role === 'user' ? (
                    msg.content
                  ) : msg.content ? (
                    <div className="assistant-prose">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Analyzing live store data...</p>
                  )}
                </div>
              </div>
            ))
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
            >
              {error}
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="p-4 border-t border-slate-200 bg-white flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming}
            placeholder="Ask about low stock, next week demand, or today's profit..."
            className="flex-1 px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15 disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            aria-label="Send question"
            className="px-4 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Send className="w-4 h-4" />
            <span>Ask</span>
          </button>
        </form>
      </aside>
    </div>
  );
};

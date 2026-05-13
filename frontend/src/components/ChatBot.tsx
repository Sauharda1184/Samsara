import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatBotProps {
  userLocation?: { lat: number; lon: number } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChatBot({ userLocation, open, onOpenChange }: ChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I'm your Samsara health assistant. I can help you find the right care in Nepal and answer health questions. How can I help?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          lat: userLocation?.lat ?? null,
          lon: userLocation?.lon ?? null,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, I couldn't connect. Please try again.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, userLocation]);

  return (
    <>
      {/* Desktop-only floating toggle button */}
      <button
        onClick={() => onOpenChange(!open)}
        className={cn(
          "hidden md:flex absolute bottom-6 right-6 z-20 rounded-full shadow-lg items-center justify-center transition-all",
          open ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
        )}
        style={{ width: 52, height: 52 }}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className={cn(
          "absolute z-20 bg-card border border-border flex flex-col overflow-hidden",
          // Mobile: full screen above bottom nav
          "inset-x-0 top-0 bottom-16 rounded-none",
          // Desktop: compact panel bottom-right
          "md:inset-x-auto md:top-auto md:bottom-20 md:right-6 md:w-80 md:rounded-2xl md:shadow-2xl md:h-[420px]",
        )}>
          {/* Header */}
          <div className="px-4 py-3 bg-primary text-primary-foreground flex items-center gap-2 shrink-0">
            <MessageCircle className="h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Samsara Health Assistant</p>
              <p className="text-[10px] opacity-75">
                {userLocation ? "Using your location" : "Set location for nearby recommendations"}
              </p>
            </div>
            {/* Mobile close button */}
            <button
              onClick={() => onOpenChange(false)}
              className="md:hidden text-primary-foreground/80 hover:text-primary-foreground shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  {msg.content || (loading && i === messages.length - 1
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : null)}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-border flex gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask a health question…"
              disabled={loading}
              className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

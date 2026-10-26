"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useDateRange } from "@/components/DateRangeProvider";

const prompts = [
  "How has my pace changed over time?",
  "Does temperature affect my heart rate?",
  "How does sleep relate to my runs?",
];

export default function InsightsChat() {
  const [messages, setMessages] = useState<{ id: number; content: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const nextId = useRef(0);
  const conversationRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const helpId = useId();
  const { fromDate, toDate } = useDateRange();
  const period = !fromDate && !toDate ? "All time"
    : `${fromDate ? fromDate.slice(2) : "Beginning"} – ${toDate ? toDate.slice(2) : "Present"}`;

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [messages]);

  function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content) return;
    const message = { id: nextId.current++, content };
    setMessages((current) => [...current, message]);
    setDraft("");
    setNotice("Message added to the preview. Assistant replies are not connected yet.");
    inputRef.current?.focus();
  }

  return <div className="flex h-[600px] min-w-0 flex-col text-foreground">
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-selection text-brand">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true"><path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2v-10A8.5 8.5 0 0 1 10.5 3H13a7 7 0 0 1 7 7z" /><path d="M7 9h8M7 13h5" /></svg>
        </span>
        <div>
          <h2 className="text-base font-semibold">Runsight Assistant</h2>
          <p className="mt-1 text-xs text-muted">A space to explore your running insights.</p>
        </div>
      </div>
      <span className="shrink-0 rounded-full border border-control-border px-2 py-1 text-[10px] font-medium text-muted">UI preview</span>
    </header>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs">
      <p className="text-muted">Selected period: <span className="font-medium text-foreground">{period}</span></p>
      <button type="button" disabled={!messages.length && !draft} onClick={() => {
        setMessages([]); setDraft(""); setNotice("Conversation cleared."); inputRef.current?.focus();
      }} className="cursor-pointer rounded px-2 py-1 font-medium text-brand hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default disabled:opacity-50">Clear chat</button>
    </div>
    <div ref={conversationRef} role="log" aria-label="Chat conversation" aria-relevant="additions" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
      <div className="max-w-[95%] rounded-xl rounded-tl-sm border border-border bg-surface px-4 py-3">
        <p className="mb-1 text-xs font-semibold text-brand">Runsight Assistant</p>
        <p className="text-sm leading-6">What would you like to learn about your runs?</p>
        <p className="mt-2 text-xs leading-5 text-muted">Try a question about pace, temperature, or recovery. This preview lets you compose messages; answers will be available when an assistant is connected.</p>
      </div>
      {messages.map((message) => <div key={message.id} className="ml-auto w-fit max-w-[90%] rounded-xl rounded-tr-sm bg-brand px-4 py-3 text-on-brand">
        <p className="mb-1 text-xs font-semibold">You</p>
        <p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{message.content}</p>
      </div>)}
    </div>
    {!messages.length && <div className="shrink-0 px-4 pb-3">
      <p className="mb-2 text-[11px] font-medium text-muted">Start with a question</p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => <button key={prompt} type="button" onClick={() => { setDraft(prompt); inputRef.current?.focus(); }}
          className="cursor-pointer rounded-lg border border-control-border bg-surface px-3 py-2 text-left text-xs leading-4 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand">{prompt}</button>)}
      </div>
    </div>}
    <form onSubmit={sendMessage} className="shrink-0 border-t border-border bg-surface px-4 py-3">
      <label htmlFor={`${helpId}-input`} className="sr-only">Message Runsight Assistant</label>
      <div className="flex items-end gap-2 rounded-lg border border-control-border bg-surface-muted p-2 focus-within:outline-2 focus-within:outline-brand">
        <textarea ref={inputRef} id={`${helpId}-input`} value={draft} onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendMessage(); }
          }} rows={2} maxLength={2000} placeholder="Ask about your running…" aria-describedby={helpId}
          className="min-w-0 flex-1 resize-none bg-transparent px-1 py-1 text-sm leading-5 placeholder:text-muted focus:outline-none" />
        <button type="submit" disabled={!draft.trim()} aria-label="Send message" title="Send message"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-brand text-on-brand hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-default disabled:opacity-50">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7M12 5v14" /></svg>
        </button>
      </div>
      <div id={helpId} className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[10px] text-muted">
        <span>Enter to send · Shift+Enter for a new line</span><span>{draft.length}/2,000</span>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted">Preview only. Messages stay on this page and are not sent to an AI service.</p>
      <p role="status" className="sr-only">{notice}</p>
    </form>
  </div>;
}

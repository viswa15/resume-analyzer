import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { Send, Square } from "lucide-react";
import { AppLayout, ErrorNote, LoadingState, Mascot, PageHeader, panel, quietButton } from "./resume-app";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { api, type ChatMessage } from "../lib/resume-api";
import { isUnauthorized, useAuth } from "../lib/auth";

function ChatBubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm ${mine ? "bg-brass text-primary-foreground" : "bg-raise text-foreground"}`}>
        {message.content}
      </div>
    </div>
  );
}

export function ChatPage() {
  const { id } = useParams({ strict: false });
  const { handleUnauthorized } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getChat(id)
      .then(setMessages)
      .catch((caught) => {
        if (isUnauthorized(caught)) {
          handleUnauthorized();
          return;
        }
        setLoadError(caught instanceof Error ? caught.message : "Could not load this conversation.");
      })
      .finally(() => setLoading(false));
  }, [handleUnauthorized, id]);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const submit = async () => {
    const content = question.trim();
    if (!id || !content || streaming) return;
    setQuestion("");
    setError(null);
    const stamp = Date.now();
    const answerId = `answer-${stamp}`;
    setMessages((current) => [
      ...current,
      { id: `local-${stamp}`, role: "user", content, created_at: new Date().toISOString() },
      { id: answerId, role: "assistant", content: "", created_at: new Date().toISOString() },
    ]);
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    try {
      await api.streamChat(
        id,
        content,
        (delta) => setMessages((current) => current.map((m) => (m.id === answerId ? { ...m, content: m.content + delta } : m))),
        controller.signal,
      );
    } catch (caught) {
      if (controller.signal.aborted) {
        // The user pressed Stop. The server does not save an interrupted answer.
        setMessages((current) => current.filter((m) => m.id !== answerId || m.content));
        setError("Stopped. That partial answer was not saved to your history.");
      } else {
        if (isUnauthorized(caught)) handleUnauthorized();
        setMessages((current) => current.filter((m) => m.id !== answerId || m.content));
        setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const waitingForFirstToken = streaming && messages[messages.length - 1]?.content === "";

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Resume assistant"
        title="Ask about this dossier"
        description="A grounded conversation for tailoring, interviewing, and deciding what to improve next."
        actions={
          id ? (
            <Button asChild variant="outline" className={quietButton}>
              <Link to="/resumes/$id" params={{ id }}>Back to dossier</Link>
            </Button>
          ) : undefined
        }
      />
      <section className={`${panel} mt-6 flex min-h-[560px] flex-col p-4 md:p-6`}>
        {loading ? (
          <LoadingState label="Restoring conversation…" />
        ) : loadError ? (
          <ErrorNote message={loadError} />
        ) : (
          <div className="flex-1 space-y-4 overflow-auto py-2" aria-live="polite">
            {messages.length ? (
              messages.filter((m) => m.content || m.role === "user").map((message) => <ChatBubble key={message.id} message={message} />)
            ) : (
              <div className="flex min-h-80 items-center justify-center text-center">
                <div>
                  <Mascot size={56} className="mx-auto" />
                  <h2 className="mt-4 font-display text-xl">Your resume is ready to discuss.</h2>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    Ask what to tailor for a role, which bullets need proof, or how to prepare for an interview.
                  </p>
                </div>
              </div>
            )}
            {waitingForFirstToken && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="pulse-dot size-1.5 rounded-full bg-brass" />
                <span className="pulse-dot size-1.5 rounded-full bg-brass [animation-delay:150ms]" />
                <span className="pulse-dot size-1.5 rounded-full bg-brass [animation-delay:300ms]" />
                Assistant is thinking…
              </div>
            )}
            <ErrorNote message={error} />
            <div ref={bottomRef} />
          </div>
        )}
        <form
          className="mt-4 flex gap-2 border-t border-border/60 pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about this resume"
            className="h-11 border-border/70 bg-raise"
          />
          {streaming ? (
            <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()} className={`h-11 ${quietButton}`} aria-label="Stop generating">
              <Square />
            </Button>
          ) : (
            <Button type="submit" disabled={!question.trim()} className="h-11 rounded-full bg-brass text-primary-foreground hover:bg-brass-lt" aria-label="Send message">
              <Send />
            </Button>
          )}
        </form>
      </section>
    </AppLayout>
  );
}

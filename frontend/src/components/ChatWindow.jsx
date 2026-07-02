import { useEffect, useRef, useState } from "react";
import { Message } from "./Message";
import { CvUpload } from "@/components/CvUpload";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Square, Loader2, Sparkles, Briefcase, FileText, ArrowUp } from "lucide-react";

export function ChatWindow({
  messages,
  isStreaming,
  agentStatus,
  threadId,
  onSendMessage,
  onStopStreaming,
  cvFilename,
  onCvUploaded,
  onPdfReady,
  loadingMessages,
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Loading skeleton while switching sessions and fetching messages from DB
  if (loadingMessages) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
        <p className="text-sm animate-pulse">Loading conversation...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-background min-w-0">
      {/* Messages Area */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl px-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/20">
                <Sparkles className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  How can I help you today?
                </h2>
                <p className="text-muted-foreground mt-2 text-sm max-w-md">
                  Search for jobs, generate a professional PDF resume, or tailor
                  your CV — all from one chat.
                </p>
              </div>

              <div className="mt-4 w-full max-w-lg space-y-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5" /> Job Search
                </p>
                {[
                  "Find seasonal student jobs in Manouba on optioncarriere.tn.",
                  "Search for remote Data Science jobs in Tunis on optioncarriere.tn.",
                ].map((s) => (
                  <button
                    key={s}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-all hover:bg-accent hover:text-foreground hover:shadow-sm"
                    onClick={() => onSendMessage(s)}
                  >
                    {s}
                  </button>
                ))}

                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-3">
                  <FileText className="h-3.5 w-3.5" /> Resume Generation
                </p>
                {[
                  cvFilename
                    ? `Tailor my uploaded CV (${cvFilename}) for a Data Science role at Elka Consulting.`
                    : "Build me a professional LaTeX resume for a Junior Data Scientist.",
                  "Create a resume PDF for a Full Stack Developer with 2 years experience.",
                ].map((s) => (
                  <button
                    key={s}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-all hover:bg-accent hover:text-foreground hover:shadow-sm"
                    onClick={() => onSendMessage(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1 py-6">
              {messages.map((msg) => (
                <Message key={msg.id} message={msg} onPdfReady={onPdfReady} />
              ))}

              {isStreaming && (
                <div className="flex items-center gap-2.5 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                  <span className="animate-pulse">
                    {agentStatus || "Processing..."}
                  </span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border bg-background">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <CvUpload threadId={threadId} onUploaded={onCvUploaded} />
          </div>
          <form
            onSubmit={handleSubmit}
            className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-ring focus-within:ring-1 focus-within:ring-ring transition-all"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message DeepAgent..."
              className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground min-h-[40px] max-h-[200px]"
              rows={1}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="h-9 w-9 shrink-0 rounded-xl"
                onClick={onStopStreaming}
              >
                <Square className="h-4 w-4 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim()}
                className="h-9 w-9 shrink-0 rounded-xl bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </form>
          <p className="text-center text-[11px] text-muted-foreground/60 mt-2">
            DeepAgent can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}

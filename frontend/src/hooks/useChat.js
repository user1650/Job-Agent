import { useState, useRef, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function useChat({ threadId, initialMessages = [], onAfterMessage }) {
  const [messages, setMessages] = useState(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);
  const abortRef = useRef(null);

  const sendMessage = useCallback(
    async (text) => {
      if (isStreaming) return;

      const userMsg = { id: crypto.randomUUID(), role: "user", content: text };
      const assistantId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      setIsStreaming(true);
      setAgentStatus("Thinking...");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`${API_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, thread_id: threadId }),
          signal: controller.signal,
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const payload = JSON.parse(line.slice(6));

              if (payload.type === "token") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + payload.content }
                      : m
                  )
                );
              } else if (payload.type === "pdf_url") {
                // New PDF compiled — open the preview panel
                setPdfUrl(payload.url);
                setAgentStatus("PDF ready!");
              } else if (payload.type === "tool_result") {
                const msg = payload.content || "";
                if (
                  msg.toLowerCase().includes("compil") ||
                  msg.toLowerCase().includes("latex")
                ) {
                  setAgentStatus("Compiling PDF in E2B sandbox...");
                } else {
                  setAgentStatus("Browsing complete! Formatting results...");
                }
              } else if (payload.type === "done") {
                setAgentStatus("");
                // Refresh the session list so title/order update
                onAfterMessage?.();
              } else if (payload.type === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: `❌ Error: ${payload.content}` }
                      : m
                  )
                );
              }
            } catch {}
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `❌ Connection error: ${err.message}` }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        setAgentStatus("");
      }
    },
    [isStreaming, threadId, onAfterMessage]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setAgentStatus("");
  }, []);

  /** Called when switching sessions — replace messages with loaded history. */
  const resetMessages = useCallback((newMessages) => {
    setMessages(newMessages || []);
    setPdfUrl(null);
  }, []);

  /** Called from CodeBlock "Render PDF" button to open the preview panel. */
  const openPdfPreview = useCallback((url) => {
    setPdfUrl(url);
  }, []);

  const closePdfPreview = useCallback(() => {
    setPdfUrl(null);
  }, []);

  return {
    messages,
    isStreaming,
    agentStatus,
    pdfUrl,
    sendMessage,
    stopStreaming,
    resetMessages,
    openPdfPreview,
    closePdfPreview,
  };
}

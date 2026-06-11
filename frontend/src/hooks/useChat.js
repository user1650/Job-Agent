import { useState, useRef, useCallback } from "react";

const API_URL = "http://localhost:8000";

export function useChat({ threadId, initialMessages = [], onMessagesChange }) {
  const [messages, setMessages] = useState(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const abortRef = useRef(null);

  // Sync messages with parent session
  const updateMessages = useCallback(
    (updater) => {
      setMessages((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        onMessagesChange?.(threadId, next);
        return next;
      });
    },
    [threadId, onMessagesChange]
  );

  const sendMessage = useCallback(
    async (text) => {
      if (isStreaming) return;

      const userMsg = { id: Date.now(), role: "user", content: text };
      const assistantId = Date.now() + 1;

      updateMessages((prev) => [
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
                updateMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + payload.content }
                      : m
                  )
                );
              } else if (payload.type === "tool_result") {
                const msg = payload.content || "";
                if (msg.toLowerCase().includes("compil") || msg.toLowerCase().includes("latex")) {
                  setAgentStatus("Compiling PDF in E2B sandbox...");
                } else {
                  setAgentStatus("Browsing complete! Formatting results...");
                }
              } else if (payload.type === "done") {
                setAgentStatus("");
              } else if (payload.type === "error") {
                updateMessages((prev) =>
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
          updateMessages((prev) =>
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
    [isStreaming, threadId, updateMessages]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setAgentStatus("");
  }, []);

  // Reset when session changes
  const resetMessages = useCallback((newMessages) => {
    setMessages(newMessages);
  }, []);

  return { messages, isStreaming, agentStatus, sendMessage, stopStreaming, resetMessages };
}

import { useEffect, useCallback, useState } from "react";
import { ThemeProvider } from "@/context/ThemeContext";
import { Sidebar } from "@/components/Sidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { useChat } from "@/hooks/useChat";
import { useSessions } from "@/hooks/useSessions";

function AppContent() {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
    updateSessionMessages,
    getActiveSession,
  } = useSessions();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cvFilename, setCvFilename] = useState("");

  const activeSession = getActiveSession();

  const handleMessagesChange = useCallback(
    (sessionId, messages) => {
      updateSessionMessages(sessionId, messages);
    },
    [updateSessionMessages]
  );

  const {
    messages,
    isStreaming,
    agentStatus,
    sendMessage,
    stopStreaming,
    resetMessages,
  } = useChat({
    threadId: activeSessionId || "",
    initialMessages: activeSession?.messages || [],
    onMessagesChange: handleMessagesChange,
  });

  // When switching sessions, reset messages to the new session's messages
  useEffect(() => {
    if (activeSession) {
      resetMessages(activeSession.messages || []);
    }
  }, [activeSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewSession = useCallback(() => {
    createSession();
  }, [createSession]);

  const handleDeleteSession = useCallback(
    async (id) => {
      try {
        await fetch(`http://localhost:8000/chat/${id}`, { method: "DELETE" }).catch(() => {});
      } catch {}
      deleteSession(id);
    },
    [deleteSession]
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewSession={handleNewSession}
        onSelectSession={setActiveSessionId}
        onDeleteSession={handleDeleteSession}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((p) => !p)}
      />
      <ChatWindow
        messages={messages}
        isStreaming={isStreaming}
        agentStatus={agentStatus}
        threadId={activeSessionId}
        onSendMessage={sendMessage}
        onStopStreaming={stopStreaming}
        cvFilename={cvFilename}
        onCvUploaded={setCvFilename}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

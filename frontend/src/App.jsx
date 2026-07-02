import { useEffect, useCallback, useState } from "react";
import { ThemeProvider } from "@/context/ThemeContext";
import { Sidebar } from "@/components/Sidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { PdfPreviewPanel } from "@/components/PdfPreviewPanel";
import { useChat } from "@/hooks/useChat";
import { useSessions } from "@/hooks/useSessions";

function AppContent() {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
    refreshSessions,
    loadingMessages,
    setOnSessionMessagesLoaded,
  } = useSessions();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cvFilename, setCvFilename] = useState("");

  const {
    messages,
    isStreaming,
    agentStatus,
    pdfUrl,
    sendMessage,
    stopStreaming,
    resetMessages,
    openPdfPreview,
    closePdfPreview,
  } = useChat({
    threadId: activeSessionId || "",
    initialMessages: [],
    onAfterMessage: refreshSessions,
  });

  // When the session hook loads messages from DB, inject them into the chat
  useEffect(() => {
    setOnSessionMessagesLoaded((msgs) => {
      resetMessages(msgs);
    });
  }, [setOnSessionMessagesLoaded, resetMessages]);

  const handleNewSession = useCallback(async () => {
    await createSession();
  }, [createSession]);

  const handleDeleteSession = useCallback(
    async (id) => {
      await deleteSession(id);
    },
    [deleteSession]
  );

  const handleSelectSession = useCallback(
    (id) => {
      if (id !== activeSessionId) {
        setActiveSessionId(id);
      }
    },
    [activeSessionId, setActiveSessionId]
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
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
        onPdfReady={openPdfPreview}
        loadingMessages={loadingMessages}
      />

      <PdfPreviewPanel url={pdfUrl} onClose={closePdfPreview} />
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

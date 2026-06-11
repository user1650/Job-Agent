import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "deepagent-sessions";
const ACTIVE_KEY = "deepagent-active-session";

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveSessions(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function useSessions() {
  const [sessions, setSessions] = useState(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState(
    () => localStorage.getItem(ACTIVE_KEY) || null
  );

  // Save sessions whenever they change
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  // Save active session ID
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(ACTIVE_KEY, activeSessionId);
    }
  }, [activeSessionId]);

  // Ensure there's always an active session
  useEffect(() => {
    if (!activeSessionId || !sessions.find((s) => s.id === activeSessionId)) {
      if (sessions.length > 0) {
        setActiveSessionId(sessions[0].id);
      } else {
        // Create initial session
        const id = crypto.randomUUID();
        const newSession = { id, title: "New Chat", createdAt: Date.now(), messages: [] };
        setSessions([newSession]);
        setActiveSessionId(id);
      }
    }
  }, [activeSessionId, sessions]);

  const createSession = useCallback(() => {
    const id = crypto.randomUUID();
    const newSession = { id, title: "New Chat", createdAt: Date.now(), messages: [] };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(id);
    return id;
  }, []);

  const deleteSession = useCallback(
    (id) => {
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (id === activeSessionId) {
          if (filtered.length > 0) {
            setActiveSessionId(filtered[0].id);
          } else {
            // Create a new session if we deleted the last one
            const newId = crypto.randomUUID();
            const newSession = { id: newId, title: "New Chat", createdAt: Date.now(), messages: [] };
            setActiveSessionId(newId);
            return [newSession];
          }
        }
        return filtered;
      });
    },
    [activeSessionId]
  );

  const updateSessionMessages = useCallback((sessionId, messages) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        // Auto-generate title from first user message
        const firstUserMsg = messages.find((m) => m.role === "user");
        const title = firstUserMsg
          ? firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? "..." : "")
          : s.title;
        return { ...s, messages, title };
      })
    );
  }, []);

  const getActiveSession = useCallback(() => {
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
    updateSessionMessages,
    getActiveSession,
  };
}

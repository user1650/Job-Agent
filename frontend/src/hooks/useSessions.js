import { useState, useCallback, useEffect, useRef } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * useSessions — manages chat sessions via the backend SQLite API.
 * localStorage is no longer used for session persistence.
 */
export function useSessions() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  // Callback ref: called when we need to load messages for a session into the chat
  const onSessionMessagesLoadedRef = useRef(null);

  // ──────────────────────────────────────────────────────
  // Load sessions from API on mount
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadSessions() {
      try {
        const res = await fetch(`${API_URL}/sessions`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setSessions(data);
        if (data.length > 0) {
          setActiveSessionId(data[0].id);
        } else {
          // Create the first session
          const newSession = await _createSessionAPI("New Chat");
          if (!cancelled && newSession) {
            setSessions([newSession]);
            setActiveSessionId(newSession.id);
          }
        }
      } catch (err) {
        console.error("[useSessions] Failed to load sessions:", err);
      }
    }
    loadSessions();
    return () => { cancelled = true; };
  }, []);

  // ──────────────────────────────────────────────────────
  // Load messages whenever active session changes
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeSessionId) return;
    let cancelled = false;

    async function loadMessages() {
      setLoadingMessages(true);
      try {
        const res = await fetch(`${API_URL}/sessions/${activeSessionId}/messages`);
        if (!res.ok || cancelled) return;
        const messages = await res.json();
        if (!cancelled) {
          onSessionMessagesLoadedRef.current?.(messages);
        }
      } catch (err) {
        console.error("[useSessions] Failed to load messages:", err);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    loadMessages();
    return () => { cancelled = true; };
  }, [activeSessionId]);

  // ──────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────
  async function _createSessionAPI(title = "New Chat") {
    try {
      const res = await fetch(`${API_URL}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────
  const createSession = useCallback(async () => {
    const newSession = await _createSessionAPI("New Chat");
    if (!newSession) return null;
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    return newSession.id;
  }, []);

  const deleteSession = useCallback(
    async (id) => {
      try {
        await fetch(`${API_URL}/sessions/${id}`, { method: "DELETE" });
      } catch {}
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (id === activeSessionId) {
          if (filtered.length > 0) {
            setActiveSessionId(filtered[0].id);
          } else {
            // Create a brand new session
            _createSessionAPI("New Chat").then((s) => {
              if (s) {
                setSessions([s]);
                setActiveSessionId(s.id);
              }
            });
            return [];
          }
        }
        return filtered;
      });
    },
    [activeSessionId]
  );

  /**
   * Called after each message by the chat to refresh the session list
   * so the title and updated_at are kept current.
   */
  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/sessions`);
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data);
    } catch {}
  }, []);

  /**
   * Register a callback that fires whenever messages for the active session
   * are fetched from the backend. Used by App.jsx to inject messages into useChat.
   */
  const setOnSessionMessagesLoaded = useCallback((fn) => {
    onSessionMessagesLoadedRef.current = fn;
  }, []);

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
    refreshSessions,
    loadingMessages,
    setOnSessionMessagesLoaded,
  };
}

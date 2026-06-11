import { useTheme } from "@/context/ThemeContext";
import {
  Plus,
  MessageSquare,
  Trash2,
  Sun,
  Moon,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  Bot,
} from "lucide-react";

export function Sidebar({
  sessions,
  activeSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  isOpen,
  onToggle,
}) {
  const { theme, toggleTheme } = useTheme();

  // Collapsed mini-sidebar
  if (!isOpen) {
    return (
      <div className="flex h-full w-[52px] flex-col items-center border-r border-border bg-card py-3 gap-2 shrink-0">
        <button
          onClick={onToggle}
          title="Open sidebar"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <button
          onClick={onNewSession}
          title="New chat"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
        >
          <Plus className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  // Group sessions by date
  const now = Date.now();
  const oneDayMs = 86400000;
  const today = [], yesterday = [], older = [];
  sessions.forEach((s) => {
    const age = now - s.createdAt;
    if (age < oneDayMs) today.push(s);
    else if (age < 2 * oneDayMs) yesterday.push(s);
    else older.push(s);
  });

  function SessionItem({ session }) {
    const isActive = session.id === activeSessionId;
    return (
      <div
        className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors select-none ${
          isActive
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        }`}
        onClick={() => onSelectSession(session.id)}
      >
        <MessageSquare
          className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-violet-500" : "opacity-50"}`}
        />
        <span className="flex-1 truncate pr-5 text-[13px]">{session.title}</span>
        {/* Delete button — absolute so it doesn't affect layout */}
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteSession(session.id);
          }}
          title="Delete chat"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  function SectionLabel({ label }) {
    return (
      <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {label}
      </p>
    );
  }

  return (
    <div className="flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold text-sm tracking-tight">DeepAgent</span>
        </div>
        <button
          onClick={onToggle}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="px-3 py-2.5">
        <button
          onClick={onNewSession}
          className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-border bg-background/50 px-3 py-2.5 text-sm text-muted-foreground transition-all hover:border-violet-500/50 hover:text-foreground hover:bg-accent/50"
        >
          <Plus className="h-4 w-4 text-violet-500" />
          <span className="font-medium">New Chat</span>
        </button>
      </div>

      {/* Session List — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 px-1.5">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Bot className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">No conversations yet</p>
          </div>
        ) : (
          <div className="pb-2">
            {today.length > 0 && (
              <>
                <SectionLabel label="Today" />
                {today.map((s) => <SessionItem key={s.id} session={s} />)}
              </>
            )}
            {yesterday.length > 0 && (
              <>
                <SectionLabel label="Yesterday" />
                {yesterday.map((s) => <SessionItem key={s.id} session={s} />)}
              </>
            )}
            {older.length > 0 && (
              <>
                <SectionLabel label="Older" />
                {older.map((s) => <SessionItem key={s.id} session={s} />)}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom — Theme Toggle */}
      <div className="border-t border-border px-3 py-3">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {theme === "dark" ? (
            <>
              <Sun className="h-4 w-4" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

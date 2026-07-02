"""
FastAPI backend — LangGraph agent via SSE streaming + SQLite session management.
Run with: python api.py
"""
import asyncio
import json
import re
import sys
import uuid
import os
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from sse_starlette.sse import EventSourceResponse

from graph import get_graph
from store import cv_store, parse_cv_file
from db import (
    create_session,
    list_sessions,
    update_session_title,
    delete_session as db_delete_session,
    session_exists,
    touch_session,
)

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

load_dotenv()

# Ensure static/resumes directory exists for compiled PDFs
RESUMES_DIR = Path("static/resumes")
RESUMES_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="DeepAgent API")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve compiled PDFs as static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# One shared graph instance
_graph = None


def get_shared_graph():
    global _graph
    if _graph is None:
        _graph = get_graph()
    return _graph


# ──────────────────────────────────────────────────────────────
# Pydantic models
# ──────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    thread_id: str = ""


class CompileRequest(BaseModel):
    latex: str


class CreateSessionRequest(BaseModel):
    id: str = ""
    title: str = "New Chat"


class UpdateTitleRequest(BaseModel):
    title: str


# ──────────────────────────────────────────────────────────────
# Session endpoints
# ──────────────────────────────────────────────────────────────

@app.get("/sessions")
async def get_sessions():
    """List all sessions ordered by last activity."""
    return list_sessions()


@app.post("/sessions", status_code=201)
async def post_session(req: CreateSessionRequest):
    """Create a new session. Optionally provide a specific id."""
    session_id = req.id or str(uuid.uuid4())
    if session_exists(session_id):
        raise HTTPException(status_code=409, detail="Session already exists")
    return create_session(session_id, req.title)


@app.put("/sessions/{session_id}/title")
async def put_session_title(session_id: str, req: UpdateTitleRequest):
    if not session_exists(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    update_session_title(session_id, req.title)
    return {"status": "updated"}


@app.delete("/sessions/{session_id}")
async def delete_session_endpoint(session_id: str):
    """Delete a session and its LangGraph checkpoints."""
    if session_id in cv_store:
        del cv_store[session_id]
    db_delete_session(session_id)
    return {"status": "deleted", "id": session_id}


@app.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str):
    """
    Return chat messages for a session by replaying the LangGraph state.
    Each message is {role: 'user'|'assistant', content: str}.
    """
    graph = get_shared_graph()
    config = {"configurable": {"thread_id": session_id}}
    try:
        state = graph.get_state(config)
        raw_messages = state.values.get("messages", []) if state.values else []
    except Exception:
        raw_messages = []

    messages = []
    for m in raw_messages:
        role = "user" if getattr(m, "type", "") == "human" else "assistant"
        content = getattr(m, "content", "") or ""
        # Skip tool call messages (empty content or ToolMessage type)
        if getattr(m, "type", "") in ("tool", "tool_call"):
            continue
        if isinstance(content, list):
            # Handle multi-part content (e.g. tool use blocks)
            text_parts = [c.get("text", "") for c in content if isinstance(c, dict)]
            content = " ".join(text_parts)
        if content:
            messages.append({"id": str(uuid.uuid4()), "role": role, "content": content})
    return messages


# ──────────────────────────────────────────────────────────────
# Chat endpoint (SSE streaming)
# ──────────────────────────────────────────────────────────────

PDF_URL_RE = re.compile(r"PDF_URL:\s*(https?://\S+\.pdf)")


@app.post("/chat")
async def chat(req: ChatRequest):
    thread_id = req.thread_id or str(uuid.uuid4())
    graph = get_shared_graph()
    config = {"configurable": {"thread_id": thread_id}}

    # Auto-create session in DB if it doesn't exist yet
    if not session_exists(thread_id):
        title = req.message[:40] + ("..." if len(req.message) > 40 else "")
        create_session(thread_id, title)

    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    async def event_generator():
        try:
            async for chunk in graph.astream(
                {"messages": [("user", req.message)]},
                config=config,
                stream_mode="messages",
            ):
                msg, metadata = chunk
                # Only stream AI text tokens (not tool messages)
                if msg.type == "AIMessageChunk" and msg.content:
                    data = json.dumps({"type": "token", "content": msg.content})
                    yield {"data": data}
                elif msg.type == "ToolMessage":
                    content = msg.content or ""
                    # Check if a PDF was compiled — extract the URL and emit a dedicated event
                    pdf_match = PDF_URL_RE.search(content)
                    if pdf_match:
                        pdf_url = pdf_match.group(1)
                        yield {"data": json.dumps({"type": "pdf_url", "url": pdf_url})}
                        status = "Resume compiled! Preparing download link..."
                    elif "pdf" in content.lower() or "latex" in content.lower() or "compil" in content.lower():
                        status = "Resume compiled! Preparing download link..."
                    else:
                        status = "Agent finished browsing!"
                    yield {"data": json.dumps({"type": "tool_result", "content": status})}

            # Touch the session's updated_at so it floats to the top
            touch_session(thread_id)

            # Auto-update title from first user message if still "New Chat"
            sessions = list_sessions()
            for s in sessions:
                if s["id"] == thread_id and s["title"] == "New Chat":
                    title = req.message[:40] + ("..." if len(req.message) > 40 else "")
                    update_session_title(thread_id, title)
                    break

            yield {"data": json.dumps({"type": "done", "thread_id": thread_id})}

        except Exception as e:
            yield {"data": json.dumps({"type": "error", "content": str(e)})}
            raise e

    return EventSourceResponse(event_generator())


# ──────────────────────────────────────────────────────────────
# Legacy DELETE /chat/{thread_id} kept for compatibility
# ──────────────────────────────────────────────────────────────

@app.delete("/chat/{thread_id}")
async def clear_chat(thread_id: str):
    """Clear CV store and DB session for a thread."""
    if thread_id in cv_store:
        del cv_store[thread_id]
    db_delete_session(thread_id)
    return {"status": "cleared", "thread_id": thread_id}


# ──────────────────────────────────────────────────────────────
# Manual compile endpoint
# ──────────────────────────────────────────────────────────────

@app.post("/compile")
async def compile_latex(req: CompileRequest):
    try:
        from graph import compile_resume_pdf
        result = compile_resume_pdf.invoke({"latex_code": req.latex, "filename": "manual_resume"})
        return {"message": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────────
# CV Upload
# ──────────────────────────────────────────────────────────────

@app.post("/upload-cv/{thread_id}")
async def upload_cv(thread_id: str, file: UploadFile = File(...)):
    content = await file.read()
    text = parse_cv_file(file.filename, content)

    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from the file.")

    cv_store[thread_id] = {
        "filename": file.filename,
        "text": text,
    }

    return {
        "filename": file.filename,
        "characters": len(text),
        "preview": text[:200] + "..." if len(text) > 200 else text,
    }


# ──────────────────────────────────────────────────────────────
# Health
# ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    from hypercorn.config import Config
    from hypercorn.asyncio import serve
    import asyncio

    config = Config()
    config.bind = ["0.0.0.0:8000"]

    asyncio.run(serve(app, config))

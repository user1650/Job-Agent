"""
FastAPI backend that exposes the LangGraph agent via SSE streaming.
Run with: python api.py
"""
import asyncio
import json
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

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

load_dotenv()

# Ensure static/resumes directory exists for compiled PDFs
RESUMES_DIR = Path("static/resumes")
RESUMES_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="DeepAgent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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

class ChatRequest(BaseModel):
    message: str
    thread_id: str = ""

class CompileRequest(BaseModel):
    latex: str



@app.post("/chat")
async def chat(req: ChatRequest):
    thread_id = req.thread_id or str(uuid.uuid4())
    graph = get_shared_graph()
    config = {"configurable": {"thread_id": thread_id}}

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
                    # Detect which tool just finished based on content
                    content = msg.content or ""
                    if "pdf" in content.lower() or "latex" in content.lower() or "compil" in content.lower():
                        status = "Resume compiled! Preparing download link..."
                    else:
                        status = "Agent finished browsing!"
                    data = json.dumps({"type": "tool_result", "content": status})
                    yield {"data": data}

            yield {"data": json.dumps({"type": "done", "thread_id": thread_id})}

        except Exception as e:
            yield {"data": json.dumps({"type": "error", "content": str(e)})}
            raise e

    return EventSourceResponse(event_generator())


@app.delete("/chat/{thread_id}")
async def clear_chat(thread_id: str):
    """Clear the conversation memory for a thread."""
    if thread_id in cv_store:
        del cv_store[thread_id]
    return {"status": "cleared", "thread_id": thread_id}

@app.post("/compile")
async def compile_latex(req: CompileRequest):
    try:
        from graph import compile_resume_pdf
        result = compile_resume_pdf.invoke({"latex_code": req.latex, "filename": "manual_resume"})
        return {"message": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload-cv/{thread_id}")
async def upload_cv(thread_id: str, file: UploadFile = File(...)):
    content = await file.read()
    text = parse_cv_file(file.filename, content)
    
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from the file.")
        
    cv_store[thread_id] = {
        "filename": file.filename,
        "text": text
    }
    
    return {
        "filename": file.filename,
        "characters": len(text),
        "preview": text[:200] + "..." if len(text) > 200 else text
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    from hypercorn.config import Config
    from hypercorn.asyncio import serve
    import asyncio

    config = Config()
    config.bind = ["127.0.0.1:8000"]

    asyncio.run(serve(app, config))

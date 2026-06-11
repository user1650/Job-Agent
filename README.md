# DeepAgent — AI Job Hunter & Resume Builder

> An intelligent, full-stack AI agent that hunts for jobs and generates professional PDF resumes — all from a single chat interface.

![Stack](https://img.shields.io/badge/LangGraph-ReAct_Agent-7c3aed?style=flat-square)
![Stack](https://img.shields.io/badge/E2B-Cloud_Sandbox-10b981?style=flat-square)
![Stack](https://img.shields.io/badge/FastAPI-SSE_Streaming-009688?style=flat-square)
![Stack](https://img.shields.io/badge/React_+_Vite-Frontend-61dafb?style=flat-square)

---

## What It Does

DeepAgent is a conversational AI agent with **three core capabilities**:

| Capability | Description |
|---|---|
| 🔍 **Job Scraping** | Launches a real browser to scrape live job listings from any job board based on your exact criteria |
| 📄 **Resume Generation** | Generates a professional ATS-friendly LaTeX resume and compiles it to a PDF |
| 📎 **CV Tailoring** | Upload your existing CV (PDF/DOCX/TXT) and the agent rewrites and tailors it to a specific job description |

The agent has **self-healing LaTeX compilation** — if the LaTeX code fails to compile, it reads the error output and automatically fixes and retries until the PDF is produced.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React Frontend                        │
│   Sidebar (sessions) · ChatGPT-style UI · Dark/Light mode   │
└───────────────────────────┬─────────────────────────────────┘
                            │ SSE Streaming (FastAPI)
┌───────────────────────────▼─────────────────────────────────┐
│                     FastAPI Backend (api.py)                  │
│        /chat · /compile · /upload-cv · /static               │
└───────────────────────────┬─────────────────────────────────┘
                            │ LangGraph ReAct Agent
┌───────────────────────────▼─────────────────────────────────┐
│                   LangGraph Agent (graph.py)                  │
│  ┌──────────────┐  ┌────────────────────┐  ┌─────────────┐  │
│  │  scrape_jobs │  │ compile_resume_pdf │  │ get_cv_data │  │
│  └──────┬───────┘  └────────┬───────────┘  └──────┬──────┘  │
│         │                   │                      │         │
│  browser-use Agent    E2B Cloud Sandbox       In-memory store│
│  (Chromium browser)  (Pre-built LaTeX env)   (per session)  │
└─────────────────────────────────────────────────────────────┘
```

### Key Technical Components

| Layer | Technology | Role |
|---|---|---|
| **LLM** | OpenRouter → GPT-4o | Powers the ReAct reasoning agent |
| **Agent Framework** | LangGraph (`create_react_agent`) | Manages tool calling and memory |
| **Browser Automation** | `browser-use` + Playwright/Chromium | Scrapes live job boards |
| **PDF Compilation** | E2B Cloud Sandbox (custom template) | Runs `pdflatex` in a secure cloud VM |
| **API** | FastAPI + Hypercorn + SSE | Streams tokens in real-time to the client |
| **Frontend** | React + Vite + Shadcn UI + Tailwind CSS v3 | Chat interface with session history |

---

## Features

### 🤖 Agent
- **ReAct pattern** — agent reasons, calls tools, observes results, iterates
- **Persistent memory** via LangGraph `MemorySaver` (per session thread)
- **Self-healing PDF compilation** — reads LaTeX errors and auto-fixes until success
- **Strict prompting** — always compiles PDFs directly, never dumps raw LaTeX on the user

### 🖥️ Frontend (ChatGPT-style)
- **Sidebar with session history** — all conversations persisted in `localStorage`
- **Dark / Light mode** toggle — preference saved to `localStorage`
- **Auto-resizing textarea** for composing messages
- **Copy button** on every code block
- **"Render PDF" button** on LaTeX code blocks — sends code to E2B and opens the compiled PDF
- **PDF download card** — displayed prominently when a resume is ready
- **CV upload indicator** in the header

### ⚡ Backend
- **Server-Sent Events (SSE)** for real-time token streaming
- **Static file serving** — compiled PDFs served from `/static/resumes/`
- **`/compile` endpoint** — manually compile any LaTeX code via the frontend button
- **`/upload-cv/{thread_id}`** — upload CV per session, parsed from PDF, DOCX or TXT

### 🐳 E2B Custom Template
- Pre-built Docker image with `texlive-full` installed
- Template built once and reused (no cold-start package installation)
- Template ID stored in `.env` as `E2B_TEMPLATE_ID`
- Rebuild at any time with `python build_template.py`

---

## Requirements

- **Python 3.11+**
- **Node.js 18+**
- An **[OpenRouter](https://openrouter.ai/)** account (for GPT-4o access)
- An **[E2B](https://e2b.dev/)** account (for cloud sandbox PDF compilation)

---

## Setup

### 1. Clone & Configure Environment

```powershell
git clone <your-repo-url>
cd deepagent
```

Copy the example env file and fill in your keys:

```powershell
cp .env.example .env
```

Edit `.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx
E2B_API_KEY=e2b_xxxxxxxxxxxxxxxxxxxx
E2B_TEMPLATE_ID=                        # Leave blank initially, see step 4
```

### 2. Backend Setup

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -r requirements.txt
playwright install chromium
```

### 3. Frontend Setup

```powershell
cd frontend
npm install
```

### 4. Build the E2B LaTeX Template (one-time)

This builds a custom cloud sandbox with `texlive` pre-installed so PDF compilation is fast:

```powershell
# In project root (with venv activated)
python build_template.py
```

The script will print a **Template ID** and automatically write it to your `.env` file.

> **Note:** This only needs to be run once. The template is stored in your E2B account permanently.

---

## Running the Application

You need two terminals — one for the backend, one for the frontend.

### Terminal 1 — Backend

```powershell
# From project root, with .venv activated
python api.py
```

Backend runs on **http://localhost:8000**

### Terminal 2 — Frontend

```powershell
cd frontend
npm run dev
```

Frontend runs on **http://localhost:5173**

---

## Usage Guide

### Job Search
1. Open the app and type your job search request, e.g.:
   > *"Find seasonal student jobs in Manouba on optioncarriere.tn"*
2. The agent will ask clarifying questions if needed (website, location, filters)
3. A real browser opens and scrapes matching listings
4. Results are returned as a formatted Markdown table with apply links

### Resume Generation
1. Type your request, e.g.:
   > *"Build me a professional LaTeX resume for a Junior Data Scientist"*
2. The agent collects your details and generates a LaTeX document
3. It automatically compiles it using the E2B sandbox
4. A **Download PDF** card appears in the chat with a direct link

### CV Tailoring
1. Click **Upload CV** and select your existing resume (PDF, DOCX, or TXT)
2. Ask the agent to tailor it:
   > *"Tailor my uploaded CV for a Data Science role at Elka Consulting"*
3. The agent reads your CV, rewrites it in LaTeX optimized for that role, compiles it, and delivers the PDF

---

## Project Structure

```
deepagent/
├── api.py                  # FastAPI server — /chat, /compile, /upload-cv
├── graph.py                # LangGraph agent — tools and system prompt
├── store.py                # In-memory CV store + file parsers
├── build_template.py       # E2B template builder (run once)
├── requirements.txt        # Python dependencies
├── .env                    # Secrets (not committed)
├── .env.example            # Template for secrets
├── template/
│   └── e2b.Dockerfile      # Custom E2B sandbox with texlive
├── static/
│   └── resumes/            # Compiled PDF output (auto-created)
└── frontend/
    └── src/
        ├── App.jsx                     # Root — layout, session wiring
        ├── context/ThemeContext.jsx    # Dark/light mode provider
        ├── hooks/
        │   ├── useChat.js              # SSE streaming chat logic
        │   └── useSessions.js          # Session CRUD + localStorage
        └── components/
            ├── Sidebar.jsx             # ChatGPT-style session sidebar
            ├── ChatWindow.jsx          # Main chat area
            ├── Message.jsx             # Message renderer (Markdown, LaTeX, PDF)
            └── CvUpload.jsx            # CV file uploader
```

---

## Adding Shadcn UI Components

Navigate to the `frontend` directory and use the Shadcn CLI:

```powershell
cd frontend
npx shadcn@latest add <component-name>
```

**Currently installed:** `button`, `input`, `card`, `scroll-area`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | ✅ Yes | Your OpenRouter API key for LLM access |
| `E2B_API_KEY` | ✅ Yes | Your E2B API key for cloud sandbox |
| `E2B_TEMPLATE_ID` | ✅ Yes | Pre-built E2B template ID (from `build_template.py`) |

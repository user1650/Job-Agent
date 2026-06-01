# DeepAgent Job Hunter

An intelligent LangGraph-powered AI Agent that acts as your personal job hunting assistant. DeepAgent chats with you to understand your exact career goals (role, location, strict contract filters) and then automatically launches a headless Chromium browser using `browser-use` to scrape relevant job postings from the web.

## Agent Graph

![DeepAgent LangGraph Architecture](graph_image.png)

## Features

- 🧠 **LangGraph Orchestration**: Uses a Human-in-the-Loop ReAct agent that asks clarifying questions before launching the scraping workflow.
- 🌐 **Browser Automation**: Uses `browser-use` to intelligently navigate complex job boards (like optioncarriere.tn, Indeed, etc.) without writing manual scraping rules.
- 💬 **Streamlit UI**: A clean, real-time interactive chat interface.
- 💻 **CLI Mode**: A fast terminal-based chat loop for developers.
- 🛡️ **API Rate Limiting**: Built-in safeguards to cap scraping results at 10 to prevent excessive OpenRouter token usage.

## Requirements

Use Python 3.11 or newer.

## Setup

1. **Create and activate the virtual environment:**

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

2. **Install the dependencies:**

```powershell
pip install -r requirements.txt
playwright install chromium
```

3. **Configure the Environment:**

Copy the example environment file and add your [OpenRouter API key](https://openrouter.ai/):

```powershell
cp .env.example .env
```

Open `.env` and configure your key:
```env
OPENROUTER_API_KEY="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

## Running the App

### Option 1: Streamlit Web UI (Recommended)
Launch the interactive web chat interface:
```powershell
streamlit run app.py
```

### Option 2: CLI Chat Mode
Run the LangGraph agent directly in your terminal:
```powershell
python graph.py
```

## How It Works

1. You describe the jobs you are looking for (e.g., *"I'm a student looking for a 3-month seasonal job in Tunis. No CDD or CDI."*).
2. The agent analyzes your prompt. If you missed a crucial detail (like which website to search), it will ask you.
3. Once the agent fully understands the task, it formulates a precise query and invokes the `scrape_jobs` tool.
4. `browser-use` takes over, opens Chromium, navigates the site, extracts the matching jobs, and returns them to the agent.
5. The agent formats the results into a clean Markdown table in your chat!

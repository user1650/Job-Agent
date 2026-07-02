import os
import uuid
from pathlib import Path
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from browser_use import Agent, Browser, ChatOpenAI as BrowserUseChatOpenAI
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.sqlite import SqliteSaver
from db import DB_PATH

RESUMES_DIR = Path("static/resumes")
RESUMES_DIR.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────────────────────
# Tool 1: Web scraping via browser-use
# ─────────────────────────────────────────────────────────────
@tool
async def scrape_jobs(task_description: str) -> str:
    """
    Executes a web scraping agent to find jobs based on the provided detailed task description.
    Use this tool ONLY after you have fully clarified the user's requirements (website, job title, location, filters).
    """
    print(f"\n[Tool] Launching browser-use Agent with task:\n{task_description}\n")
    browser = Browser(headless=False)

    agent_llm = BrowserUseChatOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        model="openai/gpt-4o",
    )

    agent = Agent(task=task_description, llm=agent_llm, browser=browser)
    history = await agent.run()
    await browser.close()

    result = history.final_result()
    if not result:
        return "The agent failed to extract the jobs or encountered an error."
    return result


# ─────────────────────────────────────────────────────────────
# Tool 2: LaTeX resume compiler via E2B Sandbox
# ─────────────────────────────────────────────────────────────
@tool
def compile_resume_pdf(latex_code: str, filename: str = "resume") -> str:
    """
    Compiles a LaTeX document into a PDF using a secure E2B cloud sandbox.
    Accepts the full LaTeX source code as a string.
    Returns the local URL to download the compiled PDF.
    Use this tool when the user wants to generate or export a resume as a PDF.
    """
    from e2b import Sandbox

    print(f"\n[Tool] Launching E2B Sandbox to compile LaTeX resume: {filename}.pdf\n")

    api_key = os.getenv("E2B_API_KEY")
    if not api_key:
        return "Error: E2B_API_KEY is not set in the environment."

    template_id = os.getenv("E2B_TEMPLATE_ID")

    try:
        # Use custom template if provided, else default base template
        sandbox_kwargs = {"api_key": api_key}
        if template_id:
            sandbox_kwargs["template"] = template_id

        with Sandbox.create(**sandbox_kwargs) as sbx:
            # Write the .tex file into the sandbox
            sbx.files.write("resume.tex", latex_code)

            # Check if pdflatex is available, install if not (only needed if not using the custom template)
            if not template_id:
                check = sbx.commands.run("which pdflatex")
                if check.exit_code != 0:
                    print("[E2B] pdflatex not found, installing texlive-latex-base...")
                    install = sbx.commands.run(
                        "sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq texlive-latex-base texlive-fonts-recommended texlive-latex-extra",
                        timeout=300,
                    )
                    if install.exit_code != 0:
                        return f"Error: Failed to install LaTeX.\n{install.stderr}"

            # Run pdflatex twice to resolve references
            for i in range(2):
                result = sbx.commands.run(
                    "pdflatex -interaction=nonstopmode -halt-on-error resume.tex",
                    timeout=60,
                )

            if result.exit_code != 0:
                return f"LaTeX compilation failed. Error output:\n{result.stdout[-3000:]}"

            # Download the PDF bytes from the sandbox
            pdf_bytes = sbx.files.read("resume.pdf", format="bytes")

            # Save to local static/resumes directory
            safe_name = "".join(c for c in filename if c.isalnum() or c in ("-", "_"))
            unique_id = str(uuid.uuid4())[:8]
            output_filename = f"{unique_id}_{safe_name}.pdf"
            output_path = RESUMES_DIR / output_filename

            with open(output_path, "wb") as f:
                f.write(pdf_bytes)

            pdf_url = f"http://localhost:8000/static/resumes/{output_filename}"
            print(f"[E2B] PDF compiled successfully: {pdf_url}")
            # Use PDF_BASE_URL env var so Docker networking works correctly
            base_url = os.getenv("PDF_BASE_URL", "http://localhost:8000")
            pdf_url = f"{base_url}/static/resumes/{output_filename}"
            return (
                f"✅ Resume compiled successfully!\n\n"
                f"📄 **[Click here to download your PDF]({pdf_url})**\n\n"
                f"File: `{output_filename}`\n"
                f"PDF_URL: {pdf_url}"
            )

    except Exception as e:
        return f"Error during E2B compilation: {str(e)}"


# ─────────────────────────────────────────────────────────────
# Tool 3: Get Uploaded CV
# ─────────────────────────────────────────────────────────────
@tool
def get_uploaded_cv(config: RunnableConfig) -> str:
    """
    Retrieves the raw text of the user's uploaded CV (resume) for the current session.
    Use this tool when the user asks you to tailor or use their uploaded CV.
    """
    try:
        from store import cv_store
        thread_id = config.get("configurable", {}).get("thread_id")
        cv_data = cv_store.get(thread_id)
        if not cv_data:
            return "No CV uploaded for this session. Ask the user to upload one using the paperclip icon."
        return f"Filename: {cv_data['filename']}\n\nContent:\n{cv_data['text']}"
    except Exception as e:
        return f"Error retrieving CV: {e}"

# ─────────────────────────────────────────────────────────────
# LangGraph Agent Graph
# ─────────────────────────────────────────────────────────────
async def get_graph():
    llm = ChatOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        model="openai/gpt-4o",
    )

    import aiosqlite
    from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
    conn = await aiosqlite.connect(DB_PATH)
    memory = AsyncSqliteSaver(conn)
    await memory.setup()

    LATEX_TEMPLATE_RULES = """
## STRICT LATEX CV RULES — ALWAYS FOLLOW THESE:

### ONE PAGE RULE (NON-NEGOTIABLE)
- The resume MUST fit on exactly ONE page. No exceptions.
- Use these geometry settings: \\usepackage[top=0.4in, bottom=0.4in, left=0.5in, right=0.5in]{geometry}
- Font size: 10pt (use \\documentclass[10pt,a4paper]{article})
- Reduce \\parskip, \\itemsep, \\parsep to 0pt
- Use \\vspace{-6pt} between sections to compress vertical space
- If content is too long, summarize bullet points to 1 line each, remove older/less relevant entries

### ATS-FRIENDLY RULES
- Use ONLY standard LaTeX packages: geometry, hyperref, titlesec, enumitem, fontenc, inputenc, parskip
- NO tables, NO columns, NO minipages, NO text boxes, NO tikz, NO graphics
- Use plain \\section{} headings — NO fancy titlerule or colored rules
- Use \\begin{itemize} with \\item for bullet points
- ALL text must be machine-readable (no special symbols in key fields)
- Contact info on a single line at top, separated by | or ·
- Section order: Summary → Skills → Experience → Education → Projects → Certifications (adapt as needed)

### EXACT PREAMBLE TO USE:
\\documentclass[10pt,a4paper]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[top=0.4in, bottom=0.4in, left=0.5in, right=0.5in]{geometry}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{parskip}
\\setlength{\\parskip}{0pt}
\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\titlerule]
\\titlespacing{\\section}{0pt}{6pt}{4pt}
\\setlist[itemize]{leftmargin=*, noitemsep, topsep=2pt, parsep=0pt}
\\hypersetup{colorlinks=true, urlcolor=blue, linkcolor=black}
\\pagestyle{empty}

### BULLET POINT STYLE
- Start each bullet with a strong action verb (Developed, Built, Optimized, Led, Designed...)
- Include metrics where possible (e.g. "Reduced load time by 40%")
- Maximum 3 bullets per job entry to stay within one page
"""

    system_message = (
        "You are an expert Job Hunting & Resume Assistant. You have two capabilities:\n\n"

        "## CAPABILITY 1: Job Scraping\n"
        "You can search for jobs using the `scrape_jobs` tool. "
        "Before calling this tool, ALWAYS ask the user for:\n"
        "1. The target website URL (e.g. optioncarriere.tn)\n"
        "2. The job title or keywords\n"
        "3. The location\n"
        "4. Any constraints (e.g. 'seasonal only', 'no CDI/CDD', 'students only', 'remote')\n"
        "Instruct the scraper to extract a MAXIMUM of 10 results with: "
        "Job Title, Company Name, Location, Salary (if listed), and the EXACT URL to apply.\n"
        "Present results as a Markdown table with clickable links.\n\n"

        "## CAPABILITY 2: Resume PDF Generation & Tailoring\n"
        "You generate professional ONE-PAGE ATS-optimized LaTeX resumes.\n\n"

        + LATEX_TEMPLATE_RULES + "\n\n"

        "### WORKFLOW:\n"
        "If the user asks to tailor their *uploaded* CV:\n"
        "1. Call `get_uploaded_cv` to read their real resume text.\n"
        "2. Rewrite the resume in LaTeX following ALL the rules above strictly.\n"
        "3. CRITICAL: You MUST call `compile_resume_pdf` with the full LaTeX source. "
        "Do NOT output raw LaTeX code to the user — always compile it.\n"
        "4. If `compile_resume_pdf` returns a LaTeX error, read the error carefully, "
        "fix the code (self-healing), and call the tool again. Repeat until it succeeds.\n"
        "5. Present the clickable download link to the user.\n\n"
        "If they don't have an uploaded CV, collect their information first, "
        "then generate and compile the resume following ALL the rules above.\n\n"

        "Always be helpful and friendly. If the user is unclear, ask targeted clarifying questions."
    )


    graph = create_react_agent(
        llm,
        tools=[scrape_jobs, compile_resume_pdf, get_uploaded_cv],
        prompt=system_message,
        checkpointer=memory,
    )

    return graph


async def main():
    graph = get_graph()
    config = {"configurable": {"thread_id": "cli_session_1"}}

    print("🤖 Agent: Bonjour! Tell me what you're looking for.")
    while True:
        user_input = input("\nYou: ")
        if user_input.lower() in ['quit', 'exit', 'q']:
            break

        inputs = {"messages": [("user", user_input)]}
        print("🤖 Agent:", end=" ", flush=True)

        response = await graph.ainvoke(inputs, config=config)
        print(response["messages"][-1].content)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())

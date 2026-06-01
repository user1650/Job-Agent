import asyncio
import os

from browser_use import Agent, Browser, ChatOpenAI
from dotenv import load_dotenv

load_dotenv()


async def run_agent(url: str, keyword: str, time_filter: str, num_results: int, model: str = "anthropic/claude-sonnet-latest") -> str:
    browser = Browser(headless=False)

    llm = ChatOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        model=model,
    )

    job_task = (
        f"Go to {url}. "
        f"Search for '{keyword}' jobs. "
        f"Filter the results for jobs posted in the '{time_filter}'. "
        f"Extract the top {num_results} job postings including: Job Title, Company Name, and the URL link to apply. "
        "CRITICAL: Only extract jobs that are strictly seasonal (saisonnier), for students (étudiant), or remote (télétravail). "
        "Do NOT extract any jobs that mention long-term contracts like CIVP, SIVP, CDD, or CDI. "
        "Provide the final output as a clean markdown table."
    )

    agent = Agent(task=job_task, llm=llm, browser=browser)
    history = await agent.run()
    
    await browser.close()
    
    return history.final_result()

async def main():
    print("Testing agent with strict student/seasonal filters...")
    res = await run_agent(
        url="https://www.optioncarriere.tn/",
        keyword="emplois saisonnier etudiant teletravail",
        time_filter="Any time",
        num_results=25,
        model="openai/gpt-4o"
    )
    print(res.encode('utf-8', errors='replace').decode('utf-8'))

if __name__ == "__main__":
    asyncio.run(main())

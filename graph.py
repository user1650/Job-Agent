import os
from langchain_core.tools import tool
from browser_use import Agent, Browser, ChatOpenAI as BrowserUseChatOpenAI
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

@tool
async def scrape_jobs(task_description: str) -> str:
    """
    Executes a web scraping agent to find jobs based on the provided detailed task description.
    Use this tool ONLY after you have fully clarified the user's requirements (website, job title, location, filters).
    """
    print(f"\n[Tool] Launching browser-use Agent with task:\n{task_description}\n")
    browser = Browser(headless=False)
    
    # The internal LLM that actually controls the browser
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

def get_graph():
    # The orchestration LLM that chats with the user
    llm = ChatOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        model="openai/gpt-4o",
    )
    
    memory = MemorySaver()
    
    system_message = (
        "You are an intelligent Job Hunting Assistant. "
        "Your goal is to help the user scrape job listings using the `scrape_jobs` tool. "
        "CRITICAL INSTRUCTION: Before calling the tool, you MUST ask the user clarifying questions "
        "if their request is vague. Make sure you understand (comprendre): \n"
        "1. The target website URL or name.\n"
        "2. The specific job title or keywords.\n"
        "3. The location.\n"
        "4. Any specific constraints (e.g., 'seasonal only', 'no CDD/CDI', 'students only').\n\n"
        "Do NOT guess these parameters. Ask the user! Once you have all the information, "
        "formulate a highly detailed task description and call the `scrape_jobs` tool. "
        "IMPORTANT: To prevent hitting API limits, explicitly instruct the scraper to extract a MAXIMUM of 10 results. "
        "CRITICAL: You MUST explicitly instruct the scraper to extract the following details for EVERY job: "
        "1. Job Title\n2. Company Name\n3. Location\n4. Salary (if listed)\n5. The EXACT URL LINK to apply. "
        "When the tool returns the results, present them nicely to the user as a Markdown table including the clickable links."
    )
    
    graph = create_react_agent(
        llm, 
        tools=[scrape_jobs], 
        prompt=system_message,
        checkpointer=memory
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

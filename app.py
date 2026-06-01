import asyncio
import os
import sys
import streamlit as st
from dotenv import load_dotenv

from graph import get_graph
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv()

st.set_page_config(
    page_title="DeepAgent · LangGraph Chat",
    page_icon="💬",
    layout="centered"
)

st.title("💬 DeepAgent Job Scraper")
st.markdown("Chat with the agent. It will ask clarifying questions, and once it understands your request, it will launch the browser to scrape the jobs!")

import uuid

# Initialize the graph
if "graph" not in st.session_state:
    st.session_state.graph = get_graph()
    
# Thread ID for memory (unique per session to prevent hanging tool calls)
if "thread_id" not in st.session_state:
    st.session_state.thread_id = str(uuid.uuid4())
    
if "messages" not in st.session_state:
    st.session_state.messages = []

with st.sidebar:
    if st.button("🗑️ Clear Conversation & Start Fresh"):
        st.session_state.thread_id = str(uuid.uuid4())
        st.session_state.messages = []
        st.rerun()

# Display chat messages from history on app rerun
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# React to user input
if prompt := st.chat_input("E.g., Find me seasonal student jobs in Tunis on optioncarriere.tn"):
    
    # Check API Key
    if not os.getenv("OPENROUTER_API_KEY"):
        st.error("Please set OPENROUTER_API_KEY in your .env file.")
        st.stop()

    # Display user message in chat message container
    st.chat_message("user").markdown(prompt)
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})

    # Prepare configuration for memory
    config = {"configurable": {"thread_id": st.session_state.thread_id}}

    # Display assistant response in chat message container
    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        
        with st.spinner("Agent is thinking... (If it launches the browser, please wait!)"):
            
            if sys.platform == "win32":
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
                
            try:
                # Run the graph
                inputs = {"messages": [("user", prompt)]}
                
                # ainvoke to handle the async scrape tool seamlessly
                response = asyncio.run(st.session_state.graph.ainvoke(inputs, config=config))
                
                # The final message is the last AI message
                final_ai_message = response["messages"][-1].content
                
                message_placeholder.markdown(final_ai_message)
                st.session_state.messages.append({"role": "assistant", "content": final_ai_message})
                
            except Exception as e:
                st.error(f"Error: {str(e)}")


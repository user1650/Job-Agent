import os
import pydantic
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()
llm = ChatOpenAI(
    base_url='https://openrouter.ai/api/v1',
    api_key=os.getenv('OPENROUTER_API_KEY'),
    model='openai/gpt-4o'
)

class Output(pydantic.BaseModel):
    result: str

structured_llm = llm.with_structured_output(Output)
try:
    res = structured_llm.invoke('Say hello')
    print(repr(res))
except Exception as e:
    print(f"Error: {e}")

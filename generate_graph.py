"""
Generate a PNG image of the LangGraph agent graph and save it to graph_image.png
"""
from graph import get_graph

graph = get_graph()

# Generate the Mermaid PNG image
png_data = graph.get_graph().draw_mermaid_png()

with open("graph_image.png", "wb") as f:
    f.write(png_data)

print("Graph image saved to graph_image.png")

import io
import docx
import pypdf

# In-memory store for CV text per session
cv_store = {}

def parse_cv_file(filename: str, content: bytes) -> str:
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    text = ""
    try:
        if ext == "pdf":
            reader = pypdf.PdfReader(io.BytesIO(content))
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        elif ext == "docx":
            doc = docx.Document(io.BytesIO(content))
            for para in doc.paragraphs:
                text += para.text + "\n"
        else:
            # Assume TXT or simple text format
            text = content.decode("utf-8")
    except Exception as e:
        print(f"Error parsing CV: {e}")
        text = ""
    return text.strip()

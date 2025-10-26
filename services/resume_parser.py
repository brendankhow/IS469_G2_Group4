import PyPDF2
from typing import List, Dict, Optional

class ResumeParser:
    @staticmethod
    def extract_text_from_pdf(file_path: str) -> str:
        """Extract text from PDF resume"""
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text = ""
                for page in pdf_reader.pages:
                    text += page.extract_text()
                return text.strip()
        except Exception as e:
            raise Exception(f"Error parsing PDF: {str(e)}")
    
    @staticmethod
    def clean_text(text: str) -> str:
        """Basic text cleaning"""
        # Remove extra whitespace
        text = " ".join(text.split())
        return text
    
    @staticmethod
    def chunk_text(text: str, max_chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """Splits text into manageable chunks."""
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        chunks = []
        for p in paragraphs:
            if len(p) <= max_chunk_size:
                chunks.append(p)
            else:
                start = 0
                while start < len(p):
                    end = min(start + max_chunk_size, len(p))
                    chunks.append(p[start:end])
                    start += max_chunk_size - overlap
        return [c for c in chunks if c.strip()]
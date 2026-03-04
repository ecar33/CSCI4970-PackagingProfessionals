import os
from pdf2image import convert_from_path
import pytesseract


def extract_text_from_pdf(pdf_path):
    """Convert each page of a PDF to an image, then run OCR on it."""
    pages = convert_from_path(pdf_path, dpi=300)
    full_text = []
    for i, page in enumerate(pages):
        text = pytesseract.image_to_string(page)
        full_text.append(text)
    return "\n".join(full_text)


def process_all_orders(orders_dir):
    """Read every PDF in the orders directory and return extracted text."""
    results = {}
    if not os.path.isdir(orders_dir):
        return results
    for filename in os.listdir(orders_dir):
        if filename.lower().endswith(".pdf"):
            filepath = os.path.join(orders_dir, filename)
            results[filename] = extract_text_from_pdf(filepath)
    return results

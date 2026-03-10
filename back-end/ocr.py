import os
import re
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


def parse_boxes_from_text(text):
    """
    Parse OCR text from an order form and extract box sizes with quantities.


    Returns JSON of the form:
    {
      "file": "orderexample.PDF",
      "boxes": [
        {"box_size": "18x18x18", "count": 360}
      ]
    }
    """
    boxes = []
    # Match lines that contain a box dimension pattern like 18X18X18 or 12x10x6
    box_pattern = re.compile(
        r'(\d+)\s*[xX]\s*(\d+)\s*[xX]\s*(\d+)'
    )

    for line in text.split("\n"):
        match = box_pattern.search(line)
        if not match:
            continue

        # Normalize the box size to lowercase "DxDxD"
        box_size = f"{match.group(1)}x{match.group(2)}x{match.group(3)}"

        # The quantity received is the last number on the line
        all_numbers = re.findall(r'\d+', line)
        if not all_numbers:
            continue
        count = int(all_numbers[-1])

        boxes.append({"box_size": box_size, "count": count})

    return boxes


def process_order_pdf(pdf_path):
    """Run OCR on a PDF and return parsed box data as JSON-ready dict."""
    text = extract_text_from_pdf(pdf_path)
    boxes = parse_boxes_from_text(text)
    return {"file": os.path.basename(pdf_path), "boxes": boxes}


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

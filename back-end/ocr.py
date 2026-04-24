import os
import re

import pytesseract
from pdf2image import convert_from_path


def extract_text_from_pdf(pdf_path):
    """
    @brief Extract text from a PDF file using OCR. This function converts each page of the PDF into an image and then uses Tesseract to extract text from those images.

    @param pdf_path Path to the PDF file to process

    @return A string containing the extracted text from the PDF

    """
    pages = convert_from_path(pdf_path, dpi=300)
    full_text = []
    for i, page in enumerate(pages):
        text = pytesseract.image_to_string(page)
        full_text.append(text)
    return "\n".join(full_text)


def parse_boxes_from_text(text):
    """
    @brief Parse box size and quantity information from the extracted text. This function looks for lines that contain box dimension patterns (like "18X18X18" or "12x10x6") and extracts the box size and the quantity received, which is assumed to be the last number on the line.

    @param text The OCR-extracted text from which to parse box information

    @return A list of dictionaries, each containing "box_size" (normalized to lowercase "DxDxD") and "count" (the quantity received)
    """
    boxes = []
    # Match lines that contain a box dimension pattern like 18X18X18 or 12x10x6
    box_pattern = re.compile(r"(\d+)\s*[xX]\s*(\d+)\s*[xX]\s*(\d+)")

    for line in text.split("\n"):
        match = box_pattern.search(line)
        if not match:
            continue

        # Normalize the box size to lowercase "DxDxD"
        box_size = f"{match.group(1)}x{match.group(2)}x{match.group(3)}"

        # The quantity received is the last number on the line
        all_numbers = re.findall(r"\d+", line)
        if not all_numbers:
            continue
        count = int(all_numbers[-1])

        boxes.append({"box_size": box_size, "count": count})

    return boxes


def process_order_pdf(pdf_path):
    """
    @brief Process a single order PDF by extracting text and parsing box information. This function combines the OCR extraction and box parsing steps to return a structured result containing the filename and the list of boxes with their sizes and counts.

    @param pdf_path Path to the PDF file to process

    @return A dictionary containing the filename and a list of boxes, where each box is represented as a dictionary with "box_size" and "count" keys
    """
    text = extract_text_from_pdf(pdf_path)
    boxes = parse_boxes_from_text(text)
    return {"file": os.path.basename(pdf_path), "boxes": boxes}


def process_all_orders(orders_dir):
    """
    @brief Process all PDF files in the specified orders directory by running OCR and parsing box information for each file. This function iterates through all PDF files in the given directory, extracts text from each file, and parses the box data, returning a dictionary mapping filenames to their extracted text.

    @param orders_dir Path to the directory containing order PDF files

    @return A dictionary where each key is a PDF filename and the value is the extracted text from that PDF
    """
    results = {}
    if not os.path.isdir(orders_dir):
        return results
    for filename in os.listdir(orders_dir):
        if filename.lower().endswith(".pdf"):
            filepath = os.path.join(orders_dir, filename)
            results[filename] = extract_text_from_pdf(filepath)
    return results

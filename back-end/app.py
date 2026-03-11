from flask import Flask, jsonify, request
import logging
from ocr import extract_text_from_pdf, process_all_orders, parse_boxes_from_text, process_order_pdf
from csv_parser import parse_sales_csv
from watcher import start_watcher
from databasemake import init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///inv.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
init_db(app)

ORDERS_DIR = "/app/orders"
# Store OCR results in memory (replace with DB later)
ocr_results = {}

def on_new_order(filename, text, boxes):
    """Callback invoked when a new PDF is detected and processed."""
    ocr_results[filename] = {"text": text, "boxes": boxes}
    logger.info(f"Stored OCR result for {filename} ({len(text)} chars, {len(boxes)} box types)")
    # TODO: update SQL inventory table

@app.get("/api/health")
def health():
    return jsonify(status="ok")

@app.get("/api/ocr/orders")
def ocr_all_orders():
    """Run OCR on every PDF in the orders volume."""
    results = process_all_orders(ORDERS_DIR)
    return jsonify(results)

@app.get("/api/ocr/orders/<filename>")
def ocr_single_order(filename):
    """Run OCR on a specific PDF."""
    import os
    filepath = os.path.join(ORDERS_DIR, filename)
    if not os.path.isfile(filepath):
        return jsonify(error="File not found"), 404
    text = extract_text_from_pdf(filepath)
    return jsonify(filename=filename, text=text)

@app.get("/api/ocr/boxes/<filename>")
def ocr_boxes(filename):
    """Run OCR on a specific PDF and return only parsed box data."""
    import os
    filepath = os.path.join(ORDERS_DIR, filename)
    if not os.path.isfile(filepath):
        return jsonify(error="File not found"), 404
    result = process_order_pdf(filepath)
    return jsonify(result)

@app.post("/api/csv/upload")
def upload_csv():
    """Accept a CSV file upload and return parsed sales data as JSON."""
    if "file" not in request.files:
        return jsonify(error="No file provided"), 400
    file = request.files["file"]
    if not file.filename.lower().endswith(".csv"):
        return jsonify(error="File must be a .csv"), 400
    items = parse_sales_csv(file.stream)
    logger.info(f"Parsed uploaded CSV {file.filename} ({len(items)} items)")
    return jsonify({"file": file.filename, "items": items})

if __name__ == "__main__":
    # Start the file watcher before running the Flask app
    observer = start_watcher(ORDERS_DIR, on_new_order)
    try:
        app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
    finally:
        observer.stop()
        observer.join()

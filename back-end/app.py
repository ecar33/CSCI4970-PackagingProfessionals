from flask import Flask, jsonify, request
import logging
import os
from dotenv import load_dotenv
load_dotenv()
from ocr import extract_text_from_pdf, process_all_orders, parse_boxes_from_text, process_order_pdf
from csv_parser import parse_sales_csv
from watcher import start_watcher
from databasemake import db, init_db, Inventory, InventoryLog, log_inventory_change
from analytics import (
    get_usage_rate,
    get_time_to_empty,
    get_reorder_recommendation,
    get_all_analytics,
    get_inventory_history,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:////app/data/inv.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
init_db(app)

ORDERS_DIR = "/app/orders"
# Store OCR results in memory (replace with DB later)
ocr_results = {}

def serialize_inventory_item(item):
    """
        @brief Serialize an Inventory item to a JSON-friendly dictionary format for API responses.
    
        @param item Inventory model instance to serialize
    
        @return A dictionary containing the SKU, description, item quantity, and return quantity of the inventory item
        """
    return {
        "sku": item.sku,
        "description": item.description,
        "item_quantity": item.item_quantity,
        "return_quantity": item.return_quantity,
    }

def increment_inventory_from_boxes(boxes):
    """
        @brief Increment inventory counts based on parsed box data from OCR results. This function takes a list of boxes (each with a size and count), finds the corresponding inventory item by matching the box size in the description, and increments the item quantity accordingly.
    
        @param boxes A list of dictionaries, each containing "box_size" (e.g., "18x18x18") and "count" (quantity received) extracted from OCR parsing of order PDFs
        """
    with app.app_context():
        for box in boxes:
            box_size = box.get("box_size")
            count = int(box.get("count", 0))
            if not box_size or count <= 0:
                continue

            item = db.session.query(Inventory).filter(
                Inventory.description.ilike(f"%{box_size}%")
            ).first()

            if item is None:
                logger.warning(f"No inventory item found with '{box_size}' in description — skipping.")
                continue

            item.item_quantity += count
            log_inventory_change(
                sku=item.sku,
                change_type="order_in",
                quantity_change=count,
                quantity_after=item.item_quantity,
                note=f"OCR order: {box_size} x{count}",
            )
            logger.info(f"Incremented SKU {item.sku} ({item.description}) by {count}")

        db.session.commit()

def decrement_inventory_from_sales(items):
    """
        @brief Decrement inventory counts based on sales data parsed from an uploaded CSV file. This function takes a list of items (each with SKU, description, sales count, and return count), finds the corresponding inventory item by SKU, and updates the item quantity by decrementing sales and incrementing returns.
    
        @param items A list of dictionaries, each containing "sku", "description", "sales_count", and "return_count" parsed from the uploaded CSV file
        """
    for item_data in items:
        sku = item_data.get("sku")
        if not sku:
            continue

        sales_count = int(item_data.get("sales_count", 0))
        return_count = int(item_data.get("return_count", 0))
        item = db.session.get(Inventory, sku)

        if item is None:
            new_qty = max(0, return_count - sales_count)
            item = Inventory(
                sku=sku,
                description=item_data.get("description", sku),
                item_quantity=new_qty,
                return_quantity=return_count,
            )
            db.session.add(item)
            if sales_count > 0:
                log_inventory_change(
                    sku=sku, change_type="sale",
                    quantity_change=-sales_count,
                    quantity_after=new_qty,
                    note="CSV sale (new item)",
                )
            if return_count > 0:
                log_inventory_change(
                    sku=sku, change_type="return",
                    quantity_change=return_count,
                    quantity_after=new_qty,
                    note="CSV return (new item)",
                )
            continue

        item.description = item_data.get("description", item.description)
        item.item_quantity = max(0, item.item_quantity - sales_count + return_count)
        item.return_quantity += return_count

        if sales_count > 0:
            log_inventory_change(
                sku=sku, change_type="sale",
                quantity_change=-sales_count,
                quantity_after=item.item_quantity,
                note="CSV sale",
            )
        if return_count > 0:
            log_inventory_change(
                sku=sku, change_type="return",
                quantity_change=return_count,
                quantity_after=item.item_quantity,
                note="CSV return",
            )

    db.session.commit()

def on_new_order(filename, text, boxes):
    """
        @brief Callback function to handle new orders detected by the file watcher. This function is called with the filename, extracted text, and parsed box data when a new order PDF is processed. It stores the OCR results in memory and updates the inventory counts based on the parsed box information.
    
        @param filename The name of the newly detected order PDF file
        @param text The full text extracted from the PDF using OCR
        @param boxes A list of dictionaries containing parsed box information (box size and count) extracted from the OCR text of the order PDF
        """
    ocr_results[filename] = {"text": text, "boxes": boxes}
    logger.info(f"Stored OCR result for {filename} ({len(text)} chars, {len(boxes)} box types)")
    increment_inventory_from_boxes(boxes)

    
def serialize_last_scan(lastlogscan):
    """
        @brief Function to serialize the inventorylog entry with the highest timestamp
        
        @param lastlogscan The row containing the most recent inventory log update that was not manual
        
        """
    if len(lastlogscan) == 0:
        return { "timestamp" : 'None' }
    else:
        return {
            "id" : lastlogscan.id[0],
            "sku" : lastlogscan.sku[0],
            "change_type": lastlogscan.change_type[0],
            "quantity_change" : lastlogscan.quantity_change[0],
            "quantity_after": lastlogscan.quantity_after[0],
            "timestamp" : lastlogscan.timestamp[0],
            "note" : lastlogscan.note[0]
        } 
    

@app.get("/api/health")
def health():
    """
        @brief Health check endpoint to verify that the API is running.

        """
    return jsonify(status="ok")


@app.get("/api/inventory")
def get_inventory():
    """
        @brief Endpoint to retrieve the current inventory data. This function queries the database for all inventory items, orders them by description, and returns a JSON list of serialized inventory items for API responses.
        """
    items = db.session.query(Inventory).order_by(Inventory.description.asc()).all()
    return jsonify([serialize_inventory_item(item) for item in items])


@app.patch("/api/inventory/<sku>")
def update_inventory_item(sku):
    """
        @brief Endpoint to update an inventory item by SKU. This function accepts a JSON payload that can include "item_quantity" to set the quantity (must be a non-negative integer) and "description" to update the item's description (must not be empty). It validates the input, updates the corresponding inventory item in the database, and returns the updated item as JSON.
        
        @param sku The SKU of the inventory item to update, provided as a URL parameter
        
        @return A JSON representation of the updated inventory item, or an error message if the item is not found or if the input is invalid
        """
    item = db.session.get(Inventory, sku)
    if item is None:
        return jsonify(error="Inventory item not found"), 404

    payload = request.get_json(silent=True) or {}

    if "item_quantity" in payload:
        try:
            new_qty = max(0, int(payload["item_quantity"]))
            old_qty = item.item_quantity
            item.item_quantity = new_qty
            log_inventory_change(
                sku=sku, change_type="manual",
                quantity_change=new_qty - old_qty,
                quantity_after=new_qty,
                note="Manual edit via API",
            )
        except (TypeError, ValueError):
            return jsonify(error="item_quantity must be an integer"), 400

    if "description" in payload:
        description = str(payload["description"]).strip()
        if not description:
            return jsonify(error="description must not be empty"), 400
        item.description = description

    db.session.commit()
    return jsonify(serialize_inventory_item(item))

@app.get("/api/analytics")
def analytics_all():
    """
    @brief Return usage-rate, time-to-empty, and reorder data for every
           inventory item.  Accepts optional query params: days, lead_time, safety_stock.
    """
    days = request.args.get("days", 30, type=int)
    lead_time = request.args.get("lead_time", 5, type=float)
    safety_stock = request.args.get("safety_stock", 3, type=float)
    data = get_all_analytics(days, lead_time, safety_stock)
    return jsonify(data)


@app.get("/api/analytics/<sku>")
def analytics_sku(sku):
    """
    @brief Return detailed analytics for a single SKU.
    
    @param sku The SKU to query, provided as a URL parameter
    
    @return A JSON object containing the usage rate, time-to-empty, and reorder recommendation for the specified SKU, or an error message if the SKU is not found
    """
    days = request.args.get("days", 30, type=int)
    lead_time = request.args.get("lead_time", 5, type=float)
    safety_stock = request.args.get("safety_stock", 3, type=float)

    usage = get_usage_rate(sku, days)
    if usage is None:
        return jsonify(error="SKU not found"), 404

    tte = get_time_to_empty(sku, days)
    reorder = get_reorder_recommendation(sku, days, lead_time, safety_stock)

    return jsonify({
        "usage": usage,
        "time_to_empty": tte,
        "reorder": reorder,
    })


@app.get("/api/analytics/<sku>/history")
def analytics_history(sku):
    """
    @brief Return the inventory change log for a single SKU (for charting).
    
    @param sku The SKU to query, provided as a URL parameter
    
    @return A JSON list of inventory log entries for the specified SKU, where each entry includes timestamp, change_type, quantity_change, quantity_after, and note
    """
    days = request.args.get("days", 30, type=int)
    history = get_inventory_history(sku, days)
    return jsonify(history)
    

@app.get("/api/lastscan")
def last_scan():
    """
    @brief endpoint to return the most recent timestamp
    
    @return A JSON object sorted so that the most recent timestamp is first
    """
    
    last_update = db.session.query(InventoryLog).order_by(InventoryLog.timestamp.desc()).all()
    
    
    
    return jsonify(serialize_last_scan(last_update))
    
    

@app.get("/api/ocr/orders")
def ocr_all_orders():
    """
        @brief Endpoint to run OCR on all PDF files in the orders directory and return the extracted text for each file as JSON. This function processes all order PDFs by extracting text and parsing box information, returning a dictionary mapping each filename to its extracted text.
        
        @return A JSON object where each key is a PDF filename and the value is the extracted text from that PDF file, representing the OCR results for all orders in the directory
        """
    results = process_all_orders(ORDERS_DIR)
    return jsonify(results)

@app.get("/api/ocr/orders/<filename>")
def ocr_single_order(filename):
    """
        @brief Endpoint to run OCR on a specific PDF file in the orders directory and return the extracted text as JSON. This function checks if the specified file exists, extracts text from it using OCR, and returns the filename along with the extracted text. If the file is not found, it returns a 404 error.
        
        @param filename The name of the PDF file to process, provided as a URL parameter
            
        @return A JSON object containing the filename and the extracted text from the specified PDF file, or an error message if the file is not found
        """
    import os
    filepath = os.path.join(ORDERS_DIR, filename)
    if not os.path.isfile(filepath):
        return jsonify(error="File not found"), 404
    text = extract_text_from_pdf(filepath)
    return jsonify(filename=filename, text=text)

@app.get("/api/ocr/boxes/<filename>")
def ocr_boxes(filename):
    """
        @brief Endpoint to run OCR on a specific PDF file in the orders directory, parse box information from the extracted text, and return the results as JSON. This function checks if the specified file exists, processes it to extract text and parse box data, and returns a structured JSON object containing the filename and a list of boxes with their sizes and counts. If the file is not found, it returns a 404 error.
        
        @param filename The name of the PDF file to process, provided as a URL parameter
        
        @return A JSON object containing the filename and a list of boxes extracted from the specified PDF file, where each box is represented as a dictionary with "box_size" and "count" keys, or an error message if the file is not found
        """
    import os
    filepath = os.path.join(ORDERS_DIR, filename)
    if not os.path.isfile(filepath):
        return jsonify(error="File not found"), 404
    result = process_order_pdf(filepath)
    return jsonify(result)

@app.post("/api/csv/upload")
def upload_csv():
    """
        @brief Endpoint to upload a sales/inventory CSV file, parse its contents, and update the inventory counts accordingly. This function checks for the presence of a file in the request, validates that it is a CSV, parses the sales data from the file, updates the inventory by decrementing sales and incrementing returns, and returns a JSON response containing the filename and the parsed items. If no file is provided or if the file is not a CSV, it returns an appropriate error message.
        
            @return A JSON object containing the filename and a list of parsed items from the uploaded CSV file, where each item includes "sku", "description", "sales_count", and "return_count", or an error message if the file is not provided or is not a CSV
        """
    if "file" not in request.files:
        return jsonify(error="No file provided"), 400
    file = request.files["file"]
    if not file.filename.lower().endswith(".csv"):
        return jsonify(error="File must be a .csv"), 400
    items = parse_sales_csv(file.stream)
    decrement_inventory_from_sales(items)
    logger.info(f"Parsed uploaded CSV {file.filename} ({len(items)} items)")
    return jsonify({"file": file.filename, "items": items})

# Start the file watcher at module load time so it runs regardless of
# how Flask is launched (python app.py, flask run, gunicorn, etc.)
observer = start_watcher(ORDERS_DIR, on_new_order)

if __name__ == "__main__":
    try:
        app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
    finally:
        observer.stop()
        observer.join()

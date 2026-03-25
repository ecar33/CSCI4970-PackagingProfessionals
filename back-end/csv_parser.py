import csv
import io
import logging

logger = logging.getLogger(__name__)


def parse_sales_csv(file_stream):
    """
        @brief Parse a sales/inventory CSV from the Flask upload.
    
        @param file_stream CSV file stream from the Flask request
    
        @return JSON of the form:
            [
                {
                    "sku": "10064",
                    "description": "15x12x10 Box",
                    "sales_count": 13,
                    "return_count": 0
                }
            ]
        """
    items = []
    try:
        text = file_stream.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            try:
                items.append({
                    "sku": row["SKU"].strip(),
                    "description": row["ShortDescription"].strip(),
                    "sales_count": int(row["ItemSalesUnitCount"].strip()),
                    "return_count": int(row["ItemReturnUnitCount"].strip()),
                })
            except (KeyError, ValueError) as e:
                logger.warning(f"Skipping malformed row: {e}")
                continue
    except Exception as e:
        logger.error(f"Failed to parse CSV: {e}")

    return items

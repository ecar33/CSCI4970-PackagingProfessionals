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


def parse_count_sheet_csv(filepath):
    """
        @brief Parse a count sheet CSV file and extract the 18x18x18 box usage
        count from cell H12 (row 12, column H = column index 7, both 1-indexed).

        @param filepath Path to the CSV file on disk

        @return The box usage count as an int, or None if the cell is empty or
                cannot be parsed (e.g. employee forgot to fill it in).
        """
    try:
        with open(filepath, newline="", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            for row_num, row in enumerate(reader, start=1):
                if row_num == 12:
                    # Column H = index 7
                    if len(row) < 8:
                        logger.warning(f"Count sheet row 12 has fewer than 8 columns: {row}")
                        return None
                    raw = row[7].strip()
                    if not raw:
                        return None
                    try:
                        value = int(float(raw))
                    except (ValueError, TypeError):
                        logger.warning(f"Could not parse H12 value '{raw}' as a number.")
                        return None
                    if value > 80:
                        logger.warning(f"Parsed count {value} seems unusually high, skipping.")
                        return None
                    return value
        # File had fewer than 12 rows
        logger.warning(f"Count sheet {filepath} has fewer than 12 rows.")
        return None
    except Exception as e:
        logger.error(f"Failed to parse count sheet CSV {filepath}: {e}")
        return None


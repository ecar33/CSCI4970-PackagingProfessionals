# back-end/watcher.py
import os
import re
import time
import logging
from watchdog.observers.polling import PollingObserver
from watchdog.events import FileSystemEventHandler
from ocr import extract_text_from_pdf, parse_boxes_from_text

logger = logging.getLogger(__name__)


class _BaseFileHandler(FileSystemEventHandler):
    """Shared logic for waiting until a PDF is fully written."""

    def _wait_for_file_ready(self, filepath, timeout=30):
        """
            @brief Wait for a file to be fully written by checking its size until it stabilizes or a timeout is reached.

            @param filepath Path to the file to check
            @param timeout Maximum time to wait in seconds before giving up
            """
        previous_size = -1
        elapsed = 0
        while elapsed < timeout:
            try:
                current_size = os.path.getsize(filepath)
            except OSError:
                time.sleep(1)
                elapsed += 1
                continue
            if current_size == previous_size and current_size > 0:
                return
            previous_size = current_size
            time.sleep(1)
            elapsed += 1


class OrderFileHandler(_BaseFileHandler):
    """
        @brief File system event handler that processes new PDF order forms when they are created in the orders directory.

        @param callback Function to call with the filename, extracted text, and parsed box data when a new order is processed.
        """

    def __init__(self, callback):
        """
            @brief Initialize the file handler with a callback function to process new orders.

            @param callback Function that takes (filename, text, boxes) to handle the processed order data
            """
        super().__init__()
        self.callback = callback

    def on_created(self, event):
        """
            @brief Handle the creation of a new file in the orders directory. If it's a PDF, run OCR and parse box data, then call the callback with the results.

            @param event File system event containing information about the created file
            """
        if event.is_directory:
            return
        if not event.src_path.lower().endswith(".pdf"):
            return

        logger.info(f"New order detected: {event.src_path}")
        self._wait_for_file_ready(event.src_path)

        try:
            text = extract_text_from_pdf(event.src_path)
            boxes = parse_boxes_from_text(text)
            filename = os.path.basename(event.src_path)
            logger.info(f"OCR complete for {filename}")
            self.callback(filename, text, boxes)
        except Exception as e:
            logger.error(f"Failed processing {event.src_path}: {e}", exc_info=True)


class CountSheetHandler(_BaseFileHandler):
    """
        @brief File system event handler that processes count sheet PDFs to extract the
        18x18x18 box usage count from what was originally cell H12 of the Excel sheet.
        If the value cannot be found (e.g. employee forgot to fill it in), the file is
        logged and skipped gracefully.

        @param callback Function to call with (filename, count) when a valid count is parsed.
        """

    # The count sheet is a single-page Excel→PDF.  Cell H12 is the last
    # column of the row that contains the 18 cubed usage.

    def __init__(self, callback):
        super().__init__()
        self.callback = callback

    def on_created(self, event):
        if event.is_directory:
            return
        if not event.src_path.lower().endswith(".pdf"):
            return

        logger.info(f"New count sheet detected: {event.src_path}")
        self._wait_for_file_ready(event.src_path)

        try:
            text = extract_text_from_pdf(event.src_path)
            count = self._parse_count(text)
            filename = os.path.basename(event.src_path)

            if count is None:
                logger.warning(
                    f"Could not find 18x18x18 usage count in {filename} — "
                    "employee may not have filled it in. Skipping."
                )
                return

            logger.info(f"Count sheet {filename}: 18x18x18 usage = {count}")
            self.callback(filename, count)
        except Exception as e:
            logger.error(f"Failed processing count sheet {event.src_path}: {e}", exc_info=True)

    @staticmethod
    def _parse_count(text):
        """
            @brief Extract the 18x18x18 box usage count from OCR text of a count sheet.
            The value lives in what was cell H12 (last column of the row).

            The target row starts with "$    20" (the $20 denomination row) in column A.
            Columns B, D, F contain either "$    x0.00" (a multiple of 20) or "$    -".
            Columns C, E, G are always empty.  Column H (the last value) is the box count.

            @param text Full OCR text from the count sheet PDF
            @return The usage count as an int, or None if it could not be determined.
            """
        for line in text.split("\n"):
            stripped = line.strip()
            # Look for the $20 denomination row — starts with $ followed by "20"
            # OCR may render it as "$    20", "$20", "$ 20", etc.
            if not re.match(r'^\$\s*20\b', stripped):
                continue

            # Found the target row. The box count is the last number on this line.
            numbers = re.findall(r'\d+', stripped)
            if not numbers:
                return None

            # The last number on this line is the box usage count (column H)
            value = int(numbers[-1])

            # Sanity: "20" itself appears as the denomination; if the only number
            # is 20 then the employee likely left the count blank.
            if len(numbers) == 1 and value == 20:
                return None

            # Guard against picking up an unreasonably large value
            if value > 80:
                logger.warning(f"Parsed count {value} seems unusually high, skipping.")
                return None

            return value

        # No line matched the $20 pattern
        return None


def start_watcher(orders_dir, callback):
    """
        @brief Start watching the specified orders directory for new PDF files.

        @param orders_dir Directory to watch for new order PDFs
        @param callback Function that takes (filename, text, boxes) to handle the processed order data

        @return Observer object that can be stopped when the application shuts down
        """
    if not os.path.isdir(orders_dir):
        os.makedirs(orders_dir, exist_ok=True)

    handler = OrderFileHandler(callback)
    observer = PollingObserver()
    observer.schedule(handler, orders_dir, recursive=False)
    observer.daemon = True
    observer.start()
    logger.info(f"Watching {orders_dir} for new orders...")
    return observer


def start_count_watcher(counts_dir, callback):
    """
        @brief Start watching the specified counts directory for new count sheet PDFs.
        When a new PDF is created, OCR extracts the 18x18x18 box usage from cell H12
        and calls the callback with (filename, count).

        @param counts_dir Directory to watch for new count sheet PDFs
        @param callback Function that takes (filename, count)

        @return Observer object that can be stopped when the application shuts down
        """
    if not os.path.isdir(counts_dir):
        os.makedirs(counts_dir, exist_ok=True)

    handler = CountSheetHandler(callback)
    observer = PollingObserver()
    observer.schedule(handler, counts_dir, recursive=True)
    observer.daemon = True
    observer.start()
    logger.info(f"Watching {counts_dir} for new count sheets...")
    return observer



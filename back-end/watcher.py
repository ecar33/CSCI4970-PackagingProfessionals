# back-end/watcher.py
import os
import time
import logging
from watchdog.observers.polling import PollingObserver
from watchdog.events import FileSystemEventHandler
from ocr import extract_text_from_pdf, parse_boxes_from_text
from csv_parser import parse_count_sheet_csv

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
        @brief File system event handler that processes count sheet CSV files to extract the
        18x18x18 box usage count from cell H12.
        If the value cannot be found (e.g. employee forgot to fill it in), the file is
        logged and skipped gracefully.

        @param callback Function to call with (filename, count) when a valid count is parsed.
        """

    def __init__(self, callback):
        super().__init__()
        self.callback = callback

    def on_created(self, event):
        if event.is_directory:
            return
        if not event.src_path.lower().endswith(".csv"):
            return

        logger.info(f"New count sheet detected: {event.src_path}")
        self._wait_for_file_ready(event.src_path)

        try:
            count = parse_count_sheet_csv(event.src_path)
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



# back-end/watcher.py
import os
import time
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from ocr import extract_text_from_pdf, parse_boxes_from_text

logger = logging.getLogger(__name__)


class OrderFileHandler(FileSystemEventHandler):
    """Watches for new PDF files and runs OCR on them."""

    def __init__(self, callback):
        super().__init__()
        self.callback = callback

    def on_created(self, event):
        if event.is_directory:
            return
        if not event.src_path.lower().endswith(".pdf"):
            return

        logger.info(f"New order detected: {event.src_path}")

        # Wait briefly for the file to finish writing
        self._wait_for_file_ready(event.src_path)

        try:
            text = extract_text_from_pdf(event.src_path)
            boxes = parse_boxes_from_text(text)
            filename = os.path.basename(event.src_path)
            logger.info(f"OCR complete for {filename}")
            self.callback(filename, text, boxes)
        except Exception as e:
            logger.error(f"OCR failed for {event.src_path}: {e}")

    def _wait_for_file_ready(self, filepath, timeout=30):
        """Wait until the file size stops changing (fully written)."""
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


def start_watcher(orders_dir, callback):
    """Start watching the orders directory in the background."""
    if not os.path.isdir(orders_dir):
        os.makedirs(orders_dir, exist_ok=True)

    handler = OrderFileHandler(callback)
    observer = Observer()
    observer.schedule(handler, orders_dir, recursive=False)
    observer.daemon = True
    observer.start()
    logger.info(f"Watching {orders_dir} for new orders...")
    return observer

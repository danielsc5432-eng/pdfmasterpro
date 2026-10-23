"""Isolated native PDF -> structural DOCX conversion; no network access."""
import argparse
import logging
from pathlib import Path

import fitz  # PyMuPDF
from pdf2docx import Converter


def convert(source: str, destination: str) -> None:
    with fitz.open(source) as document:
        if document.needs_pass:
            raise ValueError("PDF protegido por senha.")
        if not len(document):
            raise ValueError("PDF sem páginas.")
        # pdf2docx is a structural converter, not an OCR engine. Do not silently
        # deliver an image-only DOCX when the user requested editable content.
        if any(not page.get_text("words") and page.get_images() for page in document):
            raise ValueError("PDF digitalizado: utilize o modo de preservar layout com OCR.")
    converter = Converter(source)
    try:
        converter.convert(destination, multi_processing=False)
    finally:
        converter.close()
    if not Path(destination).is_file() or Path(destination).stat().st_size < 100:
        raise ValueError("O motor não produziu um documento válido.")


if __name__ == "__main__":
    logging.getLogger().setLevel(logging.WARNING)
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("destination")
    args = parser.parse_args()
    convert(args.source, args.destination)

"""Generate redistributable synthetic conversion cases, without personal data."""
import argparse
from pathlib import Path
import fitz


def generate(directory):
    directory.mkdir(parents=True, exist_ok=True)
    with fitz.open() as doc:
        page = doc.new_page(width=595, height=842)
        page.insert_text((40, 50), "FINANCIAL REGRESSION", fontsize=14)
        for y, label, amount in [(90, "Credit", "+1234.56"), (120, "Debit", "-1234.56"), (150, "Balance", "0.00")]:
            page.insert_text((40, y), label, fontsize=11)
            page.insert_text((350, y), amount, fontsize=11)
        doc.save(directory / "signed-values.pdf", no_new_id=True)
    with fitz.open() as doc:
        page = doc.new_page(width=595, height=842)
        for col, x in enumerate([40, 320]):
            for row in range(12):
                page.insert_text((x, 60+row*22+col*3), f"Column {col+1} item {row+1}: {100+row}.50", fontsize=10)
        doc.save(directory / "staggered-columns.pdf", no_new_id=True)
    with fitz.open() as doc:
        for width, height, text in [(595, 842, "Portrait total 101.50"), (400, 600, ""), (842, 595, "Landscape total 202.75")]:
            page = doc.new_page(width=width, height=height)
            if text:
                page.insert_text((40, 60), text, fontsize=12)
        doc.save(directory / "mixed-sizes-blank.pdf", no_new_id=True)
    with fitz.open() as doc:
        page = doc.new_page(width=400, height=600)
        page.insert_text((40, 80), "Rotated total -345.67", fontsize=12)
        page.set_rotation(90)
        doc.save(directory / "rotated-page.pdf", no_new_id=True)
    with fitz.open() as native, fitz.open() as scanned:
        page = native.new_page(width=595, height=842)
        page.insert_text((50, 90), "SCANNED FINANCIAL STATEMENT", fontsize=18)
        page.insert_text((50, 140), "Total 1234.56", fontsize=18)
        page.insert_text((50, 190), "This statement contains credit and debit details for review", fontsize=10)
        image = page.get_pixmap(matrix=fitz.Matrix(2, 2)).tobytes("png")
        target = scanned.new_page(width=595, height=842)
        target.insert_image(target.rect, stream=image)
        scanned.save(directory / "scanned-statement.pdf", no_new_id=True)
        with fitz.open() as transparent:
            layer = transparent.new_page(width=595, height=842)
            layer.insert_image(layer.rect, stream=image)
            layer.insert_text((50,90), "SCANNED FINANCIAL STATEMENT", fontsize=18, fill_opacity=0)
            layer.insert_text((50,140), "Total 1234.56", fontsize=18, fill_opacity=0)
            layer.insert_text((50,190), "This statement contains credit and debit details for review", fontsize=10, fill_opacity=0)
            transparent.save(directory / "transparent-searchable-scan.pdf", no_new_id=True)
        target.insert_text((50,90), "SCANNED FINANCIAL STATEMENT", fontsize=18, render_mode=3)
        target.insert_text((50,140), "Total 1234.56", fontsize=18, render_mode=3)
        target.insert_text((50,190), "This statement contains credit and debit details for review", fontsize=10, render_mode=3)
        scanned.save(directory / "searchable-scan.pdf", no_new_id=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    generate(parser.parse_args().directory)

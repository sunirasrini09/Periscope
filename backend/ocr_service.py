"""Local OCR service for PERISCOPE.

All document processing is local. Digitally-generated PDF pages use their embedded
text layer; scanned pages use Tesseract. OCR is evidence extraction, not a
clinical decision system: extracted facts must be checked against the source.
"""
import io
import os
import re
import time
from typing import Any

import cv2
import fitz
import numpy as np
import pytesseract
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageOps

app = FastAPI(title="PERISCOPE Local OCR", version="1.1.0")

if os.getenv("TESSERACT_CMD"):
    pytesseract.pytesseract.tesseract_cmd = os.environ["TESSERACT_CMD"]

MAX_BYTES = int(os.getenv("OCR_MAX_BYTES", str(50 * 1024 * 1024)))
DPI = int(os.getenv("OCR_PDF_DPI", "300"))
LANG = os.getenv("OCR_LANG", "eng")
# A page with a usable embedded text layer does not need image rendering/OCR.
NATIVE_TEXT_MIN_CHARS = int(os.getenv("OCR_NATIVE_TEXT_MIN_CHARS", "35"))
# A second OCR pass is reserved for weak first-pass results.
FALLBACK_CONFIDENCE = float(os.getenv("OCR_FALLBACK_CONFIDENCE", "58"))


def preprocess(pil_image: Image.Image) -> Image.Image:
    """Conservative preprocessing for scanned, typed medical records."""
    image = ImageOps.exif_transpose(pil_image).convert("RGB")
    arr = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)
    height, width = arr.shape[:2]

    # Avoid needless enlargement of already high-resolution PDF renders.
    longest = max(height, width)
    if longest < 1800:
        scale = min(1.7, 1800 / longest)
        if scale > 1.05:
            arr = cv2.resize(arr, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
    # Mild denoising; strong denoising can erase punctuation and decimal points.
    gray = cv2.fastNlMeansDenoising(gray, None, 7, 7, 21)
    threshold = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 35, 11
    )
    return Image.fromarray(threshold)


def run_tesseract(image: Image.Image) -> tuple[str, float]:
    """Run Tesseract once and reconstruct readable lines from its word-level data."""
    config = "--oem 1 --psm 3"
    data = pytesseract.image_to_data(
        image, lang=LANG, config=config, output_type=pytesseract.Output.DICT
    )
    groups: dict[tuple[int, int, int, int], list[str]] = {}
    scores: list[float] = []

    count = len(data.get("text", []))
    for i in range(count):
        word = str(data["text"][i]).strip()
        try:
            confidence = float(data["conf"][i])
        except (TypeError, ValueError, KeyError):
            confidence = -1.0
        if not word or confidence < 0:
            continue

        key = (
            int(data.get("page_num", [1] * count)[i]),
            int(data.get("block_num", [0] * count)[i]),
            int(data.get("par_num", [0] * count)[i]),
            int(data.get("line_num", [0] * count)[i]),
        )
        groups.setdefault(key, []).append(word)
        scores.append(confidence)

    # Preserve Tesseract's reading order while keeping paragraph/line boundaries.
    ordered_keys = sorted(groups)
    text = "\n".join(" ".join(groups[key]) for key in ordered_keys).strip()
    confidence = round(sum(scores) / len(scores), 1) if scores else 0.0
    return text, confidence


def image_to_text(image: Image.Image) -> tuple[str, float]:
    """One fast OCR pass; retry grayscale only when the first pass is weak."""
    processed = preprocess(image)
    text_a, conf_a = run_tesseract(processed)

    if text_a and conf_a >= FALLBACK_CONFIDENCE:
        return text_a, conf_a

    gray = ImageOps.grayscale(ImageOps.exif_transpose(image))
    text_b, conf_b = run_tesseract(gray)
    if conf_b > conf_a or (len(text_b) > len(text_a) * 1.25):
        return text_b, conf_b
    return text_a, conf_a


def usable_native_text(text: str) -> bool:
    compact = re.sub(r"\s+", "", text or "")
    if len(compact) < NATIVE_TEXT_MIN_CHARS:
        return False
    # Reject mostly-symbol/garbled text layers, but retain normal tables and values.
    useful = sum(ch.isalnum() for ch in compact)
    return useful / max(1, len(compact)) >= 0.45


@app.get("/health")
def health() -> dict[str, Any]:
    try:
        version = str(pytesseract.get_tesseract_version())
    except Exception as exc:
        raise HTTPException(503, f"Tesseract is not installed or not on PATH: {exc}")
    return {
        "success": True,
        "service": "periscope-ocr",
        "tesseract": version,
        "language": LANG,
        "dpi": DPI,
        "strategy": "page-wise native PDF text + single-pass Tesseract with low-confidence fallback",
    }


@app.post("/ocr")
async def ocr_document(file: UploadFile = File(...)) -> dict[str, Any]:
    started = time.perf_counter()
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Uploaded file is empty")
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, "File exceeds OCR_MAX_BYTES")

    name = (file.filename or "").lower()
    pages: list[dict[str, Any]] = []
    try:
        if name.endswith(".pdf") or file.content_type == "application/pdf":
            pdf = fitz.open(stream=raw, filetype="pdf")
            try:
                if pdf.page_count > 250:
                    raise HTTPException(413, "PDF exceeds the 250-page OCR limit")

                matrix = fitz.Matrix(DPI / 72, DPI / 72)
                for index, page in enumerate(pdf):
                    # Mixed PDFs are handled page by page: do not OCR pages with a good text layer.
                    native_text = page.get_text("text", sort=True).strip()
                    if usable_native_text(native_text):
                        pages.append({
                            "page": index + 1,
                            "text": native_text,
                            "confidence": None,
                            "mode": "native-pdf-text",
                        })
                        continue

                    pix = page.get_pixmap(matrix=matrix, alpha=False)
                    with Image.open(io.BytesIO(pix.tobytes("png"))) as img:
                        img.load()
                        text, confidence = image_to_text(img)
                    pages.append({
                        "page": index + 1,
                        "text": text,
                        "confidence": confidence,
                        "mode": "tesseract",
                    })
            finally:
                pdf.close()

        elif name.endswith((".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp")) or (file.content_type or "").startswith("image/"):
            with Image.open(io.BytesIO(raw)) as img:
                img.load()
                text, confidence = image_to_text(img)
            pages.append({
                "page": 1,
                "text": text,
                "confidence": confidence,
                "mode": "tesseract",
            })
        else:
            raise HTTPException(415, "OCR service accepts PDF and image files only")

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, f"OCR processing failed: {exc}")

    full_text = "\n\n".join(
        f"[PAGE {page['page']}]\n{page['text']}"
        for page in pages if page["text"]
    ).strip()
    if not full_text:
        raise HTTPException(
            422,
            "No readable text found. Try a clearer scan or a higher-resolution image.",
        )

    ocr_pages = [page for page in pages if page["mode"] == "tesseract" and page["text"]]
    confidence_values = [page["confidence"] for page in ocr_pages if page["confidence"] is not None]
    average = round(sum(confidence_values) / len(confidence_values), 1) if confidence_values else None
    review = bool(
        any(not page["text"] for page in pages)
        or (average is not None and (
            average < 75 or any(
                page["confidence"] is not None and page["confidence"] < 60
                for page in ocr_pages
            )
        ))
    )

    modes = {page["mode"] for page in pages}
    mode = (
        "mixed-pdf-text+tesseract" if len(modes) > 1
        else next(iter(modes)) if modes
        else "unknown"
    )
    return {
        "success": True,
        "mode": mode,
        "text": full_text,
        "pages": pages,
        "averageConfidence": average,
        "reviewRecommended": review,
        "processingMs": round((time.perf_counter() - started) * 1000),
    }

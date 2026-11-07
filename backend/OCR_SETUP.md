# PERISCOPE Hybrid OCR setup (Windows)

This adds a local OCR microservice while keeping the existing Node.js, Firebase, Supabase and frontend architecture.

## What happens on upload

1. PDFs and image uploads are sent from Node.js to the local Python OCR service.
2. Each PDF page uses its embedded text layer when it is usable; scanned pages alone are OCRed.
3. Python checks each PDF page for embedded text first. Only scanned pages are rendered at 300 DPI, preprocessed with OpenCV, and read by Tesseract. Mixed PDFs therefore retain native text pages and OCR only scanned pages.
4. Existing `demographics.js` and `keydetails.js` extract explicitly documented patient fields from the recognized text.
5. The upload response includes OCR confidence and field evidence (page number and matching source line). Existing patient auto-fill continues to fill blank fields only.

No patient document is sent to a hosted AI API. The medical field extractor is deliberately evidence-led and rule-based; it does not infer missing clinical facts.

## 1. Install Tesseract OCR

Install the Windows Tesseract engine (the executable, not just the Python package). Include English language data. A typical path is:

`C:\Program Files\Tesseract-OCR\tesseract.exe`

Open a new PowerShell window and verify:

```powershell
tesseract --version
tesseract --list-langs
```

The language list should include `eng`.

## 2. Install the Python OCR service

Open PowerShell:

```powershell
cd "C:\path\to\periscope_v4_1\final 2222222222\backend"
# Use standard CPython 3.13 64-bit (not the free-threaded 3.13t build).
# If installed at the path below:
& "$env:LOCALAPPDATA\Programs\Python\Python313-Standard\python.exe" -m venv .venv-standard
.\.venv-standard\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements-ocr.txt
```

If PowerShell blocks activation, use the venv interpreter directly:

```powershell
.\.venv-standard\Scripts\python.exe -m pip install -r requirements-ocr.txt
```

## 3. Configure the existing backend/.env

Keep your existing Firebase and Supabase settings. Add:

```env
OCR_SERVICE_URL=http://127.0.0.1:8000
OCR_TIMEOUT_MS=600000
```

The Python service also needs the Tesseract executable path. Set it in the PowerShell window used to start Python:

```powershell
$env:TESSERACT_CMD = "C:\Program Files\Tesseract-OCR\tesseract.exe"
```

## 4. Start the OCR service (Terminal 1)

From the `backend` directory:

```powershell
$env:TESSERACT_CMD = "C:\Program Files\Tesseract-OCR\tesseract.exe"
.\.venv-standard\Scripts\python.exe -m uvicorn ocr_service:app --host 127.0.0.1 --port 8000
```

Check `http://127.0.0.1:8000/health`. It should return `success: true` and the Tesseract version. The service binds to localhost only.

## 5. Start the existing Node backend (Terminal 2)

```powershell
cd "C:\path\to\periscope_v4_1\final 2222222222\backend"
npm install
npm start
```

Check `http://localhost:5000/api/health`. Firebase and Supabase configuration remain required as before.

## 6. Test in Periscope

Upload a digitally generated PDF (expected mode `native-pdf-text`), a scanned PDF, and a clear JPG/PNG (expected mode `tesseract`). The upload API response includes:

- `ocr.mode`: `native-pdf-text`, `tesseract`, or `mixed-pdf-text+tesseract`;
- `ocr.averageConfidence`: Tesseract average word confidence (0–100; null for native PDF text);
- `ocr.reviewRecommended`: true when confidence is low;
- `ocr.pages`: per-page extraction mode and confidence (native text pages have no OCR confidence);\n- `ocr.processingMs`: server-side extraction duration;
- `fieldEvidence`: field candidate, source page, source line, OCR confidence and review flag.

Tesseract confidence measures text recognition, not clinical correctness. A doctor must verify patient identity, diagnosis, medication, dose, allergy and procedure details before clinical use.

## Troubleshooting

**Tesseract not installed or not on PATH:** confirm `tesseract --version`, set `$env:TESSERACT_CMD` before starting Uvicorn, and check `eng` in `tesseract --list-langs`.

**Node reports OCR service unavailable:** keep Terminal 1 running, check `http://127.0.0.1:8000/health`, confirm `OCR_SERVICE_URL=http://127.0.0.1:8000` in the Node backend `.env`, then restart Node.

**No readable text found:** use a straight, clear scan at approximately 300 DPI with good lighting and no shadows. Handwriting may remain unreliable; this setup is optimized for typed records.

**Low OCR confidence:** review the page and extracted values. Do not auto-accept low-confidence identity or medication details.

## Notes

- Python OCR accepts PDF and image files. DOCX and TXT continue through existing Node.js extraction paths.
- No Supabase schema change or database migration is required.
- Existing frontend files are unchanged. Confidence and evidence are returned by the upload API; visual review badges require a separate frontend UI change.


## Performance and accuracy notes

- Tesseract word-level data is used to reconstruct text in a single process call per page.
- A grayscale retry is run only when the first pass has low confidence or very little text.
- Native PDF text is preferred page-by-page, including mixed digital/scanned PDFs.
- `OCR_PDF_DPI=300` is the accuracy-oriented default. For faster testing, set `OCR_PDF_DPI=250`; inspect the results before using that setting for production.
- OCR confidence measures text recognition, not whether a clinical statement is correct. Keep human verification for identity, diagnosis, medication, dose, allergy and procedure details.

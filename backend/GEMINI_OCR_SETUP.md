# PERISCOPE Gemini AI OCR

This optional provider uses the existing Node.js document-upload route. It does not replace local Python/Tesseract, Firebase authentication, Supabase storage, or the current clinical extraction pipeline.

## Configure
1. Create an API key in Google AI Studio.
2. Add these entries to the existing `backend/.env`; preserve all current settings:
```env
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash
GEMINI_TIMEOUT_MS=180000
GEMINI_MAX_INLINE_BYTES=18874368
GEMINI_MAX_OUTPUT_TOKENS=32768
```
3. Restart the Node backend. The key is read server-side only and is never exposed to browser JavaScript.
4. In the patient's Documents section choose Gemini AI OCR or Existing OCR before uploading.

## Behavior
- PDF, PNG and JPG/JPEG files use the selected engine.
- Existing OCR continues to call the existing local Python service configured by `OCR_SERVICE_URL`.
- Gemini is called directly by the existing Node.js backend through Google's `generateContent` API. No extra OCR microservice or database migration is added.
- DOCX and TXT continue through their existing native text readers.
- Both OCR engines return the existing `text` and `ocr` response structure. `normalizeOcr`, demographics, key details, timeline, field evidence and patient auto-fill remain unchanged.
- Gemini confidence is not independently measured; its results are marked for clinician review.
- Gemini inline extraction defaults to an 18 MiB file limit. Larger files can use Existing OCR.

## Clinical and privacy note
Google AI Studio free-tier availability, quotas, model access and data-use terms vary and may change. Confirm institutional privacy, consent, retention and regulatory requirements before sending patient records to an external API. A clinician must verify identity, diagnosis, medications, doses, allergies and procedure details. Gemini transcription is not clinical validation.

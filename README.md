# PeriScope
### Hybrid AI-Powered Pre-Anaesthesia Record Preparation for Oncosurgery

**Making fragmented patient histories easier to review, one record at a time.**

PeriScope is an AI-assisted platform designed to simplify pre-anaesthesia preparation for patients undergoing cancer-related surgeries. It helps healthcare teams organize medical records from multiple hospitals into a structured, chronological, anaesthesia-focused patient overview.

By combining document processing, OCR, information extraction, and an interactive patient interface, PeriScope aims to reduce the manual effort involved in reviewing scattered medical records and identifying information that may need further verification.

---

## 1. Problem Statement

Cancer patients may undergo multiple surgeries, chemotherapy sessions, and other treatments across different hospitals. Their medical histories are often distributed across discharge summaries, investigation reports, prescriptions, anaesthesia records, and clinical documents.

During pre-anaesthesia assessment, clinicians may need to manually review these documents to reconstruct:

- Previous surgeries and anaesthesia-related events.
- Cancer diagnosis and treatment history.
- Existing medical conditions and medications.
- Relevant investigations and clinical summaries.
- Missing, inconsistent, or unclear patient information.

This fragmented process can increase documentation workload and make it difficult to obtain a consolidated view of the patient's history.

## 2. Our Solution

PeriScope provides a centralized workspace for preparing anaesthesia-focused patient records.

Users can upload medical documents, process their contents, and organize extracted information into relevant clinical sections. The platform presents a structured patient overview, helping healthcare professionals review documented information and identify details that require confirmation.

**PeriScope is designed as a clinical documentation support tool. It does not independently diagnose conditions, calculate anaesthesia risk, or recommend treatment or anaesthetic management.**

## 3. Key Features

### 3.1 Intelligent Medical Document Processing
- Upload patient documents for processing.
- OCR-based text extraction from supported scanned documents and images.
- Extract relevant information from uploaded clinical documents.
- Organize extracted details into structured patient fields.
- Support review of extracted information before clinical use.

### 3.2 Structured Patient Profile
Organizes available patient information into relevant sections:

- Patient demographics, including age and sex.
- Hospital and document details.
- Cancer diagnosis and treatment history.
- Previous surgeries and anaesthesia history.
- Medical conditions and medication history.
- Investigations and clinical summaries.
- Pre-anaesthesia assessment information.

### 3.3 Chronological Medical History
- Present documented medical events in chronological order.
- Help users review previous procedures and treatments.
- Make relevant historical information easier to navigate.

### 3.4 Missing and Conflicting Information
- Highlight incomplete or unclear extracted information.
- Identify details that may require verification.
- Help track outstanding records and information gaps.

### 3.5 Patient Document Chat Assistant
- Interact with available patient-document information through a conversational interface.
- Retrieve relevant details from processed records.
- Help users navigate lengthy clinical documentation more efficiently.

### 3.6 Admin Dashboard
- Monitor document-processing activity.
- View document processing statuses.
- Track queued, processing, completed, and failed documents.
- Review processing errors and retry failed jobs where supported.

## 4. System Workflow

1. **Document Upload** – The user uploads available patient medical records.
2. **OCR Processing** – Supported scanned documents are processed to extract readable text.
3. **Information Extraction** – Relevant patient details are identified from the document content.
4. **Data Organization** – Extracted information is grouped into structured clinical sections.
5. **Chronological Review** – Documented procedures, treatments, and events are organized for easier review.
6. **Verification** – Missing, conflicting, or unclear details are highlighted for confirmation.
7. **Clinical Preparation** – Healthcare professionals review the consolidated information as part of their existing pre-anaesthesia workflow.

## 5. Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js |
| OCR Service | Python, FastAPI |
| OCR Engine | Tesseract OCR |
| Database / Cloud Services | Supabase |
| AI / Information Processing | Document-based information extraction |
| Deployment | Render |
| Version Control | Git and GitHub |

*The technology list should be updated if additional frameworks, models, or services are used in the final deployed version.*

## 6. System Architecture

```text
             PATIENT MEDICAL DOCUMENTS
                       |
                       v
                PERISCOPE FRONTEND
                       |
                       v
                 NODE.JS BACKEND
                       |
             +---------+---------+
             |                   |
             v                   v
       PYTHON OCR SERVICE    DATABASE / CLOUD
         (FastAPI)             (Supabase)
             |
             v
       EXTRACTED TEXT
             |
             v
      INFORMATION EXTRACTION
             |
             v
      STRUCTURED PATIENT DATA
             |
       +-----+----------------+
       |                      |
       v                      v
 CHRONOLOGICAL VIEW     DOCUMENT CHAT
       |                      |
       +----------+-----------+
                  |
                  v
       PRE-ANAESTHESIA REVIEW
```

## 7. Intended Users

- Anaesthesiologists.
- Oncology and surgical care teams.
- Hospital documentation teams.
- Healthcare professionals involved in pre-operative preparation.

## 8. Expected Impact

PeriScope aims to:

- Reduce the manual effort required to review fragmented medical records.
- Improve accessibility of historical patient information.
- Make previous surgeries, treatments, and anaesthesia events easier to review.
- Help identify missing or inconsistent documentation.
- Support more organized pre-anaesthesia preparation.
- Provide a structured starting point for clinical review.

## 9. Installation and Setup

### Prerequisites

- Node.js and npm
- Python 3.10 or later
- Git
- Tesseract OCR
- Supabase project credentials

### Step 1: Clone the Repository

```bash
git clone https://github.com/USERNAME/REPOSITORY-NAME.git
cd REPOSITORY-NAME
```

### Step 2: Install Backend Dependencies

```bash
cd backend
npm install
```

### Step 3: Install OCR Dependencies

```bash
pip install -r requirements-ocr.txt
```

Ensure Tesseract OCR is installed and accessible in your system PATH.

### Step 4: Configure Environment Variables

Create the required `.env` file using the environment variable names expected by the project.

Example configuration:

```env
PORT=5000
OCR_SERVICE_URL=http://127.0.0.1:8000
OCR_TIMEOUT_MS=600000
```

Add the required Supabase credentials and other project-specific configuration. Never commit secret keys, access tokens, or `.env` files to GitHub.

### Step 5: Start the OCR Service

```bash
uvicorn ocr_service:app --host 0.0.0.0 --port 8000
```

### Step 6: Start the Backend

```bash
node server.js
```

Open the frontend using the project's configured local development setup.

*Note: Run commands from the appropriate project directories. If your project uses a different entry point or frontend setup, follow its existing configuration.*

## 10. Deployment

PeriScope supports deployment using Render.

The application can be deployed as separate services:

- **Main Backend:** Node.js service.
- **OCR Service:** Python FastAPI service.

Configure the backend's `OCR_SERVICE_URL` with the deployed OCR service URL. Ensure the required environment variables and dependencies are configured for each service.

## 11. Future Enhancements

- Support for additional medical document formats and languages.
- Improved extraction accuracy for complex scanned clinical records.
- More advanced identification of inconsistencies across multiple hospital records.
- Enhanced document provenance and source-level traceability.
- Role-based access and audit logging.
- Expanded document-processing analytics.
- Further validation with healthcare professionals and representative clinical documents.

## 12. Responsible Use and Limitations

PeriScope is intended to assist with medical record organization and pre-anaesthesia documentation preparation.

- Extracted information must be verified against the original source documents.
- OCR and AI-based extraction may produce incomplete or inaccurate results.
- The platform does not replace professional clinical judgment.
- It does not independently diagnose, determine patient risk, or generate anaesthesia management recommendations.
- Patient information must be handled in accordance with applicable privacy, security, and healthcare requirements.

## 13. Project Team

**Team Leader & Technical Lead**
- Mr. Shyamkumar M

**Doctor Partner & Clinical Mentor**
- Dr. Preethi Reddy – Anaesthesiologist

**Technical Development Team**
- Ms. Radhika S
- Ms. Harini S

## 14. Acknowledgement

We sincerely acknowledge the clinical guidance and technical collaboration that contributed to the development of PeriScope.

Our goal is to explore how AI-assisted document processing can make fragmented medical histories more accessible and organized for healthcare professionals.

---

**PeriScope — Bringing fragmented medical histories into a structured clinical view.**

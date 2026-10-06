# PERISCOPE

## Introduction

**PERISCOPE** is a web-based clinical records platform designed to organize patient information, clinical documents, investigations, treatment details, anaesthesia information, and Pre-Anaesthesia Check-up (PAC) workflows in a unified patient-centric interface.

It combines **Firebase Authentication**, **Node.js/Express**, **Supabase PostgreSQL**, **Supabase Storage**, and local document extraction/OCR to support secure clinical-record workflows.

> **Note:** Use synthetic/de-identified data for development and testing.

---

## Architecture

```text
                    ┌──────────────────────┐
                    │      PERISCOPE UI    │
                    │ HTML / CSS / JS       │
                    └──────────┬───────────┘
                               │
                         Firebase Auth
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Node.js + Express    │
                    │ Backend API          │
                    └───────┬───────┬──────┘
                            │       │
              ┌─────────────┘       └──────────────┐
              ▼                                    ▼
     ┌─────────────────┐                  ┌─────────────────┐
     │ Supabase        │                  │ Document        │
     │ PostgreSQL      │                  │ Extraction/OCR  │
     │ + Storage       │                  │ Local Processing│
     └─────────────────┘                  └─────────────────┘
```

### Technology Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Authentication:** Firebase Authentication
- **Database:** Supabase PostgreSQL
- **File Storage:** Supabase Private Storage
- **Document Processing:** PDF/DOCX extraction and local OCR
- **Deployment:** GitHub + Render

---

## Core Functionalities

### 1. Authentication & Roles
- Firebase-based login
- Role-based access
- Doctor
- Clinical Assistant
- Admin
- Anaesthesiologist

### 2. Patient Management
- Add and edit patients
- Patient-specific clinical records
- Shared patient visibility across authorized clinical users
- Patient overview and detailed clinical information

### 3. Clinical Record Management
Patient records can include:
- Basic details
- Diagnosis and staging
- Medical history
- Medications
- Investigations
- Cancer treatment
- Anaesthesia
- Timeline
- Missing information
- Conflicts
- Clinical questions
- Clinical brief
- Audit information

### 4. Document Management
- Upload PDF, DOCX, JPG and PNG records
- Document categorisation
- OCR/text extraction
- Patient-specific document association
- Clinical information extraction and mapping
- Persistent document records

### 5. Custom Document Category
Supports:

```text
Category: Other
Specify Category: Clinical Summary
```

The specified category is persisted with the document.

### 6. PAC Workflow
- Multi-section PAC form
- Direct section navigation
- Save Draft
- Save & Continue
- Persistent PAC data
- Mark as Reviewed
- Submit / Return / Finalize workflow
- PAC data stored with the patient record

### 7. Clinical Information Mapping
Extracted information can be mapped into relevant patient sections, including:
- Age and sex
- Diagnosis
- Comorbidities
- Medications
- Investigations
- Cancer treatment
- Planned procedure
- Anaesthesia information

The system is designed to map only information supported by the uploaded document.

### 8. Audit & Traceability
- Patient-specific records
- Document activity
- Clinical workflow status
- Audit logging

---

## Data Flow

```text
User
 ↓
Firebase Login
 ↓
PERISCOPE Clinical UI
 ↓
Node.js / Express API
 ↓
Supabase PostgreSQL / Storage
 ↓
Document Extraction / OCR
 ↓
Clinical Information Mapping
 ↓
User Review
 ↓
Persistent Patient Record
```

---

## Data & Security

- Firebase is used for authentication.
- Supabase PostgreSQL stores application data.
- Supabase Storage stores clinical documents.
- Storage buckets should remain private.
- Firebase service-account credentials must remain server-side.
- Supabase service-role keys must never be exposed in frontend code.
- `.env`, service-account files and `node_modules` must not be committed to GitHub.

Recommended `.gitignore`:

```text
.env
serviceAccountKey.json
node_modules/
```

---

## Example Test Workflow

A synthetic patient such as **Kamali Devi** can be used to test:

```text
Upload clinical document
        ↓
Select "Other"
        ↓
Specify "Clinical Summary"
        ↓
Process / OCR
        ↓
Extract clinical information
        ↓
Map to patient record
        ↓
Review PAC
        ↓
Save and persist
```

---

## Deployment

The application can be deployed using:

```text
GitHub
   ↓
Render
   ↓
Node.js / Express
   ↓
Supabase + Firebase
```

Environment-specific secrets should be configured through the hosting platform rather than committed to the repository.

---

## Project Structure

```text
PERISCOPE/
├── index.html
├── css/
├── js/
├── assets/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── ...
├── .gitignore
└── README.md
```

---

## Status

PERISCOPE is under active development. Features and workflows may evolve as clinical-record extraction, PAC workflows, validation, and deployment are refined.

---
## Contributors

- [Harini S](https://github.com/Harini0904-ece)

---

## Disclaimer

PERISCOPE is a software project for clinical-record organization and workflow demonstration. It should not be used with real patient information or for clinical decision-making without appropriate security, validation, privacy, regulatory, and clinical review.

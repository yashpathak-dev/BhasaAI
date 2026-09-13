# 🌍 Bhasa-Ai: Vernacular EdTech & Translation Platform

Bhasa-Ai is an advanced, offline-first multilingual EdTech and translation platform engineered to break language barriers in education across Indian regional dialects (**Hindi, Bhojpuri, Awadhi, Marathi, Bengali, Tamil, Telugu, and English**). Designed with edge resilience, it features local vector RAG fallbacks, high-concurrency database optimizations, and hardware-integrated telemetry stubs for disconnected rural classrooms.

---

## 🚀 Key Features

* **Multilingual Text & Voice Translation:** Instant speech-to-text input supporting regional speech recognition alongside rapid text translation and audio pronunciation output.
* **AI Learning Hub (Student & Teacher Modes):**
  * *Student Mode:* Generates simplified conceptual breakdowns, relatable cultural examples, vocabulary glossaries, and interactive multiple-choice quizzes with instant feedback.
  * *Teacher Mode:* Generates structured 45-minute lesson plans, board-writing notes, and classroom assessment worksheets.
* **Textbook PDF Translator:** Page-by-page textbook translation support allowing students to upload PDF learning materials and convert them into their native vernacular dialects.
* **1-Click PDF Notes Download:** Formats generated study sessions, summaries, and quizzes into downloadable PDF study notes using client-side rendering (`html2pdf.js`).
* **Secure Authentication & SQLite Activity History:** Built-in session management with Werkzeug password hashing, user registration/login, and a dedicated database-driven activity history dashboard.
* **Persistent Dark Mode System:** Seamless night-time study toggle with custom CSS variables and `localStorage` preference persistence.
* **Rural Edge Infrastructure & Hardware Stubs:**
  * *LoRa Mesh Sync:* Ingestion endpoints for offline rural radio mesh nodes (`/api/lora-mesh-sync`).
  * *Biometric Telemetry:* Galvanic Skin Response (GSR) stress tracking (`/api/biometric-telemetry`) to dynamically trigger syntax simplification.
  * *Panchayat Verification:* Secure hardware token authentication (`/api/panchayat-verify`) for local administrative clearance.
* **Robust Offline Smart Fallbacks:** Pre-loaded curriculum modules and zero-dependency vector cosine similarity RAG lookups (`ncert_db.json`) ensure uninterrupted learning during network drops.

---

## 🛠️ Tech Stack

* **Backend:** Python, Flask, Flask-CORS, SQLAlchemy, SQLite (WAL mode), Google GenAI SDK (`google-genai`), Werkzeug Security, Sentry SDK
* **Frontend:** HTML5, CSS3, Vanilla JavaScript, Web Speech API, Web Serial API hooks
* **Libraries:** `html2pdf.js`, Brotli/Gzip compression middleware

---

## 📂 Project Directory Structure

```text
BhasaAI_Backend/
│
├── app_backend.py         # Main Flask server, SQLite WAL setup, and API routes
├── models.py              # SQLAlchemy database models & authentication helpers
├── translation_engine.py  # Google GenAI translation & TTS wrapper
├── ai_engine.py           # Vernacular pedagogy engine & local RAG fallback
├── requirements.txt       # Python dependencies list
├── Procfile               # Production deployment configuration
├── .gitignore             # Git ignore rules for sensitive/cache files
├── .env                   # Environment variables (API keys & secrets - Ignored)
├── bhasa_users.db         # Local SQLite database (WAL mode - Ignored)
│
├── static/
│   ├── audio/             # Generated text-to-speech audio files (Ignored)
│   ├── css/
│   │   └── style.css      # Custom styles & dark mode variables
│   ├── image/
│   │   └── image.jpg.png  # Project assets & backgrounds
│   └── javascript/
│       └── script.js      # Frontend handlers, voice, API calls, offline queue
│
├── templates/
│   ├── index.html         # Landing page
│   ├── demo.html          # Main application hub (Translation & AI Hub)
│   ├── about.html         # About page
│   ├── advantages.html    # Platform advantages & rural architecture overview
│   ├── account.html       # User profile & activity history dashboard
│   ├── login.html         # User login screen
│   └── signup.html        # User registration screen
│
└── README.md              # Project documentation
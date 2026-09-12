# 🌍 Bhasa-Ai: Vernacular EdTech & Translation Platform

Bhasa-Ai is an advanced, AI-powered multilingual EdTech and translation platform built specifically to break language barriers in education across Indian regional dialects (**Hindi, Bhojpuri, Awadhi, Marathi, Bengali, Tamil, Telugu, and English**). 

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
* **Robust Offline Smart Fallbacks:** Pre-loaded curriculum modules and mock quizzes ensure uninterrupted learning even when external AI API keys or network connections are offline.

---

## 🛠️ Tech Stack

* **Backend:** Python, Flask, Flask-CORS, SQLite, Google GenAI SDK (`google-genai`), Werkzeug Security
* **Frontend:** HTML5, CSS3, Vanilla JavaScript, Web Speech API
* **Libraries:** `html2pdf.js`

---

## 📂 Project Directory Structure

```text
Bhasa-Ai/
│
├── app_backend.py         # Flask server, SQLite auth, and API routes
├── translation_engine.py  # Google GenAI translation & TTS wrapper
├── ai_engine.py           # Vernacular pedagogy & smart fallback engine
├── requirements.txt       # Python dependencies list
├── .gitignore             # Git ignore rules for sensitive/cache files
├── bhasa_users.db         # Local SQLite database (Ignored by Git)
│
├── static/
│   ├── css/
│   │   └── style.css      # Custom styles & dark mode variables
│   ├── image/
│   │   └── image.jpg.png  # Project assets & backgrounds
│   └── javascript/
│       └── script.js      # Frontend handlers, voice, API calls & dark mode toggle
│
├── templates/
│   ├── index.html         # Landing page
│   ├── demo.html          # Main application hub (Translation & AI Hub)
│   ├── about.html         # About page
│   ├── advantages.html    # Platform advantages
│   ├── account.html       # User profile & activity history dashboard
│   ├── login.html         # User login screen
│   └── signup.html        # User registration screen
│
└── README.md              # Project documentation
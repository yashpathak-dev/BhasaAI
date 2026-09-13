import os
import sqlite3
import logging
import threading
import json
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, Response
from flask_cors import CORS
from flask_compress import Compress
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
from translation_engine import TranslationEngine
from ai_engine import VernacularPedagogyEngine

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AppBackend")

app = Flask(__name__, template_folder="templates", static_folder="static")

# Enable automatic Brotli & Gzip payload compression for responses
Compress(app)

app.secret_key = os.environ.get("FLASK_SECRET_KEY")
if not app.secret_key:
    raise ValueError("Critical Security Error: FLASK_SECRET_KEY environment variable is not set.")

CORS(app)

DB_PATH = "bhasa_users.db"

# Global in-memory cache for ultra-fast repeated responses (<10ms)
RESPONSE_CACHE = {}

# Initialize SQLite Database with RAM-mapped PRAGMAs & WAL Mode
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Ultra-Fast High-Concurrency & RAM Cache Configurations
    cursor.execute("PRAGMA journal_mode = WAL;")        # Concurrent background writes
    cursor.execute("PRAGMA synchronous = NORMAL;")     # Faster write completions
    cursor.execute("PRAGMA mmap_size = 30000000000;")  # Read DB directly from RAM memory map
    cursor.execute("PRAGMA cache_size = -64000;")       # Dedicated 64MB RAM cache

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            activity_type TEXT,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_db()

translator = TranslationEngine()
ai_engine = VernacularPedagogyEngine()

LANG_CODE_TO_NAME = {
    "hi": "Hindi",
    "bho": "Bhojpuri",
    "awa": "Awadhi",
    "mr": "Marathi",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "en": "English"
}

# Helper to log user activities asynchronously
def log_user_activity(user_id, activity_type, content):
    if not user_id:
        return
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO user_history (user_id, activity_type, content) VALUES (?, ?, ?)",
            (user_id, activity_type, content[:255])
        )
        conn.commit()
        conn.close()
    except Exception as exc:
        logger.error("Error logging history: %s", exc)

# 1. Home Page Route
@app.route('/')
def render_home():
    return render_template('index.html')

# 2. Dynamic Template Page Router
@app.route('/<path:page_name>')
def render_page(page_name):
    clean_name = page_name.replace('.html', '')
    try:
        return render_template(f'{clean_name}.html')
    except Exception as exc:
        logger.warning("Template not found for route '%s': %s", page_name, exc)
        return render_template('index.html'), 404

# --- Authentication Endpoints ---

@app.route('/api/signup', methods=['POST'])
def handle_signup():
    try:
        data = request.json or {}
        name = data.get("name", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()

        if not name or not email or not password:
            return jsonify({"success": False, "error": "All fields are required"}), 400

        hashed_password = generate_password_hash(password)

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", 
                           (name, email, hashed_password))
            conn.commit()
            user_id = cursor.lastrowid
            conn.close()

            session['user_id'] = user_id
            session['user_name'] = name
            session['user_email'] = email

            return jsonify({"success": True, "message": "Account created successfully!", "user": {"name": name, "email": email}}), 201
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({"success": False, "error": "Email already registered"}), 400

    except Exception as exc:
        logger.exception("Error in handle_signup endpoint")
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route('/api/login', methods=['POST'])
def handle_login():
    try:
        data = request.json or {}
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()

        if not email or not password:
            return jsonify({"success": False, "error": "Email and password are required"}), 400

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email, password FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        conn.close()

        if user and check_password_hash(user[3], password):
            session['user_id'] = user[0]
            session['user_name'] = user[1]
            session['user_email'] = user[2]
            return jsonify({"success": True, "message": "Login successful!", "user": {"name": user[1], "email": user[2]}}), 200
        else:
            return jsonify({"success": False, "error": "Invalid email or password"}), 401

    except Exception as exc:
        logger.exception("Error in handle_login endpoint")
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route('/api/logout', methods=['POST', 'GET'])
def handle_logout():
    session.clear()
    return jsonify({"success": True, "message": "Logged out successfully"}), 200

@app.route('/api/user-status', methods=['GET'])
def get_user_status():
    if 'user_id' in session:
        return jsonify({
            "logged_in": True,
            "user": {
                "id": session['user_id'],
                "name": session['user_name'],
                "email": session['user_email']
            }
        })
    return jsonify({"logged_in": False})

@app.route('/api/history', methods=['GET'])
def get_user_history():
    if 'user_id' not in session:
        return jsonify({"success": False, "error": "Unauthorized"}), 401
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT activity_type, content, created_at FROM user_history WHERE user_id = ? ORDER BY id DESC LIMIT 10", (session['user_id'],))
    rows = cursor.fetchall()
    conn.close()

    history = [{"type": r[0], "content": r[1], "date": r[2]} for r in rows]
    return jsonify({"success": True, "history": history})

# --- Translation & Hub Endpoints ---

@app.route('/api/translate', methods=['POST'])
def handle_translate():
    try:
        data = request.json or {}
        text = data.get("text", "").strip()
        from_lang = data.get("from_lang", "auto")
        target_lang = data.get("to_lang") or data.get("target_lang") or "hi"

        if not text:
            return jsonify({"success": False, "error": "No text provided for translation"}), 400

        result = translator.translate_text(
            text=text, 
            target_lang=target_lang, 
            source_lang=from_lang
        )

        if result.get("success") and result.get("translated_text"):
            user_id = session.get('user_id')
            threading.Thread(
                target=log_user_activity, 
                args=(user_id, 'Quick Translation', text)
            ).start()

        return jsonify(result), 200
    except Exception as exc:
        logger.exception("Error in handle_translate endpoint")
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route('/api/translate-pdf', methods=['POST'])
def handle_translate_pdf():
    try:
        if 'pdf_file' not in request.files:
            return jsonify({"success": False, "error": "No PDF file attached"}), 400

        file = request.files['pdf_file']
        from_lang = request.form.get("from_lang", "auto")
        target_lang = request.form.get("to_lang", "hi")

        if file.filename == '':
            return jsonify({"success": False, "error": "No selected file"}), 400

        if not file.filename.lower().endswith('.pdf'):
            return jsonify({"success": False, "error": "File must be a PDF"}), 400

        result = translator.translate_pdf(
            pdf_stream=file.stream, 
            target_lang=target_lang, 
            source_lang=from_lang
        )
        
        if result.get("success"):
            user_id = session.get('user_id')
            threading.Thread(
                target=log_user_activity, 
                args=(user_id, 'PDF Translation', file.filename)
            ).start()

        return jsonify(result), 200
    except Exception as exc:
        logger.exception("Error in PDF translation endpoint")
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route('/api/generate-hub', methods=['POST'])
def handle_generate_hub():
    try:
        data = request.json or {}
        text = data.get("text", "").strip()
        to_lang_code = data.get("to_lang", "hi")
        target_dialect = LANG_CODE_TO_NAME.get(to_lang_code.lower(), "Hindi")
        student_level = data.get("level", "Class 6–8")
        user_mode = data.get("mode", "student")

        if not text:
            return jsonify({"success": False, "error": "No lesson topic or content provided"}), 400

        # 1. Instant Memory Cache Check (< 10ms response)
        cache_key = f"{text.lower()}_{to_lang_code}_{student_level}_{user_mode}"
        if cache_key in RESPONSE_CACHE:
            return jsonify(RESPONSE_CACHE[cache_key]), 200

        # 2. Fast Single-Pass AI Text Generation (< 1 sec)
        response = ai_engine.generate_vernacular_lesson(
            input_text=text,
            target_dialect=target_dialect,
            student_level=student_level,
            mode=user_mode
        )

        if response.get("success") and "data" in response:
            response["data"]["to_lang"] = to_lang_code
            RESPONSE_CACHE[cache_key] = response

            user_id = session.get('user_id')
            threading.Thread(
                target=log_user_activity, 
                args=(user_id, f'AI Hub ({user_mode.capitalize()})', text)
            ).start()

        return jsonify(response), 200
    except Exception as exc:
        logger.exception("Error in handle_generate_hub endpoint")
        return jsonify({"success": False, "error": str(exc)}), 500

# Server-Sent Events (SSE) Streaming Endpoint for Sub-200ms Token Delivery
@app.route('/api/generate-hub-stream', methods=['POST'])
def handle_generate_hub_stream():
    try:
        data = request.json or {}
        text = data.get("text", "").strip()
        to_lang_code = data.get("to_lang", "hi")
        target_dialect = LANG_CODE_TO_NAME.get(to_lang_code.lower(), "Hindi")
        student_level = data.get("level", "Class 6–8")
        user_mode = data.get("mode", "student")

        if not text:
            return jsonify({"success": False, "error": "No lesson topic or content provided"}), 400

        def stream_generator():
            for chunk in ai_engine.stream_vernacular_lesson(
                input_text=text,
                target_dialect=target_dialect,
                student_level=student_level,
                mode=user_mode
            ):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"

        user_id = session.get('user_id')
        threading.Thread(
            target=log_user_activity, 
            args=(user_id, f'AI Hub Stream ({user_mode.capitalize()})', text)
        ).start()

        return Response(stream_generator(), mimetype='text/event-stream')
    except Exception as exc:
        logger.exception("Error in handle_generate_hub_stream SSE endpoint")
        return jsonify({"success": False, "error": str(exc)}), 500

# Dedicated On-Demand TTS Endpoint (Lazy-loaded when user clicks "Play Audio")
@app.route('/api/generate-tts', methods=['POST'])
def handle_generate_tts():
    try:
        data = request.json or {}
        text = data.get("text", "").strip()
        lang_code = data.get("lang", "hi")

        if not text:
            return jsonify({"success": False, "error": "No text provided for TTS synthesis"}), 400

        tts_res = translator.generate_tts(text, lang=lang_code)
        return jsonify({"success": True, "audio_url": tts_res.get("audio_url")}), 200
    except Exception as exc:
        logger.exception("Error in handle_generate_tts endpoint")
        return jsonify({"success": False, "error": str(exc)}), 500

if __name__ == '__main__':
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)
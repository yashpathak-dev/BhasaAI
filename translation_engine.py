import os
import hashlib
import logging
from typing import Dict, Any, Optional
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TranslationEngine")

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

try:
    from gtts import gTTS
except ImportError:
    gTTS = None

try:
    import pypdf
except ImportError:
    pypdf = None


class TranslationEngine:
    LANGUAGE_CATALOG = {
        "hi": "Hindi", "hindi": "Hindi",
        "bn": "Bengali", "bengali": "Bengali",
        "mr": "Marathi", "marathi": "Marathi",
        "ta": "Tamil", "tamil": "Tamil",
        "te": "Telugu", "telugu": "Telugu",
        "bho": "Bhojpuri", "bhojpuri": "Bhojpuri",
        "awa": "Awadhi", "awadhi": "Awadhi",
        "en": "English", "english": "English"
    }

    def __init__(self, audio_dir: Optional[str] = None):
        base_dir = Path(__file__).resolve().parent
        self.audio_dir = Path(audio_dir) if audio_dir else base_dir / "static" / "audio"
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        self.api_key = os.getenv("GEMINI_API_KEY") or "AIzaSyBJ46o9ejN-1dB_f2gBHtk3hcsSYgIqFtE"
        self.client = genai.Client(api_key=self.api_key) if (genai is not None and self.api_key) else None

    def resolve_code(self, lang_name: str) -> str:
        cleaned = (lang_name or "").strip().lower()
        return self.LANGUAGE_CATALOG.get(cleaned, "Hindi")

    def translate_text(self, text: str, target_lang: str, source_lang: str = "auto") -> Dict[str, Any]:
        if not text or not text.strip():
            return {"success": False, "error": "Empty text", "translated_text": ""}

        target_language_name = self.resolve_code(target_lang)

        if self.client is not None:
            try:
                prompt = f"Translate the following text accurately into {target_language_name}. Return ONLY the translated text without extra formatting, notes, or quotes:\n\n{text.strip()}"
                response = self.client.models.generate_content(
                    model="gemini-3.6-flash",
                    contents=prompt
                )
                translated = response.text.strip() if response and response.text else ""
                if translated:
                    return {
                        "success": True,
                        "original_text": text,
                        "translated_text": translated,
                        "target_lang": target_lang
                    }
            except Exception as exc:
                logger.warning("Gemini translation failed: %s", exc)

        return {
            "success": False,
            "error": "Translation service is temporarily busy. Please check your API key or network.",
            "translated_text": text
        }

    def translate_pdf(self, pdf_stream, target_lang: str, source_lang: str = "auto") -> Dict[str, Any]:
        if pypdf is None:
            return {"success": False, "error": "pypdf library is missing. Install using: pip install pypdf"}

        try:
            reader = pypdf.PdfReader(pdf_stream)
            translated_pages = []

            for page_num, page in enumerate(reader.pages):
                raw_text = page.extract_text() or ""
                if not raw_text.strip():
                    continue

                paragraphs = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
                translated_paragraphs = []

                for para in paragraphs:
                    if len(para) > 1000:
                        chunks = [para[i:i+1000] for i in range(0, len(para), 1000)]
                        for chunk in chunks:
                            res = self.translate_text(chunk, target_lang, source_lang=source_lang)
                            translated_paragraphs.append(res.get("translated_text", chunk))
                    else:
                        res = self.translate_text(para, target_lang, source_lang=source_lang)
                        translated_paragraphs.append(res.get("translated_text", para))

                translated_pages.append(
                    f"--- Page {page_num + 1} ---\n" + "\n\n".join(translated_paragraphs)
                )

            if not translated_pages:
                return {"success": False, "error": "No readable text found in PDF"}

            full_text = "\n\n".join(translated_pages)
            return {
                "success": True,
                "total_pages": len(reader.pages),
                "translated_text": full_text
            }
        except Exception as exc:
            logger.exception("PDF Translation Exception")
            return {"success": False, "error": f"Failed to parse PDF: {str(exc)}"}

    def generate_tts(self, text: str, lang: str = "hi") -> Dict[str, Any]:
        if not text or not text.strip() or gTTS is None:
            return {"success": False, "audio_url": None}

        # gTTS uses standard language code prefix (e.g. 'hi', 'bn', 'en')
        code_map = {"Hindi": "hi", "Bengali": "bn", "Marathi": "mr", "Tamil": "ta", "Telugu": "te", "Bhojpuri": "hi", "Awadhi": "hi", "English": "en"}
        lang_name = self.resolve_code(lang)
        gtts_lang = code_map.get(lang_name, "hi")

        file_hash = hashlib.sha256(f"{gtts_lang}_{text[:500]}".encode("utf-8")).hexdigest()[:16]
        filename = f"speech_{file_hash}.mp3"
        filepath = self.audio_dir / filename
        web_url = f"/static/audio/{filename}"

        if filepath.exists():
            return {"success": True, "audio_url": web_url}

        try:
            tts = gTTS(text=text[:1000], lang=gtts_lang)
            tts.save(str(filepath))
            return {"success": True, "audio_url": web_url}
        except Exception as exc:
            return {"success": False, "error": str(exc), "audio_url": None}
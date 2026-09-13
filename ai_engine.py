import json
import logging
import os
import re
import time
import math
import difflib
from typing import Any, Dict, Generator, Optional

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("AIPedagogyEngine")

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None


class VectorSemanticRAG:
    """Lightweight zero-dependency cosine similarity vector search engine for offline RAG."""
    def __init__(self):
        self.vector_index = {}

    def text_to_vector(self, text: str) -> dict:
        words = re.findall(r'\w+', text.lower())
        vector = {}
        for word in words:
            vector[word] = vector.get(word, 0) + 1
        return vector

    def cosine_similarity(self, vec1: dict, vec2: dict) -> float:
        intersection = set(vec1.keys()) & set(vec2.keys())
        numerator = sum([vec1[x] * vec2[x] for x in intersection])
        sum1 = sum([val ** 2 for val in vec1.values()])
        sum2 = sum([val ** 2 for val in vec2.values()])
        if sum1 == 0 or sum2 == 0:
            return 0.0
        return numerator / (math.sqrt(sum1) * math.sqrt(sum2))

    def index_ncert_database(self, ncert_data: dict):
        for key, content in ncert_data.items():
            combined_text = f"{content.get('topic', '')} {content.get('simple_explanation', '')}"
            self.vector_index[key] = self.text_to_vector(combined_text)

    def semantic_search(self, query: str, ncert_data: dict, threshold: float = 0.15) -> Optional[dict]:
        if not self.vector_index and ncert_data:
            self.index_ncert_database(ncert_data)

        query_vec = self.text_to_vector(query)
        best_match_key = None
        highest_score = 0.0

        for key, doc_vec in self.vector_index.items():
            score = self.cosine_similarity(query_vec, doc_vec)
            if score > highest_score:
                highest_score = score
                best_match_key = key

        if highest_score >= threshold and best_match_key:
            logger.info("Vector semantic match found: '%s' with score %.2f", best_match_key, highest_score)
            return ncert_data[best_match_key]
        return None


class VernacularPedagogyEngine:
    SUPPORTED_DIALECTS = [
        # Major Indian Languages
        "Hindi",
        "Bengali",
        "Marathi",
        "Tamil",
        "Telugu",
        "Gujarati",
        "Kannada",
        "Malayalam",
        "Punjabi",
        "Odia",
        "Assamese",
        "Urdu",
        # Regional & Tribal Dialects
        "Santali",
        "Bhojpuri",
        "Awadhi",
        "Maithili",
        "Dogri",
        "Bodo",
        "Magahi",
        "Chhattisgarhi",
        # Global Languages
        "English",
        "Spanish",
        "French",
        "German",
        "Chinese",
        "Japanese",
        "Arabic",
        "Russian",
        "Portuguese",
    ]
    STUDENT_LEVELS = ["Beginner", "Class 6–8", "Class 9–10", "Class 11–12"]

    # Flash model configuration optimized for ultra-low latency generation
    DEFAULT_MODEL_NAME = "gemini-3.6-flash"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model_name = self.DEFAULT_MODEL_NAME
        self.client = None
        self.vector_rag = VectorSemanticRAG()

        if self.api_key and genai is not None:
            try:
                self.client = genai.Client(api_key=self.api_key)
                logger.info(
                    "Google GenAI Client initialized successfully."
                )
            except Exception as exc:
                logger.error("Error initializing GenAI Client: %s", exc)

    def _get_student_prompt(
        self, input_text: str, target_dialect: str, student_level: str
    ) -> str:
        return f"""
Produce a concise learning module for:
TOPIC: "{input_text}"
LANGUAGE: {target_dialect}
LEVEL: {student_level}

Keep sentences extremely brief for maximum speed. Return ONLY a valid JSON object matching this exact schema:
{{
  "topic": "{input_text}",
  "dialect": "{target_dialect}",
  "student_level": "{student_level}",
  "simple_explanation": "Concise explanation in {target_dialect}.",
  "cultural_real_life_example": "Brief example in {target_dialect}.",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "quiz": [
    {{
      "id": 1,
      "question": "Short question?",
      "options": {{"A": "1", "B": "2", "C": "3", "D": "4"}},
      "correct_answer": "A",
      "explanation": "Brief reasoning."
    }}
  ],
  "glossary": [
    {{"term": "Term", "vernacular_term": "Meaning", "definition": "Short def"}}
  ]
}}
"""

    def _get_teacher_prompt(
        self, input_text: str, target_dialect: str, student_level: str
    ) -> str:
        return f"""
Produce a fast 45-min lesson plan overview for teachers:
TOPIC: "{input_text}"
LANGUAGE: {target_dialect}
LEVEL: {student_level}

Return ONLY a valid JSON object matching this exact schema:
{{
  "topic": "{input_text}",
  "dialect": "{target_dialect}",
  "student_level": "{student_level}",
  "simple_explanation": "Objective in {target_dialect}.",
  "cultural_real_life_example": "Strategy in {target_dialect}.",
  "key_points": ["0-10m Hook", "10-25m Core", "25-35m Activity", "35-45m Wrap"],
  "glossary": [
    {{"term": "Board Note", "vernacular_term": "Key Formula", "definition": "Short text"}}
  ],
  "quiz": [
    {{
      "id": 1,
      "question": "Worksheet Q?",
      "options": {{"A": "Ans 1", "B": "Ans 2", "C": "Ans 3", "D": "Ans 4"}},
      "correct_answer": "A",
      "explanation": "Teacher guide."
    }}
  ]
}}
"""

    def clean_json_response(self, raw_text: str) -> str:
        text = raw_text.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            lines = lines[1:-1] if lines[-1].startswith("```") else lines[1:]
            text = "\n".join(lines).strip()
        match = re.search(r"(\{[\s\S]*\})", text)
        return match.group(1) if match else text

    def semantic_offline_lookup(self, query_text: str, ncert_data: dict) -> dict:
        matched_doc = self.vector_rag.semantic_search(query_text, ncert_data)
        if matched_doc:
            return {"success": True, "data": matched_doc, "is_fallback": True}
        
        # Fallback to difflib if vector cosine threshold isn't met
        topics = list(ncert_data.keys())
        best_match = difflib.get_close_matches(query_text.lower(), topics, n=1, cutoff=0.3)
        if best_match:
            return {"success": True, "data": ncert_data[best_match[0]], "is_fallback": True}
            
        return {"success": False, "error": "No matching offline concept found."}

    def generate_from_image(
        self, image_bytes: bytes, mime_type: str = "image/jpeg", target_dialect: str = "Hindi", student_level: str = "Class 6–8"
    ) -> Dict[str, Any]:
        if not self.api_key or genai is None or self.client is None:
            return {"success": False, "error": "API key missing or client uninitialized."}

        matched_dialect = next((d for d in self.SUPPORTED_DIALECTS if d.lower() == target_dialect.strip().lower()), "Hindi")
        normalized_level = student_level.strip().replace("-", "–")

        prompt = f"""
[SYSTEM: MULTIMODAL OCR PEDAGOGY ENGINE]
Analyze the provided textbook diagram, handwritten note, or image. Extract the core concept and explain it entirely in {matched_dialect} for a {normalized_level} student.
Return ONLY a valid JSON object matching this schema:
{{
  "topic": "Extracted Topic Title",
  "dialect": "{matched_dialect}",
  "student_level": "{normalized_level}",
  "simple_explanation": "Detailed visual breakdown in {matched_dialect}.",
  "cultural_real_life_example": "Real-world analogy.",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "quiz": [{{"id": 1, "question": "Visual concept Q?", "options": {{"A": "1", "B": "2", "C": "3", "D": "4"}}, "correct_answer": "A", "explanation": "Rationale"}}],
  "glossary": [{{"term": "Diagram Label", "vernacular_term": "Translation", "definition": "Definition"}}]
}}
"""
        try:
            image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[image_part, prompt],
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    max_output_tokens=800,
                    response_mime_type="application/json",
                ),
            )
            cleaned_json = self.clean_json_response(response.text)
            return {"success": True, "data": json.loads(cleaned_json), "is_fallback": False}
        except Exception as exc:
            logger.error("Multimodal OCR inference failed: %s", exc)
            return {"success": False, "error": f"Image processing failed: {str(exc)}"}

    def generate_vernacular_lesson(
        self,
        input_text: str,
        target_dialect: str = "Hindi",
        student_level: str = "Class 6–8",
        mode: str = "student",
        max_retries: int = 1,
    ) -> Dict[str, Any]:
        if not input_text or not input_text.strip():
            return {"success": False, "error": "Input text cannot be empty."}

        matched_dialect = next(
            (
                d
                for d in self.SUPPORTED_DIALECTS
                if d.lower() == target_dialect.strip().lower()
            ),
            "Hindi",
        )
        normalized_level = student_level.strip().replace("-", "–")

        if not self.api_key or genai is None or self.client is None:
            return {
                "success": False,
                "error": "API key missing or GenAI client not initialized.",
            }

        prompt = (
            self._get_teacher_prompt(
                input_text, matched_dialect, normalized_level
            )
            if mode == "teacher"
            else self._get_student_prompt(
                input_text, matched_dialect, normalized_level
            )
        )

        for attempt in range(1, max_retries + 1):
            try:
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        top_p=0.8,
                        max_output_tokens=1000,
                        response_mime_type="application/json",
                    ),
                )
                cleaned_json = self.clean_json_response(response.text)
                parsed_data = json.loads(cleaned_json)
                return {
                    "success": True,
                    "data": parsed_data,
                    "is_fallback": False,
                }
            except Exception as exc:
                logger.warning("Attempt %d failed: %s", attempt, exc)
                if attempt < max_retries:
                    time.sleep(0.2)

        return {
            "success": False,
            "error": "Failed to generate lesson from GenAI service.",
        }

    def stream_vernacular_lesson(
        self,
        input_text: str,
        target_dialect: str = "Hindi",
        student_level: str = "Class 6–8",
        mode: str = "student",
    ) -> Generator[str, None, None]:
        if not self.api_key or genai is None or self.client is None:
            yield json.dumps(
                {"error": "API key missing or GenAI client not initialized."}
            )
            return

        matched_dialect = next(
            (
                d
                for d in self.SUPPORTED_DIALECTS
                if d.lower() == target_dialect.strip().lower()
            ),
            "Hindi",
        )
        normalized_level = student_level.strip().replace("-", "–")
        prompt = (
            self._get_teacher_prompt(
                input_text, matched_dialect, normalized_level
            )
            if mode == "teacher"
            else self._get_student_prompt(
                input_text, matched_dialect, normalized_level
            )
        )

        try:
            response_stream = self.client.models.generate_content_stream(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    top_p=0.8,
                    max_output_tokens=1000,
                    response_mime_type="application/json",
                ),
            )
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception as exc:
            logger.error("Error in streaming vernacular lesson: %s", exc)
            yield json.dumps({"error": str(exc)})
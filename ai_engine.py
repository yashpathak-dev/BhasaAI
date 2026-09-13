import json
import logging
import os
import re
import time
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


class VernacularPedagogyEngine:
    SUPPORTED_DIALECTS = [
        "Hindi",
        "Bhojpuri",
        "Awadhi",
        "Marathi",
        "Bengali",
        "Tamil",
        "Telugu",
        "English",
    ]
    STUDENT_LEVELS = ["Beginner", "Class 6–8", "Class 9–10", "Class 11–12"]

    # Flash model configuration for ultra-low latency generation
    DEFAULT_MODEL_NAME = "gemini-3.6-flash"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model_name = self.DEFAULT_MODEL_NAME
        self.client = None

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
You are an expert school teacher and vernacular educator for Indian students. Create an engaging, concise learning module.

INPUT TOPIC / TEXT: "{input_text}"
TARGET DIALECT / LANGUAGE: {target_dialect}
STUDENT LEVEL: {student_level}

CRITICAL INSTRUCTION: Translate and explain the ENTIRE lesson strictly in {target_dialect} tailored specifically for a {student_level} student. Keep sentences concise to maximize generation speed.

Return ONLY a valid JSON object matching this schema:
{{
  "topic": "{input_text}",
  "dialect": "{target_dialect}",
  "student_level": "{student_level}",
  "simple_explanation": "A clear, comprehensive explanation written in {target_dialect}.",
  "cultural_real_life_example": "A relatable real-life Indian context or story in {target_dialect}.",
  "key_points": ["Point 1 in {target_dialect}", "Point 2 in {target_dialect}", "Point 3 in {target_dialect}"],
  "quiz": [
    {{
      "id": 1,
      "question": "Question in {target_dialect}?",
      "options": {{"A": "Option 1", "B": "Option 2", "C": "Option 3", "D": "Option 4"}},
      "correct_answer": "A",
      "explanation": "Explanation in {target_dialect}."
    }}
  ],
  "glossary": [
    {{"term": "Key Term", "vernacular_term": "Dialect meaning in {target_dialect}", "definition": "Simple definition in {target_dialect}"}}
  ]
}}
"""

    def _get_teacher_prompt(
        self, input_text: str, target_dialect: str, student_level: str
    ) -> str:
        return f"""
You are a Master Vernacular Pedagogy Trainer for Indian school teachers. Create a 45-minute Lesson Plan & Classroom Worksheet.

TOPIC: "{input_text}"
TARGET DIALECT / LANGUAGE: {target_dialect}
CLASS LEVEL: {student_level}

CRITICAL INSTRUCTION: Prepare lesson guidance in {target_dialect} (or bilingual with English technical terms).

Return ONLY a valid JSON object matching this schema:
{{
  "topic": "{input_text}",
  "dialect": "{target_dialect}",
  "student_level": "{student_level}",
  "simple_explanation": "TEACHING OBJECTIVE: Objectives of teaching '{input_text}' to {student_level} students in {target_dialect}.",
  "cultural_real_life_example": "PEDAGOGICAL STRATEGY: Classroom demonstration or story in {target_dialect}.",
  "key_points": [
    "⏱️ 0-10 Mins (Hook): Intro story in {target_dialect}",
    "⏱️ 10-25 Mins (Core Concept): Main explanation & board work",
    "⏱️ 25-35 Mins (Activity): Classroom group discussion task",
    "⏱️ 35-45 Mins (Wrap-up): Recap and quick evaluation"
  ],
  "glossary": [
    {{"term": "Board Note 1", "vernacular_term": "Key Formula/Definition", "definition": "Short text for blackboard"}}
  ],
  "quiz": [
    {{
      "id": 1,
      "question": "Worksheet Question 1 in {target_dialect}?",
      "options": {{"A": "Model Answer Point 1", "B": "Model Answer Point 2", "C": "Key Takeaway", "D": "Common Mistake to Avoid"}},
      "correct_answer": "A",
      "explanation": "Teacher Guide: How to grade or explain this question."
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

    def generate_vernacular_lesson(
        self,
        input_text: str,
        target_dialect: str = "Hindi",
        student_level: str = "Class 6–8",
        mode: str = "student",
        max_retries: int = 2,
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
                        temperature=0.3,
                        top_p=0.9,
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
                    time.sleep(0.5)

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
                    temperature=0.3,
                    top_p=0.9,
                    response_mime_type="application/json",
                ),
            )
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception as exc:
            logger.error("Error in streaming vernacular lesson: %s", exc)
            yield json.dumps({"error": str(exc)})
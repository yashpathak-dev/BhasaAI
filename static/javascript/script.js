document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = '/api';

    // ==========================================
    // 0. Dark Mode Initializer & Toggle Handler
    // ==========================================
    const darkModeToggle = document.getElementById("darkModeToggle");
    const currentTheme = localStorage.getItem("theme") || "light";

    if (currentTheme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        if (darkModeToggle) darkModeToggle.innerText = "☀️";
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener("click", () => {
            let theme = document.documentElement.getAttribute("data-theme");
            if (theme === "dark") {
                document.documentElement.setAttribute("data-theme", "light");
                localStorage.setItem("theme", "light");
                darkModeToggle.innerText = "🌙";
            } else {
                document.documentElement.setAttribute("data-theme", "dark");
                localStorage.setItem("theme", "dark");
                darkModeToggle.innerText = "☀️";
            }
        });
    }

    // ==========================================
    // 1. Voice Input Handler (Dynamic Language Speech Recognition)
    // ==========================================
    const recordBtn = document.getElementById("recordBtn");
    const inputText = document.getElementById("inputText");
    const fromLangSelect = document.getElementById("fromLanguage");

    if (recordBtn && inputText) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;

            recordBtn.addEventListener("click", () => {
                try {
                    const selectedLang = fromLangSelect ? fromLangSelect.value : 'hi-IN';
                    recognition.lang = selectedLang;

                    recognition.start();
                    recordBtn.innerText = "🎙️ Listening... Boliye";
                    recordBtn.style.background = "#fee2e2";
                    recordBtn.style.color = "#dc2626";
                } catch (err) {
                    console.warn("Speech recognition active/error:", err);
                }
            });

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                inputText.value = transcript;
            };

            recognition.onerror = (event) => {
                console.error("Speech Recognition Error:", event.error);
                alert("Voice recognition error: " + event.error);
                recordBtn.innerText = "🎤 Record Voice Input";
                recordBtn.style.background = "#f8fafc";
                recordBtn.style.color = "#4f46e5";
            };

            recognition.onend = () => {
                recordBtn.innerText = "🎤 Record Voice Input";
                recordBtn.style.background = "#f8fafc";
                recordBtn.style.color = "#4f46e5";
            };
        } else {
            recordBtn.addEventListener("click", () => {
                alert("Web Speech API is not supported in this browser. Please type your query manually.");
            });
        }
    }

    // ==========================================
    // 2. Quick Translation Handler
    // ==========================================
    const translateBtn = document.getElementById("bottomTranslateBtn");
    if (translateBtn) {
        translateBtn.addEventListener("click", async (e) => {
            e.preventDefault();

            const textVal = document.getElementById("bottomInputText")?.value.trim();
            const fromLang = document.getElementById("bottomFromLanguage")?.value || "auto";
            const targetLang = document.getElementById("bottomToLanguage")?.value || "hi";
            const outputBox = document.getElementById("translationOutput");

            if (!textVal) {
                alert("Please enter text to translate.");
                return;
            }

            if (outputBox) outputBox.innerText = "Translating...";

            try {
                const response = await fetch(`${API_BASE}/translate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: textVal,
                        from_lang: fromLang,
                        to_lang: targetLang
                    })
                });

                const data = await response.json();

                if (outputBox) {
                    outputBox.innerText = (data.success && data.translated_text) ? data.translated_text : (data.error || "Translation failed.");
                }
            } catch (error) {
                console.error("Translation Request Error:", error);
                if (outputBox) outputBox.innerText = "Error connecting to backend server.";
            }
        });
    }

    // ==========================================
    // 3. AI Learning Hub Generator Handler (Student & Teacher Mode Supported)
    // ==========================================
    const hubBtn = document.getElementById("generateHubBtn");
    if (hubBtn) {
        hubBtn.addEventListener("click", async (e) => {
            e.preventDefault();

            const lessonText = document.getElementById("inputText")?.value.trim();
            const targetLang = document.getElementById("toLanguage")?.value || "hi";
            const studentLevel = document.querySelector('input[name="studentLevel"]:checked')?.value || "Class 6–8";
            const userMode = document.querySelector('input[name="user_mode"]:checked')?.value || "student";

            const simpleExp = document.getElementById("simpleExplanation");
            const realEx = document.getElementById("realExample");
            const keyPointsList = document.getElementById("keyPointsList");
            const glossaryBox = document.getElementById("glossaryBox");
            const quizContainer = document.getElementById("quizContainer");
            const audioContainer = document.getElementById("audioContainer");
            const audioPlayer = document.getElementById("audioPlayer");

            if (!lessonText) {
                alert("Please enter lesson content or a concept topic.");
                return;
            }

            hubBtn.disabled = true;
            if (simpleExp) {
                simpleExp.innerText = userMode === "teacher" 
                    ? "Generating 45-min Teacher Lesson Plan & Assessment..." 
                    : "Generating vernacular learning hub...";
            }

            try {
                const response = await fetch(`${API_BASE}/generate-hub`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: lessonText,
                        to_lang: targetLang,
                        level: studentLevel,
                        mode: userMode
                    })
                });

                const result = await response.json();

                if (result.success && result.data) {
                    const data = result.data;

                    // Audio URL Handler
                    if (data.audio_url && audioPlayer && audioContainer) {
                        audioPlayer.src = data.audio_url;
                        audioContainer.style.display = "block";
                    } else if (audioContainer) {
                        audioContainer.style.display = "none";
                    }

                    // Explanations & Examples
                    if (simpleExp) simpleExp.innerText = data.simple_explanation || "-";
                    if (realEx) realEx.innerText = data.cultural_real_life_example || data.real_example || "-";

                    // Key Points List (Lesson Plan Timeline for Teachers)
                    if (keyPointsList) {
                        keyPointsList.innerHTML = "";
                        const points = data.key_points || [];
                        if (Array.isArray(points) && points.length > 0) {
                            points.forEach(pt => {
                                const li = document.createElement("li");
                                li.innerText = pt;
                                keyPointsList.appendChild(li);
                            });
                        } else {
                            keyPointsList.innerHTML = "<li>-</li>";
                        }
                    }

                    // Glossary Box (Board Notes / Key Concepts)
                    if (glossaryBox) {
                        glossaryBox.innerHTML = "";
                        const glossary = data.glossary || [];
                        if (Array.isArray(glossary) && glossary.length > 0) {
                            glossary.forEach(g => {
                                const item = document.createElement("div");
                                item.style.marginBottom = "6px";
                                item.innerHTML = `<strong>${g.term || ''}</strong> (${g.vernacular_term || ''}): ${g.definition || ''}`;
                                glossaryBox.appendChild(item);
                            });
                        } else {
                            glossaryBox.innerText = typeof data.glossary === 'string' ? data.glossary : "-";
                        }
                    }

                    // Interactive Quiz Container / Worksheet Renderer
                    if (quizContainer) {
                        quizContainer.innerHTML = "";
                        const quizList = data.quiz || [];
                        if (Array.isArray(quizList) && quizList.length > 0) {
                            quizList.forEach((q, qIndex) => {
                                const qCard = document.createElement("div");
                                qCard.style.cssText = "background:#ffffff; border:1px solid #e2e8f0; padding:12px; border-radius:12px; margin-bottom:12px;";

                                let optionsHtml = "";
                                if (q.options) {
                                    optionsHtml = Object.entries(q.options).map(([optKey, optVal]) => `
                                        <button type="button" class="quiz-opt-btn" data-key="${optKey}" style="display:block; width:100%; text-align:left; padding:8px 12px; margin:5px 0; border:1.5px solid #cbd5e1; border-radius:8px; background:#f8fafc; cursor:pointer; font-size:13px; font-weight:500; transition:all 0.2s;">
                                            <b>${optKey}:</b> ${optVal}
                                        </button>
                                    `).join("");
                                }

                                qCard.innerHTML = `
                                    <div style="font-weight:700; color:#0f172a; margin-bottom:8px; font-size:14px;">Q${qIndex + 1}: ${q.question || ''}</div>
                                    <div class="quiz-options-list">${optionsHtml}</div>
                                    <div class="quiz-feedback" style="display:none; margin-top:8px; font-size:12px; padding:8px 12px; border-radius:8px; font-weight:600;"></div>
                                `;

                                const optButtons = qCard.querySelectorAll(".quiz-opt-btn");
                                const feedbackBox = qCard.querySelector(".quiz-feedback");

                                optButtons.forEach(btn => {
                                    btn.addEventListener("click", () => {
                                        const selected = btn.getAttribute("data-key");
                                        const correct = (q.correct_answer || "A").trim().toUpperCase();

                                        optButtons.forEach(b => {
                                            b.disabled = true;
                                            b.style.cursor = "default";
                                        });

                                        if (selected === correct) {
                                            btn.style.background = "#dcfce7";
                                            btn.style.borderColor = "#22c55e";
                                            btn.style.color = "#15803d";
                                            feedbackBox.style.display = "block";
                                            feedbackBox.style.background = "#f0fdf4";
                                            feedbackBox.style.color = "#15803d";
                                            feedbackBox.style.border = "1px solid #bbf7d0";
                                            feedbackBox.innerHTML = `✅ <b>Sahi Utar!</b> ${q.explanation || ''}`;
                                        } else {
                                            btn.style.background = "#fee2e2";
                                            btn.style.borderColor = "#ef4444";
                                            btn.style.color = "#b91c1c";

                                            optButtons.forEach(b => {
                                                if (b.getAttribute("data-key") === correct) {
                                                    b.style.background = "#dcfce7";
                                                    b.style.borderColor = "#22c55e";
                                                    b.style.color = "#15803d";
                                                }
                                            });

                                            feedbackBox.style.display = "block";
                                            feedbackBox.style.background = "#fef2f2";
                                            feedbackBox.style.color = "#b91c1c";
                                            feedbackBox.style.border = "1px solid #fecaca";
                                            feedbackBox.innerHTML = `❌ <b>Galat Utar.</b> Sahi utar <b>(${correct})</b> hai. ${q.explanation || ''}`;
                                        }
                                    });
                                });

                                quizContainer.appendChild(qCard);
                            });
                        } else {
                            quizContainer.innerText = typeof data.quiz === 'string' ? data.quiz : "-";
                        }
                    }
                } else {
                    if (simpleExp) simpleExp.innerText = result.error || "Generation failed.";
                }

            } catch (error) {
                console.error("Learning Hub Error:", error);
                if (simpleExp) simpleExp.innerText = "Error connecting to AI service.";
            } finally {
                hubBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // 4. Textbook PDF Translator Handler
    // ==========================================
    const translatePdfBtn = document.getElementById("translatePdfBtn");
    if (translatePdfBtn) {
        translatePdfBtn.addEventListener("click", async (e) => {
            e.preventDefault();

            const fileInput = document.getElementById("pdfFileInput");
            const fromLang = document.getElementById("pdfFromLanguage")?.value || "auto";
            const targetLang = document.getElementById("pdfToLanguage")?.value || "hi";
            const outputBox = document.getElementById("pdfTranslationOutput");

            if (!fileInput || !fileInput.files.length) {
                alert("Please select a PDF file first.");
                return;
            }

            const file = fileInput.files[0];
            const formData = new FormData();
            formData.append("pdf_file", file);
            formData.append("from_lang", fromLang);
            formData.append("to_lang", targetLang);

            translatePdfBtn.disabled = true;
            if (outputBox) outputBox.value = "Reading and translating PDF contents page-by-page... Please wait.";

            try {
                const response = await fetch(`${API_BASE}/translate-pdf`, {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (outputBox) {
                    outputBox.value = (data.success && data.translated_text) ? data.translated_text : (data.error || "PDF Translation failed.");
                }
            } catch (error) {
                console.error("PDF Request Error:", error);
                if (outputBox) outputBox.value = "Error connecting to backend server.";
            } finally {
                translatePdfBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // 5. Download Learning Hub Notes as PDF
    // ==========================================
    const downloadPdfBtn = document.getElementById("downloadPdfBtn");
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener("click", () => {
            const hubElement = document.getElementById("learningHubOutputCard");

            if (!hubElement) {
                alert("No content available to download.");
                return;
            }

            const options = {
                margin:       10,
                filename:     'Bhasa-AI_Vernacular_Notes.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(options).from(hubElement).save();
        });
    }
});
document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = '/api';

    // ==========================================
    // 1. Service Worker Registration (PWA App Shell)
    // ==========================================
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/static/sw.js')
                .then(reg => console.log('Service Worker Registered:', reg.scope))
                .catch(err => console.error('Service Worker Registration Failed:', err));
        });
    }

    // ==========================================
    // 2. Automatic Network State Monitor & UI Switcher
    // ==========================================
    function initAutoNetworkMonitor() {
        const badge = document.querySelector(".offline-badge");

        function updateStatus() {
            const isOnline = navigator.onLine;
            document.body.classList.toggle("offline-mode", !isOnline);

            if (badge) {
                if (isOnline) {
                    badge.style.background = "#dcfce7";
                    badge.style.color = "#15803d";
                    badge.style.borderColor = "#bbf7d0";
                    badge.innerHTML = "<span>🟢</span> Online (Gemini AI Active)";
                } else {
                    badge.style.background = "#fef3c7";
                    badge.style.color = "#b45309";
                    badge.style.borderColor = "#fde68a";
                    badge.innerHTML = "<span>⚡</span> Offline (Local NCERT Engine)";
                }
            }
        }

        window.addEventListener("online", updateStatus);
        window.addEventListener("offline", updateStatus);
        updateStatus();
    }

    initAutoNetworkMonitor();

    // ==========================================
    // 3. Dark Mode Initializer & Toggle Handler
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
    // 3.1 Village Mode Initializer & Toggle Handler
    // ==========================================
    const villageModeToggle = document.getElementById("villageModeToggle");
    const currentVillageMode = localStorage.getItem("bhasa_village_mode") === "true";

    if (currentVillageMode) {
        document.body.classList.add("village-mode");
    }

    if (villageModeToggle) {
        villageModeToggle.addEventListener("click", () => {
            document.body.classList.toggle("village-mode");
            const isVillage = document.body.classList.contains("village-mode");
            localStorage.setItem("bhasa_village_mode", isVillage);
        });
    }

    // ==========================================
    // 4. Voice Input Handler (Dynamic Speech Recognition)
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
                resetRecordBtn();
            };

            recognition.onend = () => { resetRecordBtn(); };

            function resetRecordBtn() {
                recordBtn.innerText = "🎤 Record Voice Input";
                recordBtn.style.background = "#f8fafc";
                recordBtn.style.color = "#4f46e5";
            }
        } else {
            recordBtn.addEventListener("click", () => {
                alert("Web Speech API is not supported in this browser. Please type your query manually.");
            });
        }
    }

    // ==========================================
    // 5. Hybrid Audio Engine (Cloud TTS Online + Native Web Speech Offline)
    // ==========================================
    async function playAudioSmart(textToPlay, targetLang, playBtn, audioPlayer) {
        if (!navigator.onLine) {
            if ('speechSynthesis' in window) {
                playBtn.innerText = "🔊 Reading Offline...";
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(textToPlay);
                utterance.lang = (targetLang === 'bho' || targetLang === 'awa') ? 'hi-IN' : `${targetLang}-IN`;
                utterance.onend = () => { playBtn.innerText = "🔊 Listen"; };
                utterance.onerror = () => { playBtn.innerText = "🔊 Listen"; };
                window.speechSynthesis.speak(utterance);
                return;
            } else {
                alert("Offline speech synthesis is not supported in this browser.");
                return;
            }
        }

        playBtn.innerText = "⏳ Synthesizing...";
        try {
            const ttsRes = await fetch(`${API_BASE}/generate-tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textToPlay, lang: targetLang })
            });
            const ttsData = await ttsRes.json();

            if (ttsData.success && ttsData.audio_url) {
                if (audioPlayer) {
                    audioPlayer.src = ttsData.audio_url;
                    audioPlayer.play();
                } else {
                    new Audio(ttsData.audio_url).play();
                }
                playBtn.innerText = "🔊 Replay";
            } else {
                throw new Error("Cloud TTS response unsuccessful");
            }
        } catch (err) {
            console.warn("Cloud TTS failed, initiating native speech fallback:", err);
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(textToPlay);
                utterance.lang = 'hi-IN';
                window.speechSynthesis.speak(utterance);
            }
            playBtn.innerText = "🔊 Listen";
        }
    }

    // ==========================================
    // 5.1 Gamified Streaks & Badges Evaluation
    // ==========================================
    function checkAndAwardBadge(quizScore) {
        let streak = parseInt(localStorage.getItem('bhasa_streak') || '0', 10);
        if (quizScore >= 80) {
            streak += 1;
            localStorage.setItem('bhasa_streak', streak);
        }
        let badges = JSON.parse(localStorage.getItem('bhasa_badges') || '[]');
        if (streak >= 3 && !badges.includes('Streak Master')) {
            badges.push('Streak Master');
            localStorage.setItem('bhasa_badges', JSON.stringify(badges));
            alert('🎉 Milestone Unlocked: Streak Master Badge Earned!');
        }
    }

    // ==========================================
    // 6. UI Renderer (Explanations, Quiz & Audio Controls)
    // ==========================================
    function renderHubUI(data, userMode, targetLang) {
        const simpleExp = document.getElementById("simpleExplanation");
        const realEx = document.getElementById("realExample");
        const keyPointsList = document.getElementById("keyPointsList");
        const glossaryBox = document.getElementById("glossaryBox");
        const quizContainer = document.getElementById("quizContainer");
        const audioContainer = document.getElementById("audioContainer");
        const audioPlayer = document.getElementById("audioPlayer");

        if (simpleExp) simpleExp.innerText = data.simple_explanation || "-";
        if (realEx) realEx.innerText = data.cultural_real_life_example || data.real_example || "-";

        // Bind dedicated Speak button functionality
        const speakExplanationBtn = document.getElementById("speakExplanationBtn");
        if (speakExplanationBtn && data.simple_explanation) {
            speakExplanationBtn.onclick = () => playAudioSmart(data.simple_explanation, targetLang, speakExplanationBtn, audioPlayer);
        }

        // Bind WhatsApp Share functionality
        const whatsappShareBtn = document.getElementById("whatsappShareBtn");
        if (whatsappShareBtn) {
            whatsappShareBtn.onclick = () => {
                const title = document.getElementById("inputText")?.value || "Learning Hub Lesson";
                const explanation = data.simple_explanation || "";
                const message = encodeURIComponent(`📚 *Bhasa-AI Learning Hub*\n\n*Topic:* ${title}\n\n${explanation}\n\n_Generated via Bhasa-AI Edge Platform_`);
                window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
            };
        }

        if (audioContainer && data.simple_explanation) {
            audioContainer.style.display = "block";
            let playBtn = document.getElementById("playAudioBtn");
            if (!playBtn) {
                playBtn = document.createElement("button");
                playBtn.id = "playAudioBtn";
                playBtn.style.cssText = "padding:8px 16px; background:#4f46e5; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600; margin-top:8px;";
                playBtn.innerText = "🔊 Listen to Lesson";
                audioContainer.appendChild(playBtn);
            }

            playBtn.onclick = () => playAudioSmart(data.simple_explanation, targetLang, playBtn, audioPlayer);
        }

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

        if (quizContainer) {
            quizContainer.innerHTML = "";
            const quizList = data.quiz || [];
            if (Array.isArray(quizList) && quizList.length > 0) {
                let totalCorrectCount = 0;
                let answeredQuestionsCount = 0;

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

                            answeredQuestionsCount++;
                            if (selected === correct) {
                                totalCorrectCount++;
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

                            if (answeredQuestionsCount === quizList.length) {
                                const finalScorePercent = Math.round((totalCorrectCount / quizList.length) * 100);
                                checkAndAwardBadge(finalScorePercent);
                            }
                        });
                    });

                    quizContainer.appendChild(qCard);
                });
            } else {
                quizContainer.innerText = typeof data.quiz === 'string' ? data.quiz : "-";
            }
        }
    }

    // ==========================================
    // 7. Ultra-Fast AI Hub Generator (SSE Real-Time Stream + IndexedDB Offline Storage + Semantic RAG Fallback)
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

            if (!lessonText) {
                alert("Please enter lesson content or a concept topic.");
                return;
            }

            const cacheKey = `bhasa_cache_${lessonText.toLowerCase()}_${targetLang}_${userMode}`;
            hubBtn.disabled = true;

            if (simpleExp) {
                simpleExp.innerText = userMode === "teacher" 
                    ? "Generating 45-min Teacher Lesson Plan..." 
                    : "Connecting to streaming AI engine...";
            }

            // Async IndexedDB, Local File & Semantic RAG Fallback Processor
            async function processOfflineFallback() {
                try {
                    const res = await fetch('/static/data/ncert_db.json');
                    const ncertDB = await res.json();
                    const ncertKey = `${lessonText.toLowerCase()}_${targetLang}`;

                    if (ncertDB[ncertKey] || (ncertDB.chapters && ncertDB.chapters[ncertKey])) {
                        const content = ncertDB[ncertKey] || ncertDB.chapters[ncertKey].content[targetLang] || ncertDB.chapters[ncertKey];
                        renderHubUI(content, userMode, targetLang);
                        return true;
                    }

                    // Semantic keyword / similarity lookup simulation over database keys
                    const dbKeys = Object.keys(ncertDB);
                    const matchingKey = dbKeys.find(k => k.includes(lessonText.toLowerCase()) || lessonText.toLowerCase().includes(k.split('_')[0]));
                    if (matchingKey && ncertDB[matchingKey]) {
                        renderHubUI(ncertDB[matchingKey], userMode, targetLang);
                        return true;
                    }
                } catch (err) {
                    console.warn("NCERT local database check skipped:", err);
                }

                // Non-blocking IndexedDB Storage Check (Fallback to LocalStorage if window.idbKeyval undefined)
                try {
                    const savedCache = window.idbKeyval ? await window.idbKeyval.get(cacheKey) : localStorage.getItem(cacheKey);
                    if (savedCache) {
                        const parsed = typeof savedCache === 'string' ? JSON.parse(savedCache) : savedCache;
                        renderHubUI(parsed, userMode, targetLang);
                        return true;
                    }
                } catch (err) {
                    console.warn("IndexedDB read error:", err);
                }

                return false;
            }

            // OFFLINE EXECUTION ROUTE
            if (!navigator.onLine) {
                const found = await processOfflineFallback();
                if (!found && simpleExp) {
                    simpleExp.innerText = "⚠️ Offline Mode: Topic not cached yet. Connect online once to auto-save this topic.";
                }
                hubBtn.disabled = false;
                return;
            }

            // ULTRA-FAST REAL-TIME SSE STREAMING ROUTE (<200ms Token Start)
            try {
                const response = await fetch(`${API_BASE}/generate-hub-stream`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: lessonText,
                        to_lang: targetLang,
                        level: studentLevel,
                        mode: userMode
                    })
                });

                if (!response.ok) throw new Error("Stream connection failed");

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let accumulatedJsonText = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n\n");

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const dataStr = line.replace("data: ", "").trim();
                            if (dataStr === "[DONE]") break;

                            try {
                                const payload = JSON.parse(dataStr);
                                if (payload.chunk) {
                                    accumulatedJsonText += payload.chunk;
                                    if (simpleExp) simpleExp.innerText = "⚡ Streaming live response...";
                                }
                            } catch (e) { }
                        }
                    }
                }

                // Clean & Parse Final Streamed JSON Payload
                let cleanedJson = accumulatedJsonText.trim();
                if (cleanedJson.startsWith("```")) {
                    const jsonLines = cleanedJson.split("\n");
                    cleanedJson = jsonLines.slice(1, -1).join("\n");
                }

                const finalData = JSON.parse(cleanedJson);
                renderHubUI(finalData, userMode, targetLang);

                // Asynchronous Non-blocking Storage to IndexedDB
                if (window.idbKeyval) {
                    await window.idbKeyval.set(cacheKey, finalData);
                } else {
                    localStorage.setItem(cacheKey, JSON.stringify(finalData));
                }

            } catch (error) {
                console.warn("SSE stream failed, falling back to standard endpoint / offline cache:", error);
                
                // Fallback to standard endpoint if browser streaming fails
                try {
                    const fallbackRes = await fetch(`${API_BASE}/generate-hub`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: lessonText, to_lang: targetLang, level: studentLevel, mode: userMode })
                    });
                    const result = await fallbackRes.json();
                    if (result.success && result.data) {
                        renderHubUI(result.data, userMode, targetLang);
                        if (window.idbKeyval) await window.idbKeyval.set(cacheKey, result.data);
                    } else {
                        throw new Error("Standard endpoint failed");
                    }
                } catch (fallbackErr) {
                    const fallbackSuccess = await processOfflineFallback();
                    if (!fallbackSuccess && simpleExp) simpleExp.innerText = "⚠️ Connection error. Unable to generate or retrieve cached content.";
                }
            } finally {
                hubBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // 8. Textbook PDF Translator Handler
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
    // 9. Quick Translation Handler
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
    // 10. Download Learning Hub Notes as PDF
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
                margin:      10,
                filename:    'Bhasa-AI_Vernacular_Notes.pdf',
                image:       { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(options).from(hubElement).save();
        });
    }
});
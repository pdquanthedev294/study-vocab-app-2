let fileCatalog = [];
let activeFileId = localStorage.getItem('active_file_id') || 'all';
let vocabData = [];

let userProgress = JSON.parse(localStorage.getItem('vocab_app_progress')) || {
    stats: { totalAnswered: 0, correctCount: 0 },
    cardState: {},
    wrongList: []
};

let currentFcIndex = 0;
let currentQuizItem = null;
let currentSpellingItem = null;
let currentDictationItem = null;

// SPELLING CONFIG
let spellingConfig = {
    stageSizes: [5, 7, 10, 12, 15, 20],
    currentStageIndex: 0,
    stagesList: [],          
    currentQueue: [],        
    wrongQueue: [],          
    currentIndex: 0,
    isReviewingMistakes: false,
    retryCurrentWord: false,
    onModalCloseCallback: null
};

// IMAGE LEARNING CONFIG (CHIA GIAI ĐOẠN)
let imageLearningConfig = {
    stageSizes: [5, 7, 10, 12, 15, 20],
    currentStageIndex: 0,
    stagesList: [],
    currentQueue: [],
    wrongQueue: [],
    currentIndex: 0,
    isReviewingMistakes: false,
    retryCurrentWord: false,
    currentItem: null,
    imageRequestId: 0
};

// GAME CONFIGS
let speedMatchConfig = { selectedCards: [], timerInterval: null, timeLeft: 30 };
let catcherConfig = { score: 0, lives: 3, fallingTop: 0, interval: null, currentWord: null };
let wordleConfig = { targetWord: "", guesses: [], maxAttempts: 6 };
let unscrambleConfig = { targetItem: null, scrambledWord: "" };
let survivalConfig = { floor: 1, lives: 3, currentItem: null };

function stopAllGameTimers() {
    if (speedMatchConfig.timerInterval) {
        clearInterval(speedMatchConfig.timerInterval);
        speedMatchConfig.timerInterval = null;
    }
    if (catcherConfig.interval) {
        clearInterval(catcherConfig.interval);
        catcherConfig.interval = null;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadFileIndex();
    await loadFileData(activeFileId);

    window.addEventListener('keydown', (e) => {
        const modal = document.getElementById('custom-modal');
        if (modal && modal.classList.contains('active') && e.key === 'Enter') {
            e.preventDefault();
            closeCustomModal();
        }
    });

    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('custom-file-select');
        if (wrapper && !wrapper.contains(e.target)) {
            wrapper.classList.remove('open');
        }
    });
});

function toggleCustomSelect() {
    const wrapper = document.getElementById('custom-file-select');
    if (wrapper) wrapper.classList.toggle('open');
}

async function loadFileIndex() {
    try {
        const res = await fetch('data/file_index.json');
        fileCatalog = await res.json();
        
        const optionsContainer = document.getElementById('custom-file-options');
        optionsContainer.innerHTML = '';

        let activeTitle = "Tất cả các File";

        fileCatalog.forEach(item => {
            const div = document.createElement('div');
            div.className = `custom-option ${item.id === activeFileId ? 'selected' : ''}`;
            div.innerText = item.title;
            div.onclick = () => selectFileOption(item.id, item.title);
            optionsContainer.appendChild(div);

            if (item.id === activeFileId) activeTitle = item.title;
        });

        document.getElementById('selected-file-label').innerText = activeTitle;
    } catch (err) {
        console.error("Lỗi tải index:", err);
    }
}

async function selectFileOption(fileId, title) {
    document.getElementById('selected-file-label').innerText = title;
    document.querySelectorAll('.custom-option').forEach(el => el.classList.remove('selected'));
    
    const options = document.querySelectorAll('.custom-option');
    options.forEach(el => {
        if (el.innerText === title) el.classList.add('selected');
    });

    document.getElementById('custom-file-select').classList.remove('open');
    await changeActiveFile(fileId);
}

async function loadFileData(fileId) {
    activeFileId = fileId;
    localStorage.setItem('active_file_id', fileId);

    if (fileId === 'all') {
        vocabData = [];
        for (const item of fileCatalog) {
            if (item.id === 'all') continue;
            const customList = localStorage.getItem(`vocab_custom_${item.id}`);
            if (customList) {
                vocabData = vocabData.concat(JSON.parse(customList));
            } else {
                try {
                    const res = await fetch(item.file);
                    const data = await res.json();
                    vocabData = vocabData.concat(data);
                } catch (err) {
                    console.error(`Lỗi nạp file ${item.file}:`, err);
                }
            }
        }
    } else {
        const customList = localStorage.getItem(`vocab_custom_${fileId}`);
        if (customList) {
            vocabData = JSON.parse(customList);
        } else {
            const fileObj = fileCatalog.find(f => f.id === fileId) || fileCatalog[0];
            try {
                const res = await fetch(fileObj.file);
                vocabData = await res.json();
            } catch (err) {
                console.error("Lỗi nạp JSON:", err);
                vocabData = [];
            }
        }
    }

    vocabData = shuffleArray(vocabData);

    currentFcIndex = 0;
    updateDashboardStats();
    initFlashcard();
    initQuiz();
    initSpellingSystem();
    initImageLearningSystem();
    initDictation();
    initUnscrambleGame();
    initSurvivalGame();
    initWordleGame();
    updateMistakesBadge();
}

async function changeActiveFile(fileId) {
    stopAllGameTimers();
    await loadFileData(fileId);
}

function switchView(viewName) {
    stopAllGameTimers();

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const targetView = document.getElementById(`view-${viewName}`);
    if(targetView) targetView.classList.add('active');

    if(viewName === 'dashboard') updateDashboardStats();
    if(viewName === 'mistakes') renderMistakesView();
    if(viewName === 'speed-match') initSpeedMatch();
    if(viewName === 'word-catcher') resetCatcherGame();
    if(viewName === 'wordle') initWordleGame();
    if(viewName === 'unscramble') initUnscrambleGame();
    if(viewName === 'survival') initSurvivalGame();
    
    if(viewName === 'image-learning') {
        renderImageLearningWord();
        setTimeout(() => {
            const input = document.getElementById('img-input');
            if(input) input.focus();
        }, 100);
    }
    
    if(viewName === 'spelling') {
        setTimeout(() => {
            const input = document.getElementById('spelling-input');
            if(input) input.focus();
        }, 100);
    }
}

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('theme-icon').innerText = isDark ? '🌙' : '☀️';
}

function speakCurrentWord(text = null) {
    if (!vocabData.length) return;
    const wordToSpeak = text || vocabData[currentFcIndex].word;
    const utterance = new SpeechSynthesisUtterance(wordToSpeak);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
}

function speakSpellingWord() {
    if (currentSpellingItem) speakCurrentWord(currentSpellingItem.word);
}

function showCustomModal(title, message, icon = "🎉", onClose = null) {
    document.getElementById('modal-icon').innerText = icon;
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = message;
    
    spellingConfig.onModalCloseCallback = onClose;
    const modal = document.getElementById('custom-modal');
    modal.classList.add('active');
    
    setTimeout(() => {
        const btn = document.getElementById('modal-confirm-btn');
        if (btn) btn.focus();
    }, 50);
}

function closeCustomModal() {
    document.getElementById('custom-modal').classList.remove('active');
    if (spellingConfig.onModalCloseCallback) {
        const callback = spellingConfig.onModalCloseCallback;
        spellingConfig.onModalCloseCallback = null;
        callback();
    }
}

function shuffleArray(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// -------------------------------------------------------------
// HỆ THỐNG HỌC QUA HÌNH ẢNH (CHIA GIAI ĐOẠN & LOAD ẢNH SIÊU TỐC)
// -------------------------------------------------------------
function initImageLearningSystem() {
    if (!vocabData || !vocabData.length) return;

    let totalWords = [...vocabData];
    imageLearningConfig.stagesList = [];
    let sizeIdx = 0;

    while (totalWords.length > 0) {
        let chunkSize = imageLearningConfig.stageSizes[sizeIdx] || 20;
        let chunk = totalWords.splice(0, chunkSize);
        imageLearningConfig.stagesList.push(chunk);
        if (sizeIdx < imageLearningConfig.stageSizes.length - 1) sizeIdx++;
    }

    startImageStage(0);
}

function startImageStage(stageIdx) {
    imageLearningConfig.currentStageIndex = stageIdx;
    imageLearningConfig.currentQueue = [...imageLearningConfig.stagesList[stageIdx]];
    imageLearningConfig.wrongQueue = [];
    imageLearningConfig.currentIndex = 0;
    imageLearningConfig.isReviewingMistakes = false;
    imageLearningConfig.retryCurrentWord = false;

    renderImageLearningWord();
}

function renderImageLearningWord() {
    let queue = imageLearningConfig.currentQueue;
    if (!queue || !queue.length) return;

    imageLearningConfig.currentItem = queue[imageLearningConfig.currentIndex];
    const item = imageLearningConfig.currentItem;

    let stageNum = imageLearningConfig.currentStageIndex + 1;
    let totalStages = imageLearningConfig.stagesList.length;
    let statusText = imageLearningConfig.isReviewingMistakes ? " 🔄 (Sửa câu sai)" : "";
    
    document.getElementById('img-stage-info').innerText = `Giai đoạn ${stageNum} / ${totalStages}${statusText}`;
    document.getElementById('img-stage-progress').innerText = `Từ ${imageLearningConfig.currentIndex + 1} / ${queue.length}`;
    document.getElementById('img-wrong-count').innerText = `Sai: ${imageLearningConfig.wrongQueue.length}`;

    document.getElementById('img-topic').innerText = item.topic;
    document.getElementById('img-hint-meaning').innerText = `💡 Gợi ý nghĩa: "${item.meaning}"`;

    const inputEl = document.getElementById('img-input');
    const fbEl = document.getElementById('img-feedback');
    inputEl.value = '';
    fbEl.innerText = '';
    inputEl.focus();

    const imgEl = document.getElementById('img-learning-pic');
    const loadingEl = document.getElementById('img-loading');

    imgEl.style.display = 'none';
    loadingEl.style.display = 'block';
    loadingEl.innerText = '⏳ Đang tải hình ảnh minh họa chuẩn...';

    loadVocabularyImage(item, imgEl, loadingEl);
}

async function loadVocabularyImage(item, imgEl, loadingEl) {
    const requestId = ++imageLearningConfig.imageRequestId;
    const fallbackUrl = `https://dummyimage.com/600x400/1e293b/f8fafc&text=${encodeURIComponent(item.word)}`;

    const showImage = (url) => {
        if (requestId !== imageLearningConfig.imageRequestId) return;
        imgEl.onload = () => {
            if (requestId !== imageLearningConfig.imageRequestId) return;
            loadingEl.style.display = 'none';
            imgEl.style.display = 'block';
        };
        imgEl.onerror = () => {
            if (requestId !== imageLearningConfig.imageRequestId) return;
            imgEl.onload = null;
            imgEl.onerror = null;
            imgEl.src = fallbackUrl;
            loadingEl.style.display = 'none';
            imgEl.style.display = 'block';
        };
        imgEl.src = url;
    };

    if (item.image) {
        showImage(item.image);
        return;
    }

    try {
        const response = await fetch(
            `https://api.openverse.org/v1/images/?q=${encodeURIComponent(item.word)}&page_size=1`
        );
        if (!response.ok) throw new Error(`Openverse request failed: ${response.status}`);
        const result = await response.json();
        const imageUrl = result.results && result.results[0]
            ? (result.results[0].thumbnail || result.results[0].url)
            : null;

        if (imageUrl) {
            showImage(imageUrl);
            return;
        }
    } catch (error) {
        console.warn(`Không tìm được ảnh phù hợp cho "${item.word}":`, error);
    }

    showImage(fallbackUrl);
}

function checkImageAnswer() {
    const currentItem = imageLearningConfig.currentItem;
    if (!currentItem) return;

    const inputEl = document.getElementById('img-input');
    const inputVal = inputEl.value.trim().toLowerCase();
    const targetVal = currentItem.word.trim().toLowerCase();
    const fbEl = document.getElementById('img-feedback');

    if (inputVal === targetVal) {
        fbEl.style.color = "var(--success)";
        if (imageLearningConfig.retryCurrentWord) {
            fbEl.innerText = "✨ Đã sửa đúng! Chuyển tiếp...";
            imageLearningConfig.retryCurrentWord = false;
        } else {
            fbEl.innerText = `✨ Chính xác! Đáp án đúng: "${currentItem.word}"`;
        }
        
        speakCurrentWord(currentItem.word);

        setTimeout(() => {
            imageLearningConfig.currentIndex++;
            let queue = imageLearningConfig.currentQueue;

            if (imageLearningConfig.currentIndex >= queue.length) {
                if (imageLearningConfig.wrongQueue.length > 0) {
                    showCustomModal(
                        "Cần ôn lại câu sai", 
                        `Bạn đã hoàn thành lượt 1 nhưng có ${imageLearningConfig.wrongQueue.length} từ bị gõ sai. Hãy nhìn ảnh và gõ lại chính xác!`, 
                        "⚠️",
                        () => {
                            imageLearningConfig.currentQueue = shuffleArray([...imageLearningConfig.wrongQueue]);
                            imageLearningConfig.wrongQueue = [];
                            imageLearningConfig.currentIndex = 0;
                            imageLearningConfig.isReviewingMistakes = true;
                            renderImageLearningWord();
                        }
                    );
                } else {
                    if (imageLearningConfig.currentStageIndex < imageLearningConfig.stagesList.length - 1) {
                        showCustomModal(
                            "Xuất Sắc!", 
                            `Bạn đã vượt qua Giai đoạn ${imageLearningConfig.currentStageIndex + 1}! Chuẩn bị bước sang Giai đoạn ${imageLearningConfig.currentStageIndex + 2}.`, 
                            "🎉",
                            () => { startImageStage(imageLearningConfig.currentStageIndex + 1); }
                        );
                    } else {
                        showCustomModal("Chúc Mừng!", "Bạn đã hoàn thành tất cả các giai đoạn Học Qua Hình Ảnh!", "🏆", () => { initImageLearningSystem(); });
                    }
                }
            } else {
                renderImageLearningWord();
            }
        }, 1000);

    } else {
        fbEl.style.color = "var(--danger)";
        fbEl.innerText = `❌ Sai rồi! Đáp án chính xác: "${currentItem.word}". Hãy gõ lại đúng để đi tiếp!`;

        imageLearningConfig.retryCurrentWord = true;

        if (!imageLearningConfig.wrongQueue.some(item => item.id === currentItem.id)) {
            imageLearningConfig.wrongQueue.push(currentItem);
            document.getElementById('img-wrong-count').innerText = `Sai: ${imageLearningConfig.wrongQueue.length}`;
        }

        if (!userProgress.wrongList.includes(currentItem.id)) {
            userProgress.wrongList.push(currentItem.id);
            saveUserData();
        }

        setTimeout(() => {
            inputEl.value = '';
            inputEl.focus();
        }, 1500);
    }
}

// -------------------------------------------------------------
// CÁC TÍNH NĂNG KHÁC (FLASHCARD, SPELLING, QUIZ, GAMES, ETC.)
// -------------------------------------------------------------

// FLASHCARD
function initFlashcard() {
    if(!vocabData.length) return;
    const item = vocabData[currentFcIndex];
    document.getElementById('fc-topic').innerText = item.topic;
    document.getElementById('fc-front').innerText = item.word;
    document.getElementById('fc-back').innerText = item.meaning;
    document.getElementById('fc-hint').innerText = item.hint ? `Gợi ý: ${item.hint}` : '';
    document.getElementById('flashcard-progress').innerText = `Thẻ ${currentFcIndex + 1} / ${vocabData.length}`;
    document.getElementById('active-flashcard').classList.remove('flipped');
}

function flipCard() { document.getElementById('active-flashcard').classList.toggle('flipped'); }
function nextCard() { if (!vocabData.length) return; currentFcIndex = (currentFcIndex + 1) % vocabData.length; initFlashcard(); }
function prevCard() { if (!vocabData.length) return; currentFcIndex = (currentFcIndex - 1 + vocabData.length) % vocabData.length; initFlashcard(); }

function rateFlashcard(rating) {
    if(!vocabData.length) return;
    const currentId = vocabData[currentFcIndex].id;
    if(!userProgress.cardState[currentId]) userProgress.cardState[currentId] = { level: 0, wrongStreak: 0 };
    
    if(rating <= 2) {
        userProgress.cardState[currentId].wrongStreak++;
        if(!userProgress.wrongList.includes(currentId)) userProgress.wrongList.push(currentId);
    } else {
        userProgress.cardState[currentId].level++;
        userProgress.cardState[currentId].wrongStreak = 0;
    }
    saveUserData();
    nextCard();
}

// QUIZ
function initQuiz(customList = null) {
    const pool = customList || vocabData;
    if(!pool.length) return;
    
    const randomIndex = Math.floor(Math.random() * pool.length);
    currentQuizItem = pool[randomIndex];
    
    document.getElementById('quiz-topic-badge').innerText = currentQuizItem.topic;
    document.getElementById('quiz-question').innerText = `Nghĩa của từ "${currentQuizItem.word}" là gì?`;
    
    let options = [currentQuizItem.meaning];
    while(options.length < Math.min(4, vocabData.length)) {
        let randMeaning = vocabData[Math.floor(Math.random() * vocabData.length)].meaning;
        if(!options.includes(randMeaning)) options.push(randMeaning);
    }
    options.sort(() => Math.random() - 0.5);

    const optsContainer = document.getElementById('quiz-options');
    optsContainer.innerHTML = '';
    document.getElementById('quiz-explanation').style.display = 'none';
    document.getElementById('quiz-next-btn').style.display = 'none';

    options.forEach((opt, idx) => {
        const letter = String.fromCharCode(65 + idx);
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `<span class="opt-badge">${letter}</span> ${opt}`;
        btn.onclick = () => checkQuizAnswer(btn, opt);
        optsContainer.appendChild(btn);
    });
}

function checkQuizAnswer(selectedBtn, selectedOption) {
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.disabled = true);
    userProgress.stats.totalAnswered++;

    if(selectedOption === currentQuizItem.meaning) {
        selectedBtn.classList.add('correct');
        userProgress.stats.correctCount++;
    } else {
        selectedBtn.classList.add('wrong');
        allBtns.forEach(b => {
            if(b.innerText.includes(currentQuizItem.meaning)) b.classList.add('correct');
        });
        if(!userProgress.wrongList.includes(currentQuizItem.id)) userProgress.wrongList.push(currentQuizItem.id);
    }

    document.getElementById('quiz-exp-text').innerText = `"${currentQuizItem.word}" nghĩa là "${currentQuizItem.meaning}".`;
    document.getElementById('quiz-explanation').style.display = 'block';
    document.getElementById('quiz-next-btn').style.display = 'block';
    saveUserData();
}

function nextQuizQuestion() { initQuiz(); }

// SPELLING SYSTEM
function initSpellingSystem() {
    if (!vocabData || !vocabData.length) return;

    let totalWords = [...vocabData];
    spellingConfig.stagesList = [];
    let sizeIdx = 0;

    while (totalWords.length > 0) {
        let chunkSize = spellingConfig.stageSizes[sizeIdx] || 20;
        let chunk = totalWords.splice(0, chunkSize);
        spellingConfig.stagesList.push(chunk);
        if (sizeIdx < spellingConfig.stageSizes.length - 1) sizeIdx++;
    }

    spellingConfig.currentStageIndex = 0;
    startStage(0);
}

function startStage(stageIdx) {
    spellingConfig.currentStageIndex = stageIdx;
    spellingConfig.currentQueue = [...spellingConfig.stagesList[stageIdx]];
    spellingConfig.wrongQueue = [];
    spellingConfig.currentIndex = 0;
    spellingConfig.isReviewingMistakes = false;
    spellingConfig.retryCurrentWord = false;

    renderSpellingWord();
}

function renderSpellingWord() {
    let queue = spellingConfig.currentQueue;
    if (!queue.length) return;

    currentSpellingItem = queue[spellingConfig.currentIndex];

    let stageNum = spellingConfig.currentStageIndex + 1;
    let totalStages = spellingConfig.stagesList.length;
    let statusText = spellingConfig.isReviewingMistakes ? " 🔄 (Sửa câu sai)" : "";
    
    document.getElementById('spelling-stage-info').innerText = `Giai đoạn ${stageNum} / ${totalStages}${statusText}`;
    document.getElementById('spelling-stage-progress').innerText = `Từ ${spellingConfig.currentIndex + 1} / ${queue.length}`;
    document.getElementById('spelling-wrong-count').innerText = `Sai: ${spellingConfig.wrongQueue.length}`;

    document.getElementById('spelling-topic').innerText = currentSpellingItem.topic;
    document.getElementById('spelling-prompt').innerText = currentSpellingItem.meaning;

    const inputEl = document.getElementById('spelling-input');
    if (inputEl) {
        inputEl.value = '';
        inputEl.focus();
    }
    document.getElementById('spelling-feedback').innerText = '';
}

function checkSpelling() {
    if (!currentSpellingItem) return;

    const inputEl = document.getElementById('spelling-input');
    const input = inputEl.value.trim().toLowerCase();
    const target = currentSpellingItem.word.toLowerCase();
    const fb = document.getElementById('spelling-feedback');

    if (input === target) {
        fb.style.color = "var(--success)";
        if (spellingConfig.retryCurrentWord) {
            fb.innerText = "✨ Đã sửa đúng! Chuyển tiếp...";
            spellingConfig.retryCurrentWord = false;
        } else {
            fb.innerText = "✨ Hoàn toàn chính xác!";
        }

        setTimeout(() => {
            spellingConfig.currentIndex++;
            let queue = spellingConfig.currentQueue;

            if (spellingConfig.currentIndex >= queue.length) {
                if (spellingConfig.wrongQueue.length > 0) {
                    showCustomModal(
                        "Cần ôn lại câu sai", 
                        `Bạn đã hoàn thành lượt 1 nhưng có ${spellingConfig.wrongQueue.length} từ bị gõ sai. Hãy gõ lại chính xác các từ này!`, 
                        "⚠️",
                        () => {
                            spellingConfig.currentQueue = shuffleArray([...spellingConfig.wrongQueue]);
                            spellingConfig.wrongQueue = [];
                            spellingConfig.currentIndex = 0;
                            spellingConfig.isReviewingMistakes = true;
                            renderSpellingWord();
                        }
                    );
                } else {
                    if (spellingConfig.currentStageIndex < spellingConfig.stagesList.length - 1) {
                        showCustomModal(
                            "Xuất Sắc!", 
                            `Bạn đã vượt qua Giai đoạn ${spellingConfig.currentStageIndex + 1}! Chuẩn bị bước sang Giai đoạn ${spellingConfig.currentStageIndex + 2}.`, 
                            "🎉",
                            () => { startStage(spellingConfig.currentStageIndex + 1); }
                        );
                    } else {
                        showCustomModal("Chúc Mừng!", "Bạn đã hoàn thành tất cả các giai đoạn!", "🏆", () => { initSpellingSystem(); });
                    }
                }
            } else {
                renderSpellingWord();
            }
        }, 1000);

    } else {
        fb.style.color = "var(--danger)";
        fb.innerText = `❌ Sai rồi! Đáp án: "${currentSpellingItem.word}". Gõ lại đúng để đi tiếp!`;

        spellingConfig.retryCurrentWord = true;

        if (!spellingConfig.wrongQueue.some(item => item.id === currentSpellingItem.id)) {
            spellingConfig.wrongQueue.push(currentSpellingItem);
            document.getElementById('spelling-wrong-count').innerText = `Sai: ${spellingConfig.wrongQueue.length}`;
        }

        if (!userProgress.wrongList.includes(currentSpellingItem.id)) {
            userProgress.wrongList.push(currentSpellingItem.id);
            saveUserData();
        }

        setTimeout(() => {
            inputEl.value = '';
            inputEl.focus();
        }, 1500);
    }
}

// GAME 1: NỐI TỪ NHANH
function initSpeedMatch() {
    if (!vocabData.length) return;

    stopAllGameTimers();
    speedMatchConfig.timeLeft = 30;
    speedMatchConfig.selectedCards = [];
    document.getElementById('sm-timer').innerText = "30";

    const sample = shuffleArray([...vocabData]).slice(0, 6);
    let cards = [];
    sample.forEach(item => {
        cards.push({ id: item.id, text: item.word, type: 'word' });
        cards.push({ id: item.id, text: item.meaning, type: 'meaning' });
    });

    cards = shuffleArray(cards);
    const grid = document.getElementById('sm-grid');
    grid.innerHTML = '';

    cards.forEach(c => {
        const div = document.createElement('div');
        div.className = 'match-card';
        div.innerText = c.text;
        div.onclick = () => handleSpeedMatchClick(div, c);
        grid.appendChild(div);
    });

    speedMatchConfig.timerInterval = setInterval(() => {
        speedMatchConfig.timeLeft--;
        document.getElementById('sm-timer').innerText = speedMatchConfig.timeLeft;
        if (speedMatchConfig.timeLeft <= 0) {
            stopAllGameTimers();
            showCustomModal("Hết Giờ!", "Rất tiếc, thời gian đã hết! Hãy bấm Chơi Ván Mới để thử lại.", "⏰");
        }
    }, 1000);
}

function handleSpeedMatchClick(cardEl, cardData) {
    if (cardEl.classList.contains('matched') || cardEl.classList.contains('selected')) return;

    cardEl.classList.add('selected');
    speedMatchConfig.selectedCards.push({ element: cardEl, data: cardData });

    if (speedMatchConfig.selectedCards.length === 2) {
        const [c1, c2] = speedMatchConfig.selectedCards;

        if (c1.data.id === c2.data.id && c1.data.type !== c2.data.type) {
            c1.element.classList.add('matched');
            c2.element.classList.add('matched');
            speedMatchConfig.selectedCards = [];

            const remaining = document.querySelectorAll('#sm-grid .match-card:not(.matched)');
            if (remaining.length === 0) {
                stopAllGameTimers();
                showCustomModal("Chiến Thắng!", `Tuyệt vời! Bạn hoàn thành trò chơi khi còn ${speedMatchConfig.timeLeft} giây!`, "⚡");
            }
        } else {
            setTimeout(() => {
                c1.element.classList.remove('selected');
                c2.element.classList.remove('selected');
                speedMatchConfig.selectedCards = [];
            }, 500);
        }
    }
}

// GAME 2: HỨNG TỪ ARCADE
function resetCatcherGame() {
    stopAllGameTimers();
    catcherConfig.score = 0;
    catcherConfig.lives = 3;
    document.getElementById('wc-score').innerText = "0";
    document.getElementById('wc-lives').innerText = "❤️❤️❤️";
    document.getElementById('wc-falling-word').style.top = "0px";
    document.getElementById('wc-start-btn').style.display = "block";
    document.getElementById('wc-options').innerHTML = "";
}

function startWordCatcherGame() {
    document.getElementById('wc-start-btn').style.display = "none";
    spawnCatcherRound();
}

function spawnCatcherRound() {
    if (!vocabData.length) return;
    catcherConfig.currentWord = vocabData[Math.floor(Math.random() * vocabData.length)];
    
    const fallingEl = document.getElementById('wc-falling-word');
    fallingEl.innerText = catcherConfig.currentWord.word;
    catcherConfig.fallingTop = 0;
    fallingEl.style.top = "0px";

    let options = [catcherConfig.currentWord.meaning];
    while (options.length < Math.min(4, vocabData.length)) {
        let randMeaning = vocabData[Math.floor(Math.random() * vocabData.length)].meaning;
        if (!options.includes(randMeaning)) options.push(randMeaning);
    }
    options.sort(() => Math.random() - 0.5);

    const optsContainer = document.getElementById('wc-options');
    optsContainer.innerHTML = "";
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline';
        btn.innerText = opt;
        btn.onclick = () => catchAnswer(opt);
        optsContainer.appendChild(btn);
    });

    stopAllGameTimers();
    catcherConfig.interval = setInterval(() => {
        catcherConfig.fallingTop += 1;
        fallingEl.style.top = catcherConfig.fallingTop + "px";

        if (catcherConfig.fallingTop >= 180) {
            stopAllGameTimers();
            handleCatcherMiss();
        }
    }, 60);
}

function catchAnswer(selectedMeaning) {
    stopAllGameTimers();
    if (selectedMeaning === catcherConfig.currentWord.meaning) {
        catcherConfig.score += 10;
        document.getElementById('wc-score').innerText = catcherConfig.score;
        spawnCatcherRound();
    } else {
        handleCatcherMiss();
    }
}

function handleCatcherMiss() {
    catcherConfig.lives--;
    let hearts = "❤️".repeat(Math.max(0, catcherConfig.lives));
    document.getElementById('wc-lives').innerText = hearts || "💀";

    if (catcherConfig.lives <= 0) {
        showCustomModal("Game Over", `Bạn đã bị chạm đáy! Tổng điểm Arcade đạt được: ${catcherConfig.score}`, "🎮", resetCatcherGame);
    } else {
        spawnCatcherRound();
    }
}

// GAME 3: WORDLE ĐOÁN TỪ
function initWordleGame() {
    if (!vocabData.length) return;
    
    const validWords = vocabData.filter(v => v.word.indexOf(' ') === -1 && v.word.length >= 3 && v.word.length <= 8);
    const item = validWords.length ? validWords[Math.floor(Math.random() * validWords.length)] : vocabData[0];
    
    wordleConfig.targetWord = item.word.toLowerCase();
    wordleConfig.guesses = [];
    
    document.getElementById('wordle-meaning').innerText = `Gợi ý nghĩa: "${item.meaning}" (${wordleConfig.targetWord.length} ký tự)`;
    document.getElementById('wordle-input').value = "";

    renderWordleBoard();
}

function renderWordleBoard() {
    const board = document.getElementById('wordle-board');
    board.innerHTML = "";
    const len = wordleConfig.targetWord.length;

    for (let r = 0; r < wordleConfig.maxAttempts; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'wordle-row';
        const guess = wordleConfig.guesses[r] || "";

        for (let c = 0; c < len; c++) {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'wordle-cell';
            const char = guess[c] || "";
            cellDiv.innerText = char;

            if (guess) {
                if (char === wordleConfig.targetWord[c]) cellDiv.classList.add('correct');
                else if (wordleConfig.targetWord.includes(char)) cellDiv.classList.add('present');
                else cellDiv.classList.add('absent');
            }

            rowDiv.appendChild(cellDiv);
        }
        board.appendChild(rowDiv);
    }
}

function submitWordleGuess() {
    const inputEl = document.getElementById('wordle-input');
    const guess = inputEl.value.trim().toLowerCase();
    const len = wordleConfig.targetWord.length;

    if (guess.length !== len) {
        alert(`Vui lòng nhập từ có đúng ${len} ký tự!`);
        return;
    }

    wordleConfig.guesses.push(guess);
    inputEl.value = "";
    renderWordleBoard();

    if (guess === wordleConfig.targetWord) {
        showCustomModal("Thắng Rồi!", `Chúc mừng! Bạn đã đoán chính xác từ "${wordleConfig.targetWord.toUpperCase()}"!`, "🟩", initWordleGame);
    } else if (wordleConfig.guesses.length >= wordleConfig.maxAttempts) {
        showCustomModal("Hết Lượt Đoán", `Đáp án đúng là: "${wordleConfig.targetWord.toUpperCase()}". Thử câu tiếp theo nào!`, "🟧", initWordleGame);
    }
}

// GAME 4: SẮP XẾP CHỮ CÁI
function initUnscrambleGame() {
    if (!vocabData.length) return;
    unscrambleConfig.targetItem = vocabData[Math.floor(Math.random() * vocabData.length)];
    
    const original = unscrambleConfig.targetItem.word.toUpperCase();
    let letters = original.split('');
    letters = shuffleArray(letters);
    
    document.getElementById('unscramble-meaning').innerText = `Nghĩa: "${unscrambleConfig.targetItem.meaning}"`;
    document.getElementById('scrambled-letters').innerText = letters.join(' - ');
    document.getElementById('unscramble-input').value = "";
    document.getElementById('unscramble-feedback').innerText = "";
}

function checkUnscramble() {
    if (!unscrambleConfig.targetItem) return;
    const input = document.getElementById('unscramble-input').value.trim().toLowerCase();
    const target = unscrambleConfig.targetItem.word.toLowerCase();
    const fb = document.getElementById('unscramble-feedback');

    if (input === target) {
        fb.style.color = "var(--success)";
        fb.innerText = "✨ Sắp xếp hoàn toàn chính xác!";
        setTimeout(initUnscrambleGame, 1200);
    } else {
        fb.style.color = "var(--danger)";
        fb.innerText = `❌ Chưa chính xác! Đáp án đúng là "${unscrambleConfig.targetItem.word}"`;
    }
}

// GAME 5: ĐẤU TRƯỜNG SINH TỒN
function initSurvivalGame() {
    survivalConfig.floor = 1;
    survivalConfig.lives = 3;
    loadSurvivalQuestion();
}

function loadSurvivalQuestion() {
    if (!vocabData.length) return;
    survivalConfig.currentItem = vocabData[Math.floor(Math.random() * vocabData.length)];

    document.getElementById('surv-floor').innerText = survivalConfig.floor;
    document.getElementById('surv-lives').innerText = "❤️".repeat(survivalConfig.lives) || "💀";
    document.getElementById('surv-topic').innerText = survivalConfig.currentItem.topic;
    document.getElementById('surv-question').innerText = `Nghĩa của từ "${survivalConfig.currentItem.word}" là gì?`;

    let options = [survivalConfig.currentItem.meaning];
    while (options.length < Math.min(4, vocabData.length)) {
        let randMeaning = vocabData[Math.floor(Math.random() * vocabData.length)].meaning;
        if (!options.includes(randMeaning)) options.push(randMeaning);
    }
    options.sort(() => Math.random() - 0.5);

    const container = document.getElementById('surv-options');
    container.innerHTML = "";

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => answerSurvivalQuestion(opt);
        container.appendChild(btn);
    });
}

function answerSurvivalQuestion(selectedMeaning) {
    if (selectedMeaning === survivalConfig.currentItem.meaning) {
        survivalConfig.floor++;
        loadSurvivalQuestion();
    } else {
        survivalConfig.lives--;
        if (survivalConfig.lives <= 0) {
            showCustomModal("Thua Trận!", `Bạn đã ngã xuống tại Tầng ${survivalConfig.floor}! Hãy cố gắng hơn ở lượt sau.`, "🏰", initSurvivalGame);
        } else {
            loadSurvivalQuestion();
        }
    }
}

// DICTATION
function initDictation() {
    if(!vocabData.length) return;
    currentDictationItem = vocabData[Math.floor(Math.random() * vocabData.length)];
    document.getElementById('dict-topic').innerText = currentDictationItem.topic;
    document.getElementById('dict-input').value = '';
    document.getElementById('dict-feedback').innerText = '';
}

function playDictationAudio() {
    if (currentDictationItem) speakCurrentWord(currentDictationItem.word);
}

function checkDictation() {
    if (!currentDictationItem) return;
    const inputVal = document.getElementById('dict-input').value.trim().toLowerCase();
    const target = currentDictationItem.word.toLowerCase();
    const fb = document.getElementById('dict-feedback');

    if (inputVal === target) {
        fb.style.color = "var(--success)";
        fb.innerText = `✨ Chính xác! Đáp án: "${currentDictationItem.word}" (${currentDictationItem.meaning})`;
        setTimeout(initDictation, 1500);
    } else {
        fb.style.color = "var(--danger)";
        fb.innerText = `❌ Chưa chuẩn! Đáp án là: "${currentDictationItem.word}". Nghe và thử lại nhé!`;
        playDictationAudio();
    }
}

// ADD VOCAB
function addNewVocab(e) {
    e.preventDefault();
    const topic = document.getElementById('new-topic').value.trim();
    const word = document.getElementById('new-word').value.trim();
    const meaning = document.getElementById('new-meaning').value.trim();
    const hint = document.getElementById('new-hint').value.trim();
    const image = document.getElementById('new-image').value.trim();

    let imageUrl = '';
    if (image) {
        try {
            const parsedImageUrl = new URL(image);
            if (!['http:', 'https:'].includes(parsedImageUrl.protocol)) {
                throw new Error('Unsupported image URL protocol');
            }
            imageUrl = parsedImageUrl.href;
        } catch (error) {
            alert('Link hình ảnh không hợp lệ. Vui lòng dùng URL bắt đầu bằng http:// hoặc https://.');
            return;
        }
    }

    const newVocab = { id: Date.now(), topic, word, meaning, hint, image: imageUrl };
    vocabData.push(newVocab);
    
    localStorage.setItem(`vocab_custom_${activeFileId}`, JSON.stringify(vocabData));
    
    alert(`Đã thêm từ vào File hiện tại thành công!`);
    document.getElementById('add-vocab-form').reset();
    updateDashboardStats();
    initFlashcard();
}

// MISTAKES VIEW
function renderMistakesView() {
    const container = document.getElementById('mistakes-list');
    container.innerHTML = '';

    const wrongItems = vocabData.filter(v => userProgress.wrongList.includes(v.id));

    if (wrongItems.length === 0) {
        container.innerHTML = '<p style="color: var(--success); text-align:center; padding: 20px;">🎉 File này bạn không có câu nào bị sai!</p>';
        return;
    }

    const actionHeader = document.createElement('div');
    actionHeader.style.cssText = "display: flex; gap: 12px; margin-bottom: 24px;";
    actionHeader.innerHTML = `<button class="btn btn-primary" onclick="startPracticeMistakesQuiz()">🎯 Tái Luyện Trắc Nghiệm (${wrongItems.length})</button>`;
    container.appendChild(actionHeader);

    wrongItems.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border);";
        row.innerHTML = `
            <div>
                <strong style="color: var(--primary);">${item.word}</strong>
                <div style="font-size: 0.85rem; color: var(--muted);">${item.meaning}</div>
            </div>
            <button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" onclick="removeFromMistakes(${item.id})">Đã thuộc ✓</button>
        `;
        container.appendChild(row);
    });
}

function startPracticeMistakesQuiz() {
    const wrongItems = vocabData.filter(v => userProgress.wrongList.includes(v.id));
    if(!wrongItems.length) return;
    switchView('quiz');
    initQuiz(wrongItems);
}

function removeFromMistakes(id) {
    userProgress.wrongList = userProgress.wrongList.filter(item => item !== id);
    saveUserData();
    renderMistakesView();
}

// DASHBOARD & STATS
function updateDashboardStats() {
    const total = vocabData.length;
    const review = userProgress.wrongList.filter(id => vocabData.some(v => v.id === id)).length;
    const accuracy = userProgress.stats.totalAnswered > 0 
        ? Math.round((userProgress.stats.correctCount / userProgress.stats.totalAnswered) * 100) : 0;

    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-review').innerText = review;
    document.getElementById('stat-accuracy').innerText = `${accuracy}%`;

    const topicMap = {};
    vocabData.forEach(v => { topicMap[v.topic] = (topicMap[v.topic] || 0) + 1; });

    const topicContainer = document.getElementById('topic-progress-list');
    topicContainer.innerHTML = '';
    Object.keys(topicMap).forEach(topic => {
        const item = document.createElement('div');
        item.style.margin = "12px 0";
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:0.9rem; font-weight:600; margin-bottom:4px;">
                <span>${topic}</span><span>${topicMap[topic]} từ</span>
            </div>
            <div style="height: 6px; background: var(--surface-2); border-radius: 4px; overflow: hidden;">
                <div style="width: 100%; height: 100%; background: var(--primary);"></div>
            </div>
        `;
        topicContainer.appendChild(item);
    });
}

function updateMistakesBadge() {
    document.getElementById('wrong-count-badge').innerText = userProgress.wrongList.length;
}

function saveUserData() {
    localStorage.setItem('vocab_app_progress', JSON.stringify(userProgress));
    updateMistakesBadge();
}

function resetProgress() {
    if(confirm("Xóa tất cả tiến độ học tập?")) {
        localStorage.clear();
        location.reload();
    }
}
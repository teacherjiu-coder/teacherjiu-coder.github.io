const ACCESS_CODE = "JW1116";
const EXAM_DURATION_SEC = 40 * 60;
const OPTION_LABELS = ["①", "②", "③", "④"];
const IMG_STYLE = "max-width:100%; height:auto; margin:10px 0; border-radius:8px; display:block;";

const LS = {
  pro: "isPro",
  fontSize: "comhwal_font_size",
  progress: (round) => `comhwal_progress_sangsi_${round}_normal`,
  wrongNote: "comhwal_wrong_note",
  selectedRound: "comhwal_selected_round",
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/** 이용 가능 회차 → 문제 JSON 파일 */
const AVAILABLE_ROUNDS = {
  sangsi: {
    1: "questions.json",
    2: "questions_sangsi_2.json",
    3: "questions_sangsi_3.json",
    4: "questions_sangsi_4.json",
    5: "questions_sangsi_5.json",
  },
};

const questionPools = { sangsi: {}, jeonggi: {} };
let audioCtx = null;
let timerInterval = null;

const session = {
  mode: null,
  roundType: null,
  roundNum: null,
  randomPoolType: null,
  questions: [],
  answers: {},
  currentIndex: 0,
  isWrongNote: false,
  examStartedAt: null,
  examElapsedSec: null,
  selectedRound: null,
};

const screens = {
  menu: $("#menu-screen"),
  wrongnoteEmpty: $("#wrongnote-empty-screen"),
  quiz: $("#quiz-screen"),
  result: $("#result-screen"),
};

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.remove("active"));
  screens[name].classList.add("active");
  if (name !== "quiz") document.body.classList.remove("is-exam-quiz");
}

function isProUnlocked() {
  if (localStorage.getItem(LS.pro) === "true") return true;
  if (localStorage.getItem("comhwal_pro_unlocked") === "1") {
    unlockPro();
    localStorage.removeItem("comhwal_pro_unlocked");
    return true;
  }
  if (localStorage.getItem("comhwal_coupon_ok") === "1") {
    unlockPro();
    localStorage.removeItem("comhwal_coupon_ok");
    return true;
  }
  return false;
}

function unlockPro() {
  localStorage.setItem(LS.pro, "true");
}

function isRoundUnlocked(type, num) {
  if (type !== "sangsi") return false;
  if (num === 1) return true;
  return isProUnlocked();
}

function showLockToast() {
  const toast = $("#lock-toast");
  toast.classList.remove("hidden");
  clearTimeout(showLockToast._timer);
  showLockToast._timer = setTimeout(() => toast.classList.add("hidden"), 2500);
}

function updateAccessUI() {
  const btn = $("#btn-access-code");
  if (isProUnlocked()) {
    btn.textContent = "🏅 Pro";
    btn.classList.add("pro-badge");
    btn.setAttribute("aria-label", "Pro 이용 중");
  } else {
    btn.textContent = "🔑 코드 입력";
    btn.classList.remove("pro-badge");
    btn.setAttribute("aria-label", "코드 입력");
  }
  buildRoundButtons();
}

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(frequency, duration, type = "sine", volume = 0.15) {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playCorrectSound() {
  playTone(523.25, 0.12);
  setTimeout(() => playTone(659.25, 0.12), 100);
  setTimeout(() => playTone(783.99, 0.2), 200);
}

function playWrongSound() {
  playTone(220, 0.25, "square", 0.08);
  setTimeout(() => playTone(185, 0.35, "square", 0.08), 180);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr, count) {
  return shuffle(arr).slice(0, Math.min(count, arr.length));
}

function applyFontSize(size) {
  document.documentElement.dataset.fontSize = size;
  localStorage.setItem(LS.fontSize, size);
  $$(".font-size-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.size === size);
  });
}

function loadFontSize() {
  applyFontSize(localStorage.getItem(LS.fontSize) || "normal");
}

function getSubject(id) {
  return id <= 20 ? 1 : 2;
}

function roundLabel(type, num) {
  return `${type === "sangsi" ? "상시" : "정기"} ${num}회`;
}

function isRoundAvailable(type, num) {
  return !!AVAILABLE_ROUNDS[type]?.[num];
}

function getRoundQuestions(type, num) {
  return questionPools[type]?.[num] || [];
}

function questionUid(q, roundKey) {
  return `${roundKey}_${q.id}`;
}

function loadWrongNote() {
  try {
    return JSON.parse(localStorage.getItem(LS.wrongNote)) || [];
  } catch {
    return [];
  }
}

function saveWrongNote(list) {
  localStorage.setItem(LS.wrongNote, JSON.stringify(list));
}

function addToWrongNote(q, roundKey) {
  const uid = questionUid(q, roundKey);
  const list = loadWrongNote();
  if (list.some((item) => item.uid === uid)) return;
  list.push({
    ...q,
    uid,
    roundKey,
    roundNum: q.roundNum,
    roundType: q.roundType || "sangsi",
  });
  saveWrongNote(list);
}

function removeFromWrongNote(uid) {
  saveWrongNote(loadWrongNote().filter((item) => item.uid !== uid));
}

function getProgressKey(roundNum) {
  return LS.progress(roundNum);
}

function saveProgress() {
  if (session.mode !== "normal" || session.isWrongNote) return;
  localStorage.setItem(
    getProgressKey(session.roundNum),
    JSON.stringify({
      roundNum: session.roundNum,
      currentIndex: session.currentIndex,
      answers: session.answers,
    })
  );
}

function loadProgressFor(roundNum) {
  try {
    return JSON.parse(localStorage.getItem(getProgressKey(roundNum)));
  } catch {
    return null;
  }
}

function clearProgress() {
  localStorage.removeItem(getProgressKey(session.roundNum));
}

/** 지금까지 푼 문제만 채점 (100점 만점) */
function calcScores(questions, answers) {
  let s1Correct = 0;
  let s2Correct = 0;

  questions.forEach((q) => {
    const a = answers[q.id];
    if (!a?.answered) return;
    if (a.correct) {
      if (getSubject(q.id) === 1) s1Correct++;
      else s2Correct++;
    }
  });

  const s1Score = s1Correct * 2.5;
  const s2Score = s2Correct * 2.5;
  const totalScore = s1Score + s2Score;
  const s1Pass = s1Score >= 40;
  const s2Pass = s2Score >= 40;
  const avgPass = totalScore >= 60;
  const passed = s1Pass && s2Pass && avgPass;

  return { s1Score, s2Score, totalScore, passed };
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(sec) {
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}

function getRoundKey(type, num) {
  return `${type}_${num}`;
}

function buildQuestionPools() {
  questionPools.sangsi = {};
  questionPools.jeonggi = {};
}

function getPoolByType(poolType) {
  const pool = questionPools[poolType];
  const computer = [];
  const spreadsheet = [];

  Object.values(pool).forEach((roundQs) => {
    roundQs.forEach((q) => {
      if (q.id <= 20) computer.push(q);
      else spreadsheet.push(q);
    });
  });

  return { computer, spreadsheet };
}

function buildRandomQuestions(poolType) {
  const { computer, spreadsheet } = getPoolByType(poolType);
  if (computer.length === 0 && spreadsheet.length === 0) return null;

  const picked1 = pickRandom(computer, 20);
  const picked2 = pickRandom(spreadsheet, 20);
  return shuffle([...picked1, ...picked2]);
}

async function loadQuestions() {
  buildQuestionPools();

  for (const [type, rounds] of Object.entries(AVAILABLE_ROUNDS)) {
    for (const [numStr, file] of Object.entries(rounds)) {
      const num = Number(numStr);
      const res = await fetch(file);
      if (!res.ok) throw new Error(`${file}을 불러올 수 없습니다.`);
      const qs = await res.json();
      questionPools[type][num] = qs.map((q) => ({
        ...q,
        roundKey: getRoundKey(type, num),
        roundNum: num,
        roundType: type,
      }));
    }
  }
}

function buildRoundButtons() {
  $("#sangsi-grid").innerHTML = "";
  $("#jeonggi-grid").innerHTML = "";
  for (let i = 1; i <= 5; i++) $("#sangsi-grid").appendChild(createRoundBtn("sangsi", i));
  for (let i = 1; i <= 10; i++) $("#jeonggi-grid").appendChild(createRoundBtn("jeonggi", i));
}

function createRoundBtn(type, num) {
  const hasData = isRoundAvailable(type, num);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.type = type;
  btn.dataset.num = String(num);

  if (!hasData) {
    btn.className = "round-btn disabled";
    btn.disabled = true;
    btn.innerHTML = `<span class="round-num">${num}회</span><span class="round-soon">준비 중</span>`;
    return btn;
  }

  if (type === "sangsi") {
    const unlocked = isRoundUnlocked(type, num);
    btn.className = `round-btn${unlocked ? "" : " locked"}`;
    btn.innerHTML = unlocked
      ? `<span class="round-num">${num}회</span>`
      : `<span class="round-lock" aria-hidden="true">🔒</span><span class="round-num">${num}회</span>`;
    btn.addEventListener("click", () => {
      if (unlocked) selectRound(type, num);
      else showLockToast();
    });
    return btn;
  }

  btn.className = "round-btn disabled";
  btn.disabled = true;
  btn.innerHTML = `<span class="round-num">${num}회</span><span class="round-soon">준비 중</span>`;
  return btn;
}

function selectRound(type, num) {
  if (type === "sangsi" && !isRoundUnlocked(type, num)) {
    showLockToast();
    return;
  }
  session.selectedRound = { type, num };
  localStorage.setItem(LS.selectedRound, JSON.stringify({ type, num }));
  $$(".round-btn").forEach((b) => b.classList.remove("selected"));
  const sel = document.querySelector(`.round-btn[data-type="${type}"][data-num="${num}"]`);
  if (sel) sel.classList.add("selected");

  $("#mode-panel-title").textContent = roundLabel(type, num);

  const progress = isRoundAvailable(type, num) ? loadProgressFor(num) : null;
  const hasProgress = progress?.answers && Object.keys(progress.answers).length > 0;

  $("#resume-banner").classList.toggle("hidden", !hasProgress);
  $("#btn-new-start").classList.toggle("hidden", !hasProgress);
  if (hasProgress) {
    $("#resume-text").textContent = `${progress.currentIndex + 1}번 문제부터 이어서 풀 수 있어요`;
  }
}

function modeLabel(mode) {
  const labels = {
    normal: "일반 풀이",
    exam: "시험 모드",
    random: "랜덤 풀이",
    wrongnote: "오답노트",
  };
  return labels[mode] || mode;
}

function getSessionRoundKey() {
  if (session.isWrongNote) return "wrongnote";
  if (session.mode === "random") return `random_${session.randomPoolType}`;
  return getRoundKey(session.roundType, session.roundNum);
}

function startSession(mode, resume = false) {
  const { type, num } = session.selectedRound || {};
  if (!isRoundAvailable(type, num)) return;
  if (type === "sangsi" && !isRoundUnlocked(type, num)) {
    showLockToast();
    return;
  }

  session.mode = mode;
  session.roundType = type;
  session.roundNum = num;
  session.isWrongNote = false;
  session.randomPoolType = null;
  session.answers = {};
  session.examStartedAt = null;
  session.examElapsedSec = null;
  session.questions = [...getRoundQuestions(type, num)];

  if (resume && mode === "normal") {
    const saved = loadProgressFor(num);
    if (saved) {
      session.answers = saved.answers || {};
      session.currentIndex = Math.min(saved.currentIndex || 0, session.questions.length - 1);
    } else {
      session.currentIndex = 0;
    }
  } else {
    session.currentIndex = 0;
    if (mode === "normal") clearProgress();
  }

  beginQuiz();
}

function startRandomSession() {
  const qs = buildRandomQuestions("sangsi");
  if (!qs || qs.length === 0) {
    alert("아직 준비된 문제가 없습니다.");
    return;
  }

  session.mode = "random";
  session.randomPoolType = "sangsi";
  session.roundType = "sangsi";
  session.roundNum = null;
  session.isWrongNote = false;
  session.questions = qs;
  session.answers = {};
  session.currentIndex = 0;
  session.examStartedAt = null;
  session.examElapsedSec = null;

  beginQuiz();
}

function startWrongNoteSession() {
  const list = loadWrongNote();
  if (list.length === 0) {
    showScreen("wrongnoteEmpty");
    return;
  }

  session.mode = "wrongnote";
  session.isWrongNote = true;
  session.questions = list;
  session.answers = {};
  session.currentIndex = 0;
  session.examStartedAt = null;
  session.examElapsedSec = null;

  beginQuiz();
}

function beginQuiz() {
  stopTimer();

  if (session.mode === "exam") {
    session.examStartedAt = Date.now();
    startExamTimer();
  }

  let label = "";
  if (session.isWrongNote) {
    label = `오답노트 · ${session.questions.length}문제`;
  } else if (session.mode === "random") {
    label = `상시 전체 랜덤 · ${session.questions.length}문제`;
  } else {
    label = `${roundLabel(session.roundType, session.roundNum)} · ${modeLabel(session.mode)}`;
  }

  $("#quiz-round-label").textContent = label;
  $("#exam-badge").classList.toggle("hidden", session.mode !== "exam");
  $("#exam-timer").classList.toggle("hidden", session.mode !== "exam");
  $("#btn-review-done").classList.toggle("hidden", !session.isWrongNote);
  document.body.classList.toggle("is-exam-quiz", session.mode === "exam");

  renderQuiz();
  showScreen("quiz");
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startExamTimer() {
  let remaining = EXAM_DURATION_SEC;
  const timerEl = $("#exam-timer");
  timerEl.textContent = formatTime(remaining);
  timerEl.classList.remove("warning");

  timerInterval = setInterval(() => {
    remaining--;
    timerEl.textContent = formatTime(Math.max(0, remaining));
    if (remaining <= 300) timerEl.classList.add("warning");
    if (remaining <= 0) {
      stopTimer();
      session.examElapsedSec = EXAM_DURATION_SEC;
      finishQuiz(true);
    }
  }, 1000);
}

function renderQNav() {
  const nav = $("#q-nav");
  if (session.mode === "random") {
    nav.classList.add("hidden");
    return;
  }
  nav.classList.remove("hidden");
  nav.innerHTML = "";

  const isExam = session.mode === "exam";

  session.questions.forEach((q, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "q-nav-btn";
    if (session.isWrongNote) {
      btn.textContent = q.roundNum ? `${q.roundNum}회·${q.id}` : String(idx + 1);
    } else if (session.mode === "random") {
      btn.textContent = String(idx + 1);
    } else {
      btn.textContent = String(q.id);
    }
    btn.dataset.index = String(idx);

    const ans = session.answers[q.id];
    if (ans?.answered) {
      if (isExam) btn.classList.add("answered-neutral");
      else btn.classList.add(ans.correct ? "correct" : "wrong");
    }
    if (idx === session.currentIndex) btn.classList.add("current");

    btn.addEventListener("click", () => goToQuestion(idx));
    nav.appendChild(btn);
  });

  requestAnimationFrame(() => {
    nav.querySelector(".q-nav-btn.current")?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  });
}

function goToQuestion(index) {
  session.currentIndex = index;
  renderQuiz();
}

function getCurrentQuestion() {
  return session.questions[session.currentIndex];
}

/** 일반/시험/랜덤/오답노트 공통 — 문제 본문 + 이미지 */
function renderQuestionBody(q) {
  $("#question-text").textContent = q.question;
  renderQuestionImage(q);
}

/** image 필드 — 문제 텍스트 아래·보기 위 (4가지 모드 공통) */
function renderQuestionImage(q) {
  const imgWrap = $("#question-image-wrap");

  if (q.image) {
    imgWrap.innerHTML = `<img src="${q.image}" alt="문제 ${q.id} 참고 이미지" style="${IMG_STYLE}" onerror="this.style.display='none'">`;
    imgWrap.classList.remove("hidden");
    imgWrap.setAttribute("aria-hidden", "false");
  } else {
    imgWrap.innerHTML = "";
    imgWrap.classList.add("hidden");
    imgWrap.setAttribute("aria-hidden", "true");
  }
}

function hasOptionImages(q) {
  return Array.isArray(q.option_images) && q.option_images.length >= 4;
}

/** 보기 렌더링 — option_images 시 이미지 보기 (4가지 모드 공통) */
function renderOptions(q, answered, ans, isExam) {
  const optionsEl = $("#options");
  optionsEl.innerHTML = "";
  const useImages = hasOptionImages(q);

  q.options.forEach((opt, i) => {
    const choice = i + 1;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `option-btn${useImages ? " option-btn-image" : ""}`;
    btn.dataset.index = String(choice);

    if (useImages) {
      btn.innerHTML = `<span class="option-label">${OPTION_LABELS[i]}</span><img src="${q.option_images[i]}" alt="보기 ${OPTION_LABELS[i]}" class="option-img" style="max-width:100%;height:auto;border-radius:6px;" onerror="this.style.display='none'">`;
    } else {
      btn.textContent = opt;
    }

    if (answered) {
      btn.disabled = true;
      if (isExam) {
        if (choice === ans.choice) btn.classList.add("selected-exam");
      } else {
        if (choice === ans.choice) btn.classList.add("selected");
        if (choice === q.answer) btn.classList.add("correct");
        else if (choice === ans.choice && !ans.correct) btn.classList.add("wrong");
      }
    } else {
      btn.addEventListener("click", () => selectOption(choice));
    }
    optionsEl.appendChild(btn);
  });
}

function getQuestionTitle(q, idx, total) {
  if (session.isWrongNote) {
    return q.roundNum ? `[${q.roundNum}회] ${q.id}번` : `오답 ${idx + 1} / ${total}`;
  }
  if (session.mode === "random") return `문제 ${idx + 1}`;
  return `문제 ${q.id}`;
}

function renderQuiz() {
  const q = getCurrentQuestion();
  const idx = session.currentIndex;
  const total = session.questions.length;
  const isExam = session.mode === "exam";
  const ans = session.answers[q.id];

  $("#q-number").textContent = getQuestionTitle(q, idx, total);
  $("#subject-tag").textContent = getSubject(q.id) === 1 ? "1과목" : "2과목";
  renderQuestionBody(q);

  renderQNav();

  const answered = !!ans?.answered;
  renderOptions(q, answered, ans, isExam);

  $("#explanation-text").textContent = q.explanation;
  $("#point-text").textContent = q.point;

  const feedbackArea = $("#feedback-area");
  const explainBtn = $("#btn-explain");
  const explainPanel = $("#explain-panel");

  const autoExplain =
    session.isWrongNote ||
    (answered && !isExam && (session.mode === "normal" || session.mode === "random"));

  if (autoExplain) {
    feedbackArea.classList.remove("hidden");
    explainPanel.classList.remove("hidden");
    explainBtn.classList.add("hidden");
  } else {
    feedbackArea.classList.add("hidden");
    explainPanel.classList.add("hidden");
    explainBtn.classList.remove("hidden");
    explainBtn.disabled = true;
    explainBtn.textContent = "📖 해설 보기";
  }

  $("#btn-prev").disabled = idx === 0;
  $("#btn-next").disabled = idx >= total - 1;
  $("#btn-finish").classList.toggle("hidden", session.isWrongNote);
  $(".quiz-actions").classList.toggle("quiz-actions-two", session.isWrongNote);

  saveProgress();
}

function selectOption(choice) {
  const q = getCurrentQuestion();
  if (session.answers[q.id]?.answered) return;

  const isCorrect = choice === q.answer;
  session.answers[q.id] = { choice, correct: isCorrect, answered: true };

  if (!isCorrect && !session.isWrongNote && session.mode !== "exam") {
    const roundKey = q.roundKey || getSessionRoundKey();
    addToWrongNote(q, roundKey);
  }

  if (session.mode === "normal" && !session.isWrongNote) saveProgress();

  if (session.mode === "exam") {
    renderQuiz();
    return;
  }

  if (isCorrect) playCorrectSound();
  else playWrongSound();
  showAnswerModal(isCorrect, q);
}

function showAnswerModal(isCorrect, q) {
  const overlay = $("#modal-overlay");
  const box = $("#modal-box");
  box.classList.remove("correct-theme", "wrong-theme");
  box.classList.add(isCorrect ? "correct-theme" : "wrong-theme");
  $("#modal-icon").textContent = isCorrect ? "🎉" : "💡";
  $("#modal-title").textContent = isCorrect ? "정답입니다!" : "오답입니다";
  const correctText = hasOptionImages(q)
    ? `${OPTION_LABELS[q.answer - 1]}번`
    : q.options[q.answer - 1];
  $("#modal-desc").textContent = isCorrect
    ? "잘 하셨어요! 해설을 확인해 보세요."
    : `정답은 ${correctText}입니다.`;
  overlay.classList.remove("hidden");

  const onConfirm = () => {
    overlay.classList.add("hidden");
    $("#modal-confirm").removeEventListener("click", onConfirm);
    renderQuiz();
  };
  $("#modal-confirm").addEventListener("click", onConfirm);
}

function showSubmitConfirm() {
  const overlay = $("#confirm-overlay");
  overlay.classList.remove("hidden");

  const onOk = () => {
    cleanupConfirm();
    finishQuiz(false);
  };
  const onCancel = () => cleanupConfirm();

  function cleanupConfirm() {
    overlay.classList.add("hidden");
    $("#confirm-ok").removeEventListener("click", onOk);
    $("#confirm-cancel").removeEventListener("click", onCancel);
  }

  $("#confirm-ok").addEventListener("click", onOk);
  $("#confirm-cancel").addEventListener("click", onCancel);
}

function nextQuestion() {
  if (session.currentIndex < session.questions.length - 1) {
    session.currentIndex++;
    renderQuiz();
  }
}

function prevQuestion() {
  if (session.currentIndex > 0) {
    session.currentIndex--;
    renderQuiz();
  }
}

function markReviewDone() {
  const q = getCurrentQuestion();
  if (!q.uid) return;

  removeFromWrongNote(q.uid);
  session.questions = loadWrongNote();

  if (session.questions.length === 0) {
    stopTimer();
    showScreen("wrongnoteEmpty");
    return;
  }

  if (session.currentIndex >= session.questions.length) {
    session.currentIndex = session.questions.length - 1;
  }
  renderQuiz();
}

function finishQuiz(timeUp = false) {
  stopTimer();

  if (session.mode === "exam" && session.examStartedAt) {
    session.examElapsedSec = timeUp
      ? EXAM_DURATION_SEC
      : Math.floor((Date.now() - session.examStartedAt) / 1000);
  }

  if (session.mode === "normal" && !session.isWrongNote) clearProgress();

  showResult();
}

function showResult() {
  showScreen("result");

  const sc = calcScores(session.questions, session.answers);
  const scoreText = Number.isInteger(sc.totalScore)
    ? sc.totalScore
    : sc.totalScore.toFixed(1).replace(/\.0$/, "");

  $("#result-score").textContent = scoreText;

  if (session.mode === "exam") {
    const examPassed = sc.totalScore >= 60;
    $("#result-passfail").textContent = examPassed ? "합격! 🎉" : "불합격 😢";
    $("#result-passfail").className = `result-passfail ${examPassed ? "pass" : "fail"}`;
  } else {
    $("#result-passfail").textContent = sc.passed ? "합격" : "불합격";
    $("#result-passfail").className = `result-passfail ${sc.passed ? "pass" : "fail"}`;
  }

  const timeEl = $("#result-time");
  if (session.mode === "exam" && session.examElapsedSec != null) {
    timeEl.textContent = `시험 소요 시간: ${formatDuration(session.examElapsedSec)}`;
    timeEl.classList.remove("hidden");
  } else {
    timeEl.classList.add("hidden");
  }

  const examWrongCount = session.questions.filter((q) => {
    const a = session.answers[q.id];
    return a?.answered && !a.correct;
  }).length;
  $("#btn-save-wrongnote").classList.toggle(
    "hidden",
    session.mode !== "exam" || examWrongCount === 0
  );
}

function saveExamWrongToNoteAndGo() {
  session.questions.forEach((q) => {
    const a = session.answers[q.id];
    if (a?.answered && !a.correct) {
      const roundKey = q.roundKey || getRoundKey(session.roundType, session.roundNum);
      addToWrongNote(q, roundKey);
    }
  });
  startWrongNoteSession();
}

function handleModeClick(mode) {
  getAudioContext();

  if (mode === "random") {
    startRandomSession();
    return;
  }

  if (mode === "wrongnote") {
    startWrongNoteSession();
    return;
  }

  if (!session.selectedRound || !isRoundAvailable(session.selectedRound.type, session.selectedRound.num)) {
    alert("회차를 먼저 선택해 주세요.");
    return;
  }

  startSession(mode, false);
}

function openCodeModal() {
  if (isProUnlocked()) return;
  $("#code-input").value = "";
  $("#code-error").classList.add("hidden");
  $("#code-modal-overlay").classList.remove("hidden");
  $("#code-input").focus();
}

function closeCodeModal() {
  $("#code-modal-overlay").classList.add("hidden");
}

function submitAccessCode() {
  const val = $("#code-input").value.trim().toUpperCase();
  if (val === ACCESS_CODE.toUpperCase()) {
    unlockPro();
    $("#code-error").classList.add("hidden");
    closeCodeModal();
    updateAccessUI();
  } else {
    $("#code-error").classList.remove("hidden");
  }
}

function initAccessCode() {
  $("#btn-access-code").addEventListener("click", () => {
    if (isProUnlocked()) return;
    openCodeModal();
  });
  $("#code-submit").addEventListener("click", submitAccessCode);
  $("#code-cancel").addEventListener("click", closeCodeModal);
  $("#code-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitAccessCode();
  });
  $("#code-modal-overlay").addEventListener("click", (e) => {
    if (e.target === $("#code-modal-overlay")) closeCodeModal();
  });
}

function initSettings() {
  $("#btn-settings").addEventListener("click", () => {
    $("#settings-panel").classList.remove("hidden");
    $("#settings-backdrop").classList.remove("hidden");
  });
  $("#btn-settings-close").addEventListener("click", closeSettings);
  $("#settings-backdrop").addEventListener("click", closeSettings);
  $$(".font-size-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyFontSize(btn.dataset.size));
  });
}

function closeSettings() {
  $("#settings-panel").classList.add("hidden");
  $("#settings-backdrop").classList.add("hidden");
}

function initMenu() {
  buildRoundButtons();

  $$(".btn-mode").forEach((btn) => {
    btn.addEventListener("click", () => handleModeClick(btn.dataset.mode));
  });

  $("#btn-resume").addEventListener("click", () => {
    if (!session.selectedRound) return;
    getAudioContext();
    startSession("normal", true);
  });

  $("#btn-new-start").addEventListener("click", () => {
    if (!session.selectedRound) return;
    const { type, num } = session.selectedRound;
    localStorage.removeItem(getProgressKey(num));
    selectRound(type, num);
    getAudioContext();
    startSession("normal", false);
  });

  $("#btn-empty-back").addEventListener("click", () => showScreen("menu"));
}

function initQuiz() {
  $("#btn-next").addEventListener("click", nextQuestion);
  $("#btn-prev").addEventListener("click", prevQuestion);
  $("#btn-finish").addEventListener("click", showSubmitConfirm);
  $("#btn-review-done").addEventListener("click", markReviewDone);

  $("#btn-back-menu").addEventListener("click", () => {
    if (confirm("풀이를 중단하고 메인으로 돌아갈까요?")) {
      stopTimer();
      saveProgress();
      showScreen("menu");
    }
  });

  $("#btn-explain").addEventListener("click", () => {
    if (session.mode === "exam") return;
    const panel = $("#explain-panel");
    const btn = $("#btn-explain");
    const open = !panel.classList.contains("hidden");
    panel.classList.toggle("hidden", open);
    btn.textContent = open ? "📖 해설 보기" : "📖 해설 닫기";
  });
}

function initResult() {
  $("#btn-menu").addEventListener("click", () => {
    showScreen("menu");
    if (session.selectedRound?.type) selectRound(session.selectedRound.type, session.selectedRound.num);
  });

  $("#btn-save-wrongnote").addEventListener("click", saveExamWrongToNoteAndGo);
}

async function init() {
  loadFontSize();
  initSettings();

  try {
    await loadQuestions();
  } catch {
    alert("questions.json을 불러오지 못했습니다.\n로컬 서버로 실행해 주세요.");
    return;
  }

  initAccessCode();
  initMenu();
  initQuiz();
  initResult();

  updateAccessUI();
  showScreen("menu");

  try {
    const saved = JSON.parse(localStorage.getItem(LS.selectedRound) || "null");
    if (saved?.type === "sangsi" && isRoundUnlocked(saved.type, saved.num)) {
      selectRound(saved.type, saved.num);
    } else {
      selectRound("sangsi", 1);
    }
  } catch {
    selectRound("sangsi", 1);
  }
}

init();

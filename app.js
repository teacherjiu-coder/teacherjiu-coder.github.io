const ACCESS_CODE = "JW1116";
const EXAM_DURATION_SEC = 40 * 60;
const OPTION_LABELS = ["①", "②", "③", "④"];
const IMG_STYLE = "max-width:100%; height:auto; margin:10px 0; border-radius:8px; display:block;";

const LS = {
  pro: "isPro",
  fontSize: "comhwal_font_size",
  progress: (grade, type, round) => `comhwal_progress_${grade}_${type}_${round}_normal`,
  wrongNote: "comhwal_wrong_note",
  selectedRound: "comhwal_selected_round",
  selectedGrade: "comhwal_selected_grade",
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/** 급수별 회차 수 · 이용 가능 회차 (파일명: questions_{급}ss|gi_{회}.json) */
const GRADE_CONFIG = {
  1: { label: "컴활 1급", sangsiCount: 5, jeonggiCount: 10 },
  2: { label: "컴활 2급", sangsiCount: 5, jeonggiCount: 10 },
};

const AVAILABLE_ROUND_NUMS = {
  2: { sangsi: [1, 2, 3, 4, 5], jeonggi: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  1: { sangsi: [], jeonggi: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
};

function roundFileName(grade, type, num) {
  const code = type === "sangsi" ? "ss" : "gi";
  return `questions_${grade}${code}_${num}.json`;
}

function hasAnyRoundAvailable(grade) {
  const rounds = AVAILABLE_ROUND_NUMS[grade];
  if (!rounds) return false;
  return rounds.sangsi.length > 0 || rounds.jeonggi.length > 0;
}

function getRoundFile(grade, type, num) {
  if (!isRoundAvailable(grade, type, num)) return null;
  return roundFileName(grade, type, num);
}

const questionPools = { 1: { sangsi: {}, jeonggi: {} }, 2: { sangsi: {}, jeonggi: {} } };
let currentGrade = null;
let audioCtx = null;
let timerInterval = null;

const session = {
  grade: null,
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
  $("#btn-access-code").classList.toggle("hidden", name !== "menu");
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
  if (type !== "sangsi" && type !== "jeonggi") return false;
  if (num === 1) return true;
  return isProUnlocked();
}

function showLockToast() {
  const toast = $("#lock-toast");
  toast.classList.remove("hidden");
  clearTimeout(showLockToast._timer);
  showLockToast._timer = setTimeout(() => toast.classList.add("hidden"), 2500);
}

function showComingSoonToast() {
  const toast = $("#coming-soon-toast");
  toast.classList.remove("hidden");
  clearTimeout(showComingSoonToast._timer);
  showComingSoonToast._timer = setTimeout(() => toast.classList.add("hidden"), 2500);
}

function gradeLabel(grade) {
  return GRADE_CONFIG[grade]?.label || `컴활 ${grade}급`;
}

function showGradeSelectView() {
  $("#grade-select-view").classList.remove("hidden");
  $("#round-select-view").classList.add("hidden");
}

function showRoundSelectView() {
  $("#grade-select-view").classList.add("hidden");
  $("#round-select-view").classList.remove("hidden");
}

function selectGrade(grade) {
  if (!hasAnyRoundAvailable(grade)) {
    showComingSoonToast();
    return;
  }
  currentGrade = grade;
  session.grade = grade;
  localStorage.setItem(LS.selectedGrade, String(grade));
  $("#grade-round-title").textContent = GRADE_CONFIG[grade].label;
  buildRoundButtons(grade);
  showRoundSelectView();
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
  if (currentGrade) buildRoundButtons(currentGrade);
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

function isRoundAvailable(grade, type, num) {
  return AVAILABLE_ROUND_NUMS[grade]?.[type]?.includes(num) ?? false;
}

function getRoundQuestions(grade, type, num) {
  return questionPools[grade]?.[type]?.[num] || [];
}

async function fetchRoundQuestions(grade, type, num) {
  const cached = getRoundQuestions(grade, type, num);
  if (cached.length > 0) return cached;

  const file = getRoundFile(grade, type, num);
  if (!file) throw new Error("문제 파일이 없습니다.");

  const res = await fetch(file);
  if (!res.ok) throw new Error(`${file}을 불러올 수 없습니다.`);
  const qs = await res.json();
  questionPools[grade][type][num] = qs.map((q) => ({
    ...q,
    roundKey: getRoundKey(grade, type, num),
    roundNum: num,
    roundType: type,
    grade,
  }));
  return questionPools[grade][type][num];
}

async function ensureSangsiPoolLoaded(grade) {
  const nums = AVAILABLE_ROUND_NUMS[grade]?.sangsi || [];
  await Promise.all(nums.map((num) => fetchRoundQuestions(grade, "sangsi", num)));
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
    grade: q.grade,
  });
  saveWrongNote(list);
}

function removeFromWrongNote(uid) {
  saveWrongNote(loadWrongNote().filter((item) => item.uid !== uid));
}

function getProgressKey(grade, type, roundNum) {
  return LS.progress(grade, type, roundNum);
}

function saveProgress() {
  if (session.mode !== "normal" || session.isWrongNote) return;
  const grade = session.grade || session.selectedRound?.grade;
  if (!grade) return;
  localStorage.setItem(
    getProgressKey(grade, session.roundType, session.roundNum),
    JSON.stringify({
      roundNum: session.roundNum,
      currentIndex: session.currentIndex,
      answers: session.answers,
    })
  );
}

function loadProgressFor(grade, type, roundNum) {
  try {
    return JSON.parse(localStorage.getItem(getProgressKey(grade, type, roundNum)));
  } catch {
    return null;
  }
}

function clearProgress() {
  const grade = session.grade || session.selectedRound?.grade;
  if (!grade) return;
  localStorage.removeItem(getProgressKey(grade, session.roundType, session.roundNum));
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

/** 100점 만점 환산 점수 (세트 문항 수 기준) */
function getScoreOn100(sc, questions) {
  const maxScore = questions.length * 2.5;
  if (maxScore <= 0) return 0;
  return (sc.totalScore / maxScore) * 100;
}

/** 합격 판정: 100점 환산 60점 이상 (시험·일반·랜덤 공통) */
function isResultPassed(sc, questions) {
  return getScoreOn100(sc, questions) >= 60;
}

function renderPassFailResult(sc, questions) {
  const passed = isResultPassed(sc, questions);
  $("#result-passfail").textContent = passed ? "합격! 🎉" : "불합격 😢";
  $("#result-passfail").className = `result-passfail ${passed ? "pass" : "fail"}`;
}

const PASS_COUNT_BASE = 29600;
const PASS_COUNT_BASE_DATE = new Date(2026, 4, 31);

function getPassCount() {
  const today = new Date();
  let days = Math.floor((today - PASS_COUNT_BASE_DATE) / 86400000);
  if (days < 0) days = 0;
  let total = PASS_COUNT_BASE;
  for (let i = 0; i < days; i++) {
    const s = Math.sin(PASS_COUNT_BASE_DATE.getTime() / 86400000 + i) * 10000;
    const frac = s - Math.floor(s);
    total += 1 + Math.floor(frac * 5);
  }
  return total;
}

function updatePassCountDisplay() {
  const text = getPassCount().toLocaleString("ko-KR");
  $$(".promo-pass-count").forEach((el) => {
    el.textContent = text;
  });
}

function updateResultPromoHeadline(passed) {
  const headEl = $("#result-promo-headline");
  if (!headEl) return;
  headEl.innerHTML = passed
    ? "합격 축하해요! 🎉<br>실기도 핵심 강의로 이어서 끝내세요"
    : "조금만 더 다지면 합격권이에요.<br>강의로 약점만 빠르게 메우세요";
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(sec) {
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}

function getRoundKey(grade, type, num) {
  return `${grade}_${type}_${num}`;
}

function getPoolByType(grade, poolType) {
  const pool = questionPools[grade]?.[poolType] || {};
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

function buildRandomQuestions(grade, poolType) {
  const { computer, spreadsheet } = getPoolByType(grade, poolType);
  if (computer.length === 0 && spreadsheet.length === 0) return null;

  const picked1 = pickRandom(computer, 20);
  const picked2 = pickRandom(spreadsheet, 20);
  return shuffle([...picked1, ...picked2]);
}

function buildRoundButtons(grade) {
  const config = GRADE_CONFIG[grade];
  if (!config) return;

  $("#sangsi-grid").innerHTML = "";
  $("#jeonggi-grid").innerHTML = "";
  for (let i = 1; i <= config.sangsiCount; i++) {
    $("#sangsi-grid").appendChild(createRoundBtn(grade, "sangsi", i));
  }
  for (let i = 1; i <= config.jeonggiCount; i++) {
    $("#jeonggi-grid").appendChild(createRoundBtn(grade, "jeonggi", i));
  }
}

function createRoundBtn(grade, type, num) {
  const hasData = isRoundAvailable(grade, type, num);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.grade = String(grade);
  btn.dataset.type = type;
  btn.dataset.num = String(num);

  if (!hasData) {
    btn.className = "round-btn disabled";
    btn.disabled = true;
    btn.innerHTML = `<span class="round-num">${num}회</span><span class="round-soon">준비 중</span>`;
    return btn;
  }

  const unlocked = isRoundUnlocked(type, num);
  btn.className = `round-btn${unlocked ? "" : " locked"}`;
  btn.innerHTML = unlocked
    ? `<span class="round-num">${num}회</span>`
    : `<span class="round-lock" aria-hidden="true">🔒</span><span class="round-num">${num}회</span>`;
  btn.addEventListener("click", () => {
    if (unlocked) selectRound(grade, type, num);
    else showLockToast();
  });
  return btn;
}

function selectRound(grade, type, num) {
  if (!isRoundUnlocked(type, num)) {
    showLockToast();
    return;
  }
  session.grade = grade;
  session.selectedRound = { grade, type, num };
  localStorage.setItem(LS.selectedRound, JSON.stringify({ grade, type, num }));
  $$(".round-btn").forEach((b) => b.classList.remove("selected"));
  const sel = document.querySelector(
    `.round-btn[data-grade="${grade}"][data-type="${type}"][data-num="${num}"]`
  );
  if (sel) sel.classList.add("selected");

  $("#mode-panel-title").textContent = `${gradeLabel(grade)} · ${roundLabel(type, num)}`;

  const progress = isRoundAvailable(grade, type, num) ? loadProgressFor(grade, type, num) : null;
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
  if (session.mode === "random") return `random_${session.grade || currentGrade}_${session.randomPoolType}`;
  return getRoundKey(session.grade || session.selectedRound?.grade, session.roundType, session.roundNum);
}

async function startSession(mode, resume = false) {
  const { grade, type, num } = session.selectedRound || {};
  if (!isRoundAvailable(grade, type, num)) return;
  if (!isRoundUnlocked(type, num)) {
    showLockToast();
    return;
  }

  let questions;
  try {
    questions = await fetchRoundQuestions(grade, type, num);
  } catch {
    alert("문제를 불러오지 못했습니다.\n로컬 서버로 실행해 주세요.");
    return;
  }

  session.mode = mode;
  session.grade = grade;
  session.roundType = type;
  session.roundNum = num;
  session.isWrongNote = false;
  session.randomPoolType = null;
  session.answers = {};
  session.examStartedAt = null;
  session.examElapsedSec = null;
  session.questions = [...questions];

  if (resume && mode === "normal") {
    const saved = loadProgressFor(grade, type, num);
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

async function startRandomSession() {
  const grade = currentGrade || session.grade || "2";
  try {
    await ensureSangsiPoolLoaded(grade);
  } catch {
    alert("문제를 불러오지 못했습니다.\n로컬 서버로 실행해 주세요.");
    return;
  }

  const qs = buildRandomQuestions(grade, "sangsi");
  if (!qs || qs.length === 0) {
    alert("아직 준비된 문제가 없습니다.");
    return;
  }

  session.mode = "random";
  session.grade = grade;
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
    label = `${gradeLabel(session.grade || currentGrade)} 상시 전체 랜덤 · ${session.questions.length}문제`;
  } else {
    label = `${gradeLabel(session.grade || currentGrade)} · ${roundLabel(session.roundType, session.roundNum)} · ${modeLabel(session.mode)}`;
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
  return (
    Array.isArray(q.option_images) &&
    q.option_images.length >= 4 &&
    q.option_images.every((src) => src != null && src !== "")
  );
}

function renderExplanationImage(q) {
  const imgWrap = $("#explanation-image-wrap");
  if (!imgWrap) return;

  if (q.explanation_image) {
    // 단일 문자열 또는 배열 모두 지원
    const srcs = Array.isArray(q.explanation_image) ? q.explanation_image : [q.explanation_image];
    imgWrap.innerHTML = srcs
      .map((src, i) => `<img src="${src}" alt="문제 ${q.id} 해설 참고 이미지${srcs.length > 1 ? ` (${i+1})` : ''}" style="${IMG_STYLE}" onerror="this.style.display='none'">`)
      .join("");
    imgWrap.classList.remove("hidden");
    imgWrap.setAttribute("aria-hidden", "false");
  } else {
    imgWrap.innerHTML = "";
    imgWrap.classList.add("hidden");
    imgWrap.setAttribute("aria-hidden", "true");
  }
}

/** 보기 렌더링 — option_images 시 이미지 보기 (4가지 모드 공통) */
function renderOptions(q, answered, ans, isExam) {
  const optionsEl = $("#options");
  optionsEl.innerHTML = "";
  const useImages = hasOptionImages(q);
  optionsEl.classList.toggle("options-image-grid", useImages);

  q.options.forEach((opt, i) => {
    const choice = i + 1;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `option-btn${useImages ? " option-btn-image" : ""}`;
    btn.dataset.index = String(choice);

    if (useImages) {
      btn.innerHTML = `<span class="option-label">${OPTION_LABELS[i]}</span><img src="${q.option_images[i]}" alt="보기 ${OPTION_LABELS[i]}" class="option-img" onerror="this.style.display='none'">`;
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
  renderExplanationImage(q);
  const grade = q.grade ?? session.grade ?? session.selectedRound?.grade;
  const roundType = q.roundType || session.roundType;
  const hidePoint = grade === 2 && roundType === "jeonggi";
  const showPoint = !hidePoint && q.point != null && String(q.point).trim() !== "";
  const pointBlock = $("#point-block");
  if (pointBlock) pointBlock.classList.toggle("hidden", !showPoint);
  if (showPoint) $("#point-text").textContent = q.point;

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

  if (session.mode === "exam" || session.mode === "normal" || session.mode === "random") {
    renderPassFailResult(sc, session.questions);
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

  const passed =
    session.mode === "exam" || session.mode === "normal" || session.mode === "random"
      ? isResultPassed(sc, session.questions)
      : sc.passed;
  updateResultPromoHeadline(passed);
  updatePassCountDisplay();
}

function saveExamWrongToNoteAndGo() {
  session.questions.forEach((q) => {
    const a = session.answers[q.id];
    if (a?.answered && !a.correct) {
      const grade = q.grade || session.grade || session.selectedRound?.grade;
      const roundKey = q.roundKey || getRoundKey(grade, session.roundType, session.roundNum);
      addToWrongNote(q, roundKey);
    }
  });
  startWrongNoteSession();
}

async function handleModeClick(mode) {
  getAudioContext();

  if (mode === "random") {
    await startRandomSession();
    return;
  }

  if (mode === "wrongnote") {
    startWrongNoteSession();
    return;
  }

  const { grade, type, num } = session.selectedRound || {};
  if (!grade || !isRoundAvailable(grade, type, num)) {
    alert("회차를 먼저 선택해 주세요.");
    return;
  }

  await startSession(mode, false);
}

function sanitizeAccessCode(value) {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function bindCodeInputMask() {
  const input = $("#code-input");

  input.addEventListener("input", () => {
    const cleaned = sanitizeAccessCode(input.value);
    if (input.value !== cleaned) input.value = cleaned;
  });

  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData("text");
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const merged = input.value.slice(0, start) + pasted + input.value.slice(end);
    input.value = sanitizeAccessCode(merged);
    input.setSelectionRange(input.value.length, input.value.length);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      submitAccessCode();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (allowed.includes(e.key)) return;
    if (/^[a-zA-Z0-9]$/.test(e.key)) return;
    e.preventDefault();
  });
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
  const val = sanitizeAccessCode($("#code-input").value);
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
  bindCodeInputMask();
  $("#btn-access-code").addEventListener("click", () => {
    if (isProUnlocked()) return;
    openCodeModal();
  });
  $("#code-submit").addEventListener("click", submitAccessCode);
  $("#code-cancel").addEventListener("click", closeCodeModal);
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

function initPatchnotes() {
  const card = $("#patchnotes-card");
  const toggle = $("#patchnotes-toggle");
  if (!card || !toggle) return;

  toggle.addEventListener("click", () => {
    const open = card.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

function initMenu() {
  $$(".grade-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const grade = Number(btn.dataset.grade);
      if (!hasAnyRoundAvailable(grade)) {
        showComingSoonToast();
        return;
      }
      selectGrade(grade);
    });
  });

  $("#btn-back-grade").addEventListener("click", () => {
    showGradeSelectView();
  });

  $$(".btn-mode").forEach((btn) => {
    btn.addEventListener("click", () => handleModeClick(btn.dataset.mode));
  });

  $("#btn-resume").addEventListener("click", async () => {
    if (!session.selectedRound) return;
    getAudioContext();
    await startSession("normal", true);
  });

  $("#btn-new-start").addEventListener("click", async () => {
    if (!session.selectedRound) return;
    const { grade, type, num } = session.selectedRound;
    localStorage.removeItem(getProgressKey(grade, type, num));
    selectRound(grade, type, num);
    getAudioContext();
    await startSession("normal", false);
  });

  $("#btn-empty-back").addEventListener("click", () => {
    showGradeSelectView();
    showScreen("menu");
  });
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
      showRoundSelectView();
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
    showRoundSelectView();
    showScreen("menu");
    const { grade, type, num } = session.selectedRound || {};
    if (grade && type && num) selectRound(grade, type, num);
  });

  $("#btn-save-wrongnote").addEventListener("click", saveExamWrongToNoteAndGo);
}

async function init() {
  loadFontSize();
  initSettings();
  initAccessCode();
  initMenu();
  initPatchnotes();
  initQuiz();
  initResult();

  updateAccessUI();
  updatePassCountDisplay();
  showScreen("menu");
  showGradeSelectView();
}

init();

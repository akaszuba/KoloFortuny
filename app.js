(function () {
  "use strict";

  const USED_QUESTIONS_KEY = "kolo-wiedzy-used-questions-v1";
  const TAU = Math.PI * 2;
  const colors = ["#365e92", "#a96a2e", "#2f7e83", "#76528c", "#587147", "#426c86", "#a96f38", "#50617b", "#965e58", "#287c76"];
  const letterLabels = ["A", "B", "C", "D", "E", "F"];

  const elements = {
    setupView: document.getElementById("setup-view"),
    gameView: document.getElementById("game-view"),
    setupForm: document.getElementById("setup-form"),
    playerCount: document.getElementById("player-count"),
    playerNameFields: document.getElementById("player-name-fields"),
    targetInput: document.getElementById("target-value"),
    targetLabel: document.getElementById("target-label"),
    targetUnit: document.getElementById("target-unit"),
    targetHelp: document.getElementById("target-help"),
    startButton: document.getElementById("start-button"),
    dataStatus: document.getElementById("data-status"),
    storageNote: document.getElementById("storage-note"),
    poolSummary: document.getElementById("pool-summary"),
    resetPoolButton: document.getElementById("reset-pool-button"),
    questionCount: document.getElementById("question-count"),
    categoryCount: document.getElementById("category-count"),
    endGameButton: document.getElementById("end-game-button"),
    goalPill: document.getElementById("goal-pill"),
    wheelSection: document.getElementById("wheel-section"),
    wheelCanvas: document.getElementById("wheel-canvas"),
    currentPlayerName: document.getElementById("current-player-name"),
    spinButton: document.getElementById("spin-button"),
    categoryStatus: document.getElementById("category-status"),
    questionPanel: document.getElementById("question-panel"),
    questionCategory: document.getElementById("question-category"),
    questionProgress: document.getElementById("question-progress"),
    questionText: document.getElementById("question-text"),
    questionImage: document.getElementById("question-image"),
    answerList: document.getElementById("answer-list"),
    answerFeedbackDialog: document.getElementById("answer-feedback-dialog"),
    answerResultIcon: document.getElementById("answer-result-icon"),
    answerResultTitle: document.getElementById("answer-result-title"),
    answerResultMessage: document.getElementById("answer-result-message"),
    answerResultContinue: document.getElementById("answer-result-continue"),
    finishPanel: document.getElementById("finish-panel"),
    finishTitle: document.getElementById("finish-title"),
    finishReason: document.getElementById("finish-reason"),
    winnerText: document.getElementById("winner-text"),
    finalRanking: document.getElementById("final-ranking"),
    newGameButton: document.getElementById("new-game-button"),
    scoreboard: document.getElementById("scoreboard"),
  };

  const state = {
    questions: [],
    usedIds: readUsedIds(),
    loaded: false,
    game: null,
    rotation: 0,
    spinning: false,
    animationFrame: null,
    categoriesOnWheel: []
  };
  const targetValues = { points: "10", rounds: "5" };
  let activeGoalMode = "points";
  let audioContext = null;

  function getAudioContext() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return null;

    try {
      if (!audioContext) audioContext = new AudioContextConstructor();
      if (audioContext.state === "suspended") audioContext.resume().catch(function () {});
      return audioContext;
    } catch (error) {
      return null;
    }
  }

  function playTone(context, frequency, startTime, duration, type, volume, endFrequency) {
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startTime);
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startTime + duration);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration + 0.01);
    } catch (error) {
      // Audio is optional; the game should continue if a browser blocks sound.
    }
  }

  function playWheelTick() {
    const context = getAudioContext();
    if (!context) return;
    playTone(context, 1500, context.currentTime, 0.025, "triangle", 0.035, 750);
  }

  function playWheelStop() {
    const context = getAudioContext();
    if (!context) return;
    const now = context.currentTime;
    playTone(context, 660, now, 0.38, "sine", 0.07);
    playTone(context, 990, now + 0.09, 0.48, "sine", 0.055);
  }

  function playAnswerSound(isCorrect) {
    const context = getAudioContext();
    if (!context) return;
    const now = context.currentTime;
    const notes = isCorrect
      ? [{ frequency: 523, offset: 0 }, { frequency: 659, offset: 0.09 }, { frequency: 784, offset: 0.18 }]
      : [{ frequency: 294, offset: 0 }, { frequency: 196, offset: 0.14 }];
    notes.forEach(function (note) {
      playTone(context, note.frequency, now + note.offset, isCorrect ? 0.2 : 0.25, "triangle", isCorrect ? 0.065 : 0.055);
    });
  }

  function readUsedIds() {
    try {
      const value = window.localStorage.getItem(USED_QUESTIONS_KEY);
      const ids = value ? JSON.parse(value) : [];
      return new Set(Array.isArray(ids) ? ids.filter(function (id) { return typeof id === "string"; }) : []);
    } catch (error) {
      elements.storageNote.textContent = "Nie można odczytać historii pytań. Gra nie zapisze jej po odświeżeniu strony.";
      return new Set();
    }
  }

  function persistUsedIds() {
    try {
      window.localStorage.setItem(USED_QUESTIONS_KEY, JSON.stringify(Array.from(state.usedIds)));
      elements.storageNote.textContent = "Historia wykorzystanych pytań zapisuje się w tej przeglądarce.";
    } catch (error) {
      elements.storageNote.textContent = "Przeglądarka nie pozwoliła zapisać historii. Pytania nie będą powtarzane do końca tej sesji.";
    }
  }
  function loadQuestions() {
    try {
      window.QUESTIONS
      state.loaded = true;
      state.questions= window.QUESTIONS;
      elements.dataStatus.textContent =  "Pula pytań jest gotowa.";
      elements.questionCount.textContent = state.questions.length;
      elements.categoryCount.textContent = new Set(state.questions.map(function (question) { return question.category; })).size;
      refreshPoolDisplay();
    } catch (error) {
      elements.dataStatus.dataset.error = "true";
      elements.dataStatus.textContent = "Nie udało się wczytać pytań: " + error.message;
      elements.startButton.disabled = true;
    }
  }

  function getAvailableQuestions() {
    let qesions = state.questions.filter(function (question) { return !state.usedIds.has(question.id); });
    if (qesions.length === 0 || state.questions.length >0) {
            return state.questions.filter(function (question) { return !state.usedIds.has(question.id); });
    }
    return qesions;
  }

  function getAvailableCategories() {
    return state.questions.reduce(function (categories, question) {
      if(!categories.includes(question.category)) {
        categories.push(question.category);
      }
      return categories;
    }, []);
  }

  function refreshPoolDisplay() {
    const total = state.questions.length;
    const available = getAvailableQuestions().length;
    elements.poolSummary.textContent = total
      ? "Pozostało " + available + " z " + total + " pytań."
      : "Wczytuję pulę pytań…";
    elements.startButton.disabled = !state.loaded || available === 0;
    if (state.loaded && available === 0) {
      elements.dataStatus.textContent = "Wykorzystano już całą pulę. Wyzeruj historię, aby zagrać ponownie.";
    }

    if (!state.game || (!state.game.finished && !state.spinning)) {
      state.categoriesOnWheel = getAvailableCategories();
      drawWheel( state.rotation);
    }
  }

  function makePlayerFields() {
    const previousNames = Array.from(elements.playerNameFields.querySelectorAll("input")).map(function (input) { return input.value; });
    const count = Number(elements.playerCount.value);
    elements.playerNameFields.replaceChildren();
    for (let i = 0; i < count; i += 1) {
      const label = document.createElement("label");
      label.className = "player-name-field";
      const caption = document.createElement("span");
      caption.textContent = "GRACZ " + (i + 1);
      const input = document.createElement("input");
      input.className = "field-control";
      input.type = "text";
      input.maxLength = 24;
      input.autocomplete = "off";
      input.placeholder = "np. Ania";
      input.setAttribute("aria-label", "Imię gracza " + (i + 1));
      input.value = previousNames[i] || "";
      label.append(caption, input);
      elements.playerNameFields.append(label);
    }
  }

  function selectedMode() {
    const selected = document.querySelector('input[name="goalMode"]:checked');
    return selected ? selected.value : "points";
  }

  function updateGoalFields() {
    const mode = selectedMode();
    targetValues[activeGoalMode] = elements.targetInput.value || targetValues[activeGoalMode];
    activeGoalMode = mode;
    const isRounds = mode === "rounds";
    elements.targetLabel.textContent = isRounds ? "Liczba rund" : "Cel punktowy";
    elements.targetUnit.textContent = isRounds ? "rund" : "pkt";
    elements.targetInput.max = isRounds ? "99" : "999";
    elements.targetInput.value = targetValues[mode];
    elements.targetHelp.textContent = isRounds
      ? "Każdy gracz rozegra tyle samo rund. Wygrywa najwyższy wynik."
      : "Pierwszy gracz, który zdobędzie ten wynik, wygrywa.";
  }

  function wrapCategory(name, maxCharacters) {
    const words = name.split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach(function (word) {
      const candidate = line ? line + " " + word : word;
      if (line && candidate.length > maxCharacters) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawWheel( rotation) {
    const canvas = elements.wheelCanvas;
    const logicalSize = 600;
    const displaySize = canvas.getBoundingClientRect().width || logicalSize;
    const deviceScale = Math.min(window.devicePixelRatio || 1, 2);
    const renderScale = Math.max(1, displaySize / logicalSize * deviceScale);
    const backingSize = Math.ceil(logicalSize * renderScale);
    if (canvas.width !== backingSize || canvas.height !== backingSize) {
      canvas.width = backingSize;
      canvas.height = backingSize;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = canvas.width / logicalSize;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const center = logicalSize / 2;
    const radius = center - 21;
    const safeRotation = ((rotation % TAU) + TAU) % TAU;
    ctx.clearRect(0, 0, logicalSize, logicalSize);
    let categories = state.categoriesOnWheel;

    if (!categories.length) {
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, TAU);
      ctx.fillStyle = "#263952";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(center, center, 72, 0, TAU);
      ctx.fillStyle = "#1b2940";
      ctx.fill();
      ctx.fillStyle = "#bfcbdb";
      ctx.textAlign = "center";
      ctx.font = "700 14px sans-serif";
      ctx.fillText("PUSTO", center, center + 5);
      canvas.setAttribute("aria-label", "Brak dostępnych kategorii pytań");
      return;
    }

    const step = TAU / categories.length;
    categories.forEach(function (category, index) {
      const start = -Math.PI / 2 + safeRotation + index * step;
      const end = start + step;
      const middle = (start + end) / 2;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#111c2e";
      ctx.stroke();

      const labelRadius = radius * .66;
      ctx.save();
      ctx.translate(center + Math.cos(middle) * labelRadius, center + Math.sin(middle) * labelRadius);
      let textAngle = middle + Math.PI / 2 - 90 * Math.PI / 180;
      ctx.rotate(textAngle);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fontSize = 20;
      ctx.font = "700 " + fontSize + "px sans-serif";
      const lines = wrapCategory(category, 20);
      lines.forEach(function (line, lineIndex) {
        const y = (lineIndex - (lines.length - 1) / 2) * (fontSize + 2);
        ctx.fillText(line, 0, y, radius * .58);
      });
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(center, center, 65, 0, TAU);
    ctx.fillStyle = "#1b2940";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#efb94c";
    ctx.stroke();    
  }

  function beginGame(event) {
    event.preventDefault();
    if (!state.loaded || !getAvailableQuestions().length) return;
    const mode = selectedMode();
    const target = Number(elements.targetInput.value);
    if (!Number.isInteger(target) || target < 1) {
      elements.targetInput.focus();
      return;
    }
    const names = Array.from(elements.playerNameFields.querySelectorAll("input"));
    const players = names.map(function (input, index) {
      return { name: input.value.trim() || "Gracz " + (index + 1), score: 0 };
    });
    state.game = {
      players: players,
      mode: mode,
      target: target,
      round: 1,
      currentPlayer: 0,
      answered: 0,
      currentQuestion: null,
      answerSubmitted: false,
      pendingFinishReason: "",
      finished: false
    };
    elements.setupView.hidden = true;
    elements.gameView.hidden = false;
    elements.endGameButton.hidden = false;
    closeQuestionPanel();
    elements.finishPanel.hidden = true;
    elements.wheelSection.hidden = false;
    elements.categoryStatus.textContent = "";
    elements.spinButton.disabled = false;
    state.categoriesOnWheel = getAvailableCategories();
    drawWheel(state.rotation);
    updateGameDisplay();
  }

  function updateGameDisplay() {
    if (!state.game) return;
    const game = state.game;
    elements.currentPlayerName.textContent = game.players[game.currentPlayer].name;
    elements.goalPill.textContent = game.mode === "points"
      ? "Cel: " + game.target + " pkt"
      : "Runda " + game.round + " z " + game.target;
    elements.scoreboard.replaceChildren();
    game.players.forEach(function (person, index) {
      const row = document.createElement("li");
      row.className = "scoreboard-row" + (!game.finished && index === game.currentPlayer ? " active" : "");
      if (!game.finished && index === game.currentPlayer) row.setAttribute("aria-current", "true");
      const indicator = document.createElement("span");
      indicator.className = "player-indicator";
      indicator.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.className = "player-name";
      name.textContent = person.name;
      const score = document.createElement("span");
      score.className = "player-score";
      score.textContent = String(person.score);
      score.setAttribute("aria-label", person.score + " pkt");
      row.append(indicator, name, score);
      elements.scoreboard.append(row);
    });
  }

  function spinWheel() {
    if (!state.game || state.game.finished || state.spinning || state.game.currentQuestion) return;   
    drawWheel(state.rotation);
    state.spinning = true;
    elements.spinButton.disabled = true;
    playWheelTick();
    elements.categoryStatus.textContent = "Koło się kręci…";


    const selectedQuestionIndex = Math.floor(Math.random() * getAvailableQuestions().length);
    const question = getAvailableQuestions()[selectedQuestionIndex];
    const selectedCategory = question.category;
    const step = TAU / state.categoriesOnWheel.length;
    const selectedIndex = state.categoriesOnWheel.indexOf(selectedCategory);
    const desiredRotation = ((Math.PI / 2 - (selectedIndex + .5) * step) % TAU + TAU) % TAU;
    const currentRotation = ((state.rotation % TAU) + TAU) % TAU;
    const delta = (desiredRotation - currentRotation + TAU) % TAU;
    const startRotation = state.rotation;
    const endRotation = startRotation + TAU * (5 + Math.floor(Math.random() * 3)) + delta;
    const startTime = performance.now();
    const duration = 4500;
    let lastTickIndex = 0;
    let lastTickTime = startTime;

    function animate(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const rotation = startRotation + (endRotation - startRotation) * eased;
      drawWheel(rotation);
      const tickIndex = Math.floor((rotation - startRotation) / step);
      if (tickIndex > lastTickIndex && now - lastTickTime >= 36) {
        playWheelTick();
        lastTickTime = now;
      }
      lastTickIndex = tickIndex;
      if (progress < 1) {
        state.animationFrame = window.requestAnimationFrame(animate);
        return;
      }

      state.animationFrame = null;
      state.rotation = endRotation % TAU;
      drawWheel( state.rotation);
      state.spinning = false;
      playWheelStop();
      elements.categoryStatus.textContent = "Wylosowana kategoria: " + selectedCategory;
      showQuestion(question);
    }
    window.requestAnimationFrame(animate);
  }

  function showQuestion(question) {
    state.game.currentQuestion = question;
    state.game.answerSubmitted = false;
    state.usedIds.add(question.id);
    persistUsedIds();
    elements.questionCategory.textContent = question.category;
    elements.questionProgress.textContent = "Pytanie " + (state.game.answered + 1);
    elements.questionText.textContent = question.question;
    elements.answerList.replaceChildren();
    elements.questionPanel.classList.toggle("has-image", Boolean(question.image));
    elements.questionImage.hidden = !question.image;
    elements.questionImage.removeAttribute("src");
    if (question.image) {
      elements.questionImage.alt = "Ilustracja do pytania";
      elements.questionImage.onerror = function () {
        elements.questionImage.hidden = true;
        elements.questionPanel.classList.remove("has-image");
      };
      elements.questionImage.src = question.image;
    }

    question.answers.forEach(function (answer, index) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer-option";
      button.dataset.index = String(index);
      button.setAttribute("aria-label", (letterLabels[index] || String(index + 1)) + ". " + answer);
      const letter = document.createElement("span");
      letter.className = "answer-letter";
      letter.setAttribute("aria-hidden", "true");
      letter.textContent = letterLabels[index] || String(index + 1);
      const copy = document.createElement("span");
      copy.className = "answer-copy";
      copy.textContent = answer;
      button.append(letter, copy);
      button.addEventListener("click", function () { submitAnswer(index); });
      elements.answerList.append(button);
    });
    if (!elements.questionPanel.open) elements.questionPanel.showModal();
    elements.questionText.focus({ preventScroll: true });
  }

  function plural(n, one, few, many) {
    if (n === 1) return one;
    const lastTwo = n % 100;
    const last = n % 10;
    return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
  }

  function submitAnswer(selectedIndex) {
    const game = state.game;
    if (!game || game.answerSubmitted || !game.currentQuestion || game.finished) return;
    game.answerSubmitted = true;
    game.answered += 1;
    const question = game.currentQuestion;
    const isCorrect = selectedIndex === question.correctIndex;
    playAnswerSound(isCorrect);
    if (isCorrect) game.players[game.currentPlayer].score += 1;

    Array.from(elements.answerList.querySelectorAll(".answer-option")).forEach(function (button, index) {
      button.disabled = true;
      if (index === question.correctIndex) button.classList.add("is-correct");
      else if (index === selectedIndex) button.classList.add("is-wrong");
    });

    const playerName = game.players[game.currentPlayer].name;
    updateGameDisplay();

    let finishReason = "";
    if (game.mode === "points" && game.players[game.currentPlayer].score >= game.target) {
      finishReason = playerName + " osiąga cel " + game.target + " " + plural(game.target, "punkt", "punkty", "punktów") + ".";
    } else if (game.mode === "rounds" && game.round === game.target && game.currentPlayer === game.players.length - 1) {
      finishReason = "Każdy gracz rozegrał " + game.target + " " + plural(game.target, "rundę", "rundy", "rund") + ".";
    }

    const nextPlayerIndex = (game.currentPlayer + 1) % game.players.length;
    elements.answerFeedbackDialog.classList.toggle("is-correct", isCorrect);
    elements.answerResultIcon.textContent = isCorrect ? "✓" : "!";
    elements.answerResultTitle.textContent = isCorrect ? "Dobra odpowiedź" : "Niepoprawna odpowiedź";
    elements.answerResultMessage.textContent = isCorrect
      ? playerName + " zdobywa 1 punkt."
      : "Poprawna odpowiedź: " + question.answers[question.correctIndex] + ".";
    elements.answerResultContinue.textContent = finishReason
      ? "Pokaż wynik końcowy"
      : "Następna kolej: " + game.players[nextPlayerIndex].name;
    game.pendingFinishReason = finishReason;
    elements.answerFeedbackDialog.showModal();
    elements.answerResultContinue.focus({ preventScroll: true });
  }

  function continueAfterAnswer() {
    const game = state.game;
    if (!game || !game.answerSubmitted || game.finished) return;
    const finishReason = game.pendingFinishReason;
    closeAnswerFeedbackDialog();
    if (finishReason) {
      game.pendingFinishReason = "";
      finishGame(finishReason);
      return;
    }
    nextTurn();
  }

  function nextTurn() {
    const game = state.game;
    if (!game || !game.answerSubmitted || game.finished) return;
    game.currentPlayer = (game.currentPlayer + 1) % game.players.length;
    if (game.currentPlayer === 0) game.round += 1;
    game.currentQuestion = null;
    game.answerSubmitted = false;
    if (!getAvailableQuestions().length) {
      finishGame("Wykorzystaliście wszystkie dostępne pytania.");
      return;
    }
    closeQuestionPanel();
    elements.categoryStatus.textContent = "";
    elements.spinButton.disabled = false;
    updateGameDisplay();
    elements.spinButton.focus({ preventScroll: true });
  }

  function finishGame(reason) {
    const game = state.game;
    if (!game || game.finished) return;
    game.finished = true;
    elements.endGameButton.hidden = true;
    closeQuestionPanel();
    elements.wheelSection.hidden = true;
    elements.finishPanel.hidden = false;
    elements.finishTitle.textContent = "Gra zakończona";
    elements.finishReason.textContent = reason;
    const highestScore = Math.max.apply(null, game.players.map(function (player) { return player.score; }));
    const winners = game.players.filter(function (player) { return player.score === highestScore; });
    elements.winnerText.textContent = winners.length === 1
      ? "Wygrywa " + winners[0].name + "!"
      : "Remis: " + winners.map(function (player) { return player.name; }).join(" i ") + ".";
    const ranking = game.players.slice().sort(function (a, b) { return b.score - a.score; });
    elements.finalRanking.replaceChildren();
    ranking.forEach(function (player) {
      const row = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = player.name;
      const score = document.createElement("strong");
      score.textContent = player.score + " pkt";
      row.append(name, score);
      elements.finalRanking.append(row);
    });
    updateGameDisplay();
    elements.newGameButton.focus({ preventScroll: true });
  }

  function returnToSetup() {
    if (state.animationFrame !== null) {
      window.cancelAnimationFrame(state.animationFrame);
      state.animationFrame = null;
    }
    state.game = null;
    state.spinning = false;
    elements.gameView.hidden = true;
    elements.setupView.hidden = false;
    elements.endGameButton.hidden = true;
    closeQuestionPanel();
    elements.finishPanel.hidden = true;
    elements.wheelSection.hidden = false;
    elements.spinButton.disabled = false;
    elements.categoryStatus.textContent = "";
    refreshPoolDisplay();
  }

  function closeQuestionPanel() {
    closeAnswerFeedbackDialog();
    if (elements.questionPanel.open) elements.questionPanel.close();
  }

  function closeAnswerFeedbackDialog() {
    if (elements.answerFeedbackDialog.open) elements.answerFeedbackDialog.close();
  }

  function resetQuestionHistory() {
    if (!window.confirm("Wyzerować historię wykorzystanych pytań? Następna gra może wylosować je ponownie.")) return;
    state.usedIds.clear();
    try {
      window.localStorage.removeItem(USED_QUESTIONS_KEY);
      elements.storageNote.textContent = "Historia została wyzerowana. Wszystkie pytania są ponownie dostępne.";
    } catch (error) {
      elements.storageNote.textContent = "Nie można wyzerować historii w tej przeglądarce.";
    }
    elements.dataStatus.textContent = state.loaded ? "Pula pytań jest gotowa." : "Nie wczytano jeszcze pytań.";
    elements.dataStatus.removeAttribute("data-error");
    refreshPoolDisplay();
  }

  elements.playerCount.addEventListener("change", makePlayerFields);
  document.querySelectorAll('input[name="goalMode"]').forEach(function (input) { input.addEventListener("change", updateGoalFields); });
  elements.targetInput.addEventListener("input", function () {
    targetValues[activeGoalMode] = elements.targetInput.value;
  });
  elements.setupForm.addEventListener("submit", beginGame);
  elements.questionPanel.addEventListener("cancel", function (event) {
    event.preventDefault();
  });
  elements.answerFeedbackDialog.addEventListener("cancel", function (event) {
    event.preventDefault();
  });
  elements.spinButton.addEventListener("click", spinWheel);
  elements.answerResultContinue.addEventListener("click", continueAfterAnswer);
  elements.resetPoolButton.addEventListener("click", resetQuestionHistory);
  elements.newGameButton.addEventListener("click", returnToSetup);
  elements.endGameButton.addEventListener("click", function () {
    if (window.confirm("Zakończyć bieżącą grę? Wynik tej rozgrywki nie zostanie zapisany.")) returnToSetup();
  });

  makePlayerFields();
  drawWheel([], 0);
  loadQuestions();
}());

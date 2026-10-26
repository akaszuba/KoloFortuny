(function () {
  "use strict";

  const USED_QUESTIONS_KEY = "kolo-wiedzy-used-questions-v1";
  const TAU = Math.PI * 2;
  const colors = ["#1e7466", "#d99b45", "#426d86", "#cf6d55", "#708952", "#77618d", "#2d8580", "#c17b38", "#526477", "#9b7051"];
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
    turnHeading: document.getElementById("turn-heading"),
    goalPill: document.getElementById("goal-pill"),
    wheelSection: document.getElementById("wheel-section"),
    wheelTitle: document.getElementById("wheel-title"),
    wheelInstruction: document.getElementById("wheel-instruction"),
    wheelCanvas: document.getElementById("wheel-canvas"),
    spinButton: document.getElementById("spin-button"),
    categoryStatus: document.getElementById("category-status"),
    questionPanel: document.getElementById("question-panel"),
    questionCategory: document.getElementById("question-category"),
    questionProgress: document.getElementById("question-progress"),
    questionText: document.getElementById("question-text"),
    questionImage: document.getElementById("question-image"),
    answerList: document.getElementById("answer-list"),
    answerFeedback: document.getElementById("answer-feedback"),
    nextButton: document.getElementById("next-button"),
    finishPanel: document.getElementById("finish-panel"),
    finishTitle: document.getElementById("finish-title"),
    finishReason: document.getElementById("finish-reason"),
    winnerText: document.getElementById("winner-text"),
    finalRanking: document.getElementById("final-ranking"),
    newGameButton: document.getElementById("new-game-button"),
    scoreboard: document.getElementById("scoreboard"),
    availableCount: document.getElementById("available-count"),
    usedCount: document.getElementById("used-count"),
    usedProgress: document.getElementById("used-progress")
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

  function fallbackId(question) {
    const content = JSON.stringify([question.question, question.category, question.answers, question.correctIndex, question.image || ""]);
    let hash = 2166136261;
    for (let i = 0; i < content.length; i += 1) {
      hash ^= content.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return "q-" + (hash >>> 0).toString(16);
  }

  function isValidQuestion(question) {
    return question &&
      typeof question.question === "string" &&
      question.question.trim() &&
      typeof question.category === "string" &&
      question.category.trim() &&
      Array.isArray(question.answers) &&
      question.answers.length >= 2 &&
      question.answers.every(function (answer) { return typeof answer === "string"; }) &&
      Number.isInteger(question.correctIndex) &&
      question.correctIndex >= 0 &&
      question.correctIndex < question.answers.length;
  }

  function loadQuestions() {
    try {
      const parsed = window.QUESTIONS;
      if (!Array.isArray(parsed)) {
        throw new Error("Nie znaleziono tablicy pytań w questions.js.");
      }
      state.questions = parsed.filter(isValidQuestion).map(function (question) {
        return Object.assign({}, question, {
          id: typeof question.id === "string" && question.id ? question.id : fallbackId(question)
        });
      });
      if (!state.questions.length) {
        throw new Error("W pliku nie ma poprawnych pytań.");
      }

      state.loaded = true;
      const skipped = parsed.length - state.questions.length;
      elements.dataStatus.textContent = skipped
        ? "Pominięto " + skipped + " niepoprawnych wpisów w pliku pytań."
        : "Pula pytań jest gotowa.";
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
    return state.questions.filter(function (question) { return !state.usedIds.has(question.id); });
  }

  function getAvailableCategories() {
    const counts = new Map();
    getAvailableQuestions().forEach(function (question) {
      counts.set(question.category, (counts.get(question.category) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(function (entry) { return { name: entry[0], count: entry[1] }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, "pl"); });
  }

  function refreshPoolDisplay() {
    const total = state.questions.length;
    const available = getAvailableQuestions().length;
    const used = total - available;
    elements.poolSummary.textContent = total
      ? "Pozostało " + available + " z " + total + " pytań. Historia zapisuje się w tej przeglądarce."
      : "Wczytuję pulę pytań…";
    elements.availableCount.textContent = String(available);
    elements.usedCount.textContent = "Wykorzystano " + used + " z " + total + " pytań";
    elements.usedProgress.style.width = (total ? Math.round(used / total * 100) : 0) + "%";
    elements.startButton.disabled = !state.loaded || available === 0;
    if (state.loaded && available === 0) {
      elements.dataStatus.textContent = "Wykorzystano już całą pulę. Wyzeruj historię, aby zagrać ponownie.";
    }

    if (!state.game || (!state.game.finished && !state.spinning)) {
      state.categoriesOnWheel = getAvailableCategories();
      drawWheel(state.categoriesOnWheel, state.rotation);
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

  function drawWheel(categories, rotation) {
    const canvas = elements.wheelCanvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const center = canvas.width / 2;
    const radius = center - 21;
    const safeRotation = ((rotation % TAU) + TAU) % TAU;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!categories.length) {
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, TAU);
      ctx.fillStyle = "#e8e9e2";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(center, center, 72, 0, TAU);
      ctx.fillStyle = "#fffefa";
      ctx.fill();
      ctx.fillStyle = "#53616c";
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
      ctx.strokeStyle = "#fffefa";
      ctx.stroke();

      const labelRadius = radius * .66;
      ctx.save();
      ctx.translate(center + Math.cos(middle) * labelRadius, center + Math.sin(middle) * labelRadius);
      let textAngle = middle + Math.PI / 2;
      const uprightAngle = ((textAngle % TAU) + TAU) % TAU;
      if (uprightAngle > Math.PI / 2 && uprightAngle < Math.PI * 1.5) textAngle += Math.PI;
      ctx.rotate(textAngle);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fontSize = categories.length > 8 ? 14 : categories.length > 5 ? 15 : 17;
      ctx.font = "700 " + fontSize + "px sans-serif";
      const lines = wrapCategory(category.name, categories.length > 8 ? 10 : 14);
      lines.forEach(function (line, lineIndex) {
        const y = (lineIndex - (lines.length - 1) / 2) * (fontSize + 2);
        ctx.fillText(line, 0, y, radius * .58);
      });
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(center, center, 65, 0, TAU);
    ctx.fillStyle = "#fffefa";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#e4d8bf";
    ctx.stroke();
    ctx.fillStyle = "#233640";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 13px sans-serif";
    ctx.fillText("KOŁO", center, center - 7);
    ctx.fillStyle = "#1e7466";
    ctx.font = "700 11px sans-serif";
    ctx.fillText("WIEDZY", center, center + 12);
    canvas.setAttribute("aria-label", "Kategorie na kole: " + categories.map(function (category) { return category.name; }).join(", "));
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
      finished: false
    };
    elements.setupView.hidden = true;
    elements.gameView.hidden = false;
    elements.endGameButton.hidden = false;
    elements.questionPanel.hidden = true;
    elements.finishPanel.hidden = true;
    elements.wheelSection.hidden = false;
    elements.categoryStatus.textContent = "";
    elements.wheelTitle.textContent = "Czas na losowanie";
    elements.wheelInstruction.textContent = "Zakręćcie kołem, aby wylosować temat pytania.";
    elements.spinButton.disabled = false;
    state.categoriesOnWheel = getAvailableCategories();
    drawWheel(state.categoriesOnWheel, state.rotation);
    updateGameDisplay();
  }

  function updateGameDisplay() {
    if (!state.game) return;
    const game = state.game;
    const player = game.players[game.currentPlayer];
    elements.turnHeading.textContent = player.name + " — Twoja kolej";
    elements.goalPill.textContent = game.mode === "points"
      ? "Cel: " + game.target + " pkt"
      : "Runda " + game.round + " z " + game.target;
    elements.wheelTitle.textContent = "Teraz gra: " + player.name;
    elements.scoreboard.replaceChildren();
    game.players.forEach(function (person, index) {
      const row = document.createElement("li");
      row.className = "scoreboard-row" + (!game.finished && index === game.currentPlayer ? " active" : "");
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
    refreshPoolDisplay();
  }

  function spinWheel() {
    if (!state.game || state.game.finished || state.spinning || state.game.currentQuestion) return;
    const categories = getAvailableCategories();
    if (!categories.length) {
      finishGame("Wykorzystaliście wszystkie dostępne pytania.");
      return;
    }
    state.categoriesOnWheel = categories;
    drawWheel(categories, state.rotation);
    state.spinning = true;
    elements.spinButton.disabled = true;
    elements.categoryStatus.textContent = "Koło się kręci…";
    elements.wheelInstruction.textContent = "Za chwilę poznacie kategorię.";

    const selectedIndex = Math.floor(Math.random() * categories.length);
    const selectedCategory = categories[selectedIndex];
    const step = TAU / categories.length;
    const desiredRotation = ((-((selectedIndex + .5) * step) % TAU) + TAU) % TAU;
    const currentRotation = ((state.rotation % TAU) + TAU) % TAU;
    const delta = (desiredRotation - currentRotation + TAU) % TAU;
    const startRotation = state.rotation;
    const endRotation = startRotation + TAU * (5 + Math.floor(Math.random() * 3)) + delta;
    const startTime = performance.now();
    const duration = 4500;

    function animate(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      drawWheel(categories, startRotation + (endRotation - startRotation) * eased);
      if (progress < 1) {
        state.animationFrame = window.requestAnimationFrame(animate);
        return;
      }

      state.animationFrame = null;
      state.rotation = endRotation % TAU;
      drawWheel(categories, state.rotation);
      state.spinning = false;
      const questionsInCategory = getAvailableQuestions().filter(function (question) {
        return question.category === selectedCategory.name;
      });
      const question = questionsInCategory[Math.floor(Math.random() * questionsInCategory.length)];
      if (!question) {
        elements.categoryStatus.textContent = "W tej kategorii nie ma już pytań.";
        elements.spinButton.disabled = false;
        return;
      }
      elements.categoryStatus.textContent = "Wylosowana kategoria: " + selectedCategory.name;
      showQuestion(question);
    }
    window.requestAnimationFrame(animate);
  }

  function showQuestion(question) {
    state.game.currentQuestion = question;
    state.game.answerSubmitted = false;
    state.usedIds.add(question.id);
    persistUsedIds();
    refreshPoolDisplay();
    elements.questionCategory.textContent = question.category;
    elements.questionProgress.textContent = "Pytanie " + (state.game.answered + 1);
    elements.questionText.textContent = question.question;
    elements.answerList.replaceChildren();
    elements.answerFeedback.hidden = true;
    elements.answerFeedback.className = "answer-feedback";
    elements.answerFeedback.textContent = "";
    elements.nextButton.hidden = true;
    elements.questionImage.hidden = !question.image;
    elements.questionImage.removeAttribute("src");
    if (question.image) {
      elements.questionImage.alt = "Ilustracja do pytania";
      elements.questionImage.onerror = function () { elements.questionImage.hidden = true; };
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
    elements.questionPanel.hidden = false;
    elements.questionPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    if (isCorrect) game.players[game.currentPlayer].score += 1;

    Array.from(elements.answerList.querySelectorAll(".answer-option")).forEach(function (button, index) {
      button.disabled = true;
      if (index === question.correctIndex) button.classList.add("is-correct");
      else if (index === selectedIndex) button.classList.add("is-wrong");
    });

    const playerName = game.players[game.currentPlayer].name;
    elements.answerFeedback.hidden = false;
    elements.answerFeedback.classList.add(isCorrect ? "success" : "miss");
    elements.answerFeedback.textContent = isCorrect
      ? "Dobra odpowiedź! " + playerName + " zdobywa 1 punkt."
      : "To nie ta odpowiedź. Poprawna odpowiedź: " + question.answers[question.correctIndex] + ".";
    updateGameDisplay();

    if (game.mode === "points" && game.players[game.currentPlayer].score >= game.target) {
      finishGame(playerName + " osiąga cel " + game.target + " " + plural(game.target, "punkt", "punkty", "punktów") + ".");
      return;
    }
    if (game.mode === "rounds" && game.round === game.target && game.currentPlayer === game.players.length - 1) {
      finishGame("Każdy gracz rozegrał " + game.target + " " + plural(game.target, "rundę", "rundy", "rund") + ".");
      return;
    }

    const nextPlayerIndex = (game.currentPlayer + 1) % game.players.length;
    elements.nextButton.textContent = "Następna kolej: " + game.players[nextPlayerIndex].name;
    elements.nextButton.hidden = false;
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
    elements.questionPanel.hidden = true;
    elements.categoryStatus.textContent = "";
    elements.wheelInstruction.textContent = "Zakręćcie kołem, aby wylosować temat pytania.";
    elements.spinButton.disabled = false;
    state.categoriesOnWheel = getAvailableCategories();
    drawWheel(state.categoriesOnWheel, state.rotation);
    updateGameDisplay();
  }

  function finishGame(reason) {
    const game = state.game;
    if (!game || game.finished) return;
    game.finished = true;
    elements.endGameButton.hidden = true;
    elements.questionPanel.hidden = true;
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
    elements.finishPanel.scrollIntoView({ behavior: "smooth", block: "center" });
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
    elements.questionPanel.hidden = true;
    elements.finishPanel.hidden = true;
    elements.wheelSection.hidden = false;
    elements.spinButton.disabled = false;
    elements.categoryStatus.textContent = "";
    refreshPoolDisplay();
    window.scrollTo({ top: 0, behavior: "smooth" });
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
  elements.spinButton.addEventListener("click", spinWheel);
  elements.nextButton.addEventListener("click", nextTurn);
  elements.resetPoolButton.addEventListener("click", resetQuestionHistory);
  elements.newGameButton.addEventListener("click", returnToSetup);
  elements.endGameButton.addEventListener("click", function () {
    if (window.confirm("Zakończyć bieżącą grę? Wynik tej rozgrywki nie zostanie zapisany.")) returnToSetup();
  });

  makePlayerFields();
  drawWheel([], 0);
  loadQuestions();
}());

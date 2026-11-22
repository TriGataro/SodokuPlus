/**
 * ============================================================================
 * Proyecto: SodokuPlus
 * Archivo: JS/app.js
 * Descripción: Lógica de interfaz del Sudoku con selección de casillas vacías,
 *              símbolos intercambiables, temas de color, récords, deshacer,
 *              pistas, temporizador y validación automática.
 * Convenciones: Se siguen las pautas del proyecto (HTML5, Bootstrap, sin código
 *               inline y con comentarios explicativos).
 * ============================================================================
 */

import {
  DIFFICULTY_NAMES,
  SYMBOL_MODE_NAMES,
  SYMBOL_SETS,
  THEME_NAMES
} from "./config.js";
import { generateNewPuzzle, getDifficultyForEmptyCells } from "./sudoku-engine.js";

(() => {
  "use strict";

  /* ==========================================================================
   * 1. Estado Global de la Partida
   * ========================================================================== */

  const state = {
    currentDifficulty: "easy",   // Categoría de récord derivada de casillas vacías
    currentSymbolMode: "numbers", // Modo de símbolos activo ('numbers' | 'letters' | 'emojis')
    currentTheme: "light",       // Tema de color activo ('light' | 'dark' | 'sepia' | 'contrast')
    
    // Matrices numéricas 9x9 (0 representa celda vacía, 1-9 el valor lógico)
    solutionBoard: [],           // Solución completa calculada
    initialBoard:  [],           // Tablero inicial (celdas fijas inmutables)
    currentBoard:  [],           // Tablero de juego actual con jugadas del usuario
    
    selectedCell: { row: -1, col: -1 }, // Celda actualmente seleccionada
    history: [],                 // Pila de movimientos para la función Deshacer
    
    errorsCount: 0,              // Contador de errores cometidos
    hintsCount: 3,               // Cantidad de pistas disponibles
    emptyCells: 39,
    hasStarted: false,
    
    // Control del temporizador
    timerSeconds: 0,
    timerInterval: null,
    isPaused: false,
    isCompleted: false           // Bandera que indica si la partida finalizó
  };

  /* ==========================================================================
   * 2. Referencias al DOM (Document Object Model)
   * ========================================================================== */

  const DOM = {
    grid: document.getElementById("sudokuGrid"),
    emptyCellsSelect: document.getElementById("emptyCellsSelect"),
    emptyCellsValue: document.getElementById("emptyCellsValue"),
    setupSymbolSelect: document.getElementById("setupSymbolSelect"),
    currentEmptyCells: document.getElementById("currentEmptyCells"),
    btnConfirmGameSetup: document.getElementById("btnConfirmGameSetup"),
    gameSetupModalEl: document.getElementById("gameSetupModal"),
    timerDisplay: document.getElementById("timerDisplay"),
    btnPause: document.getElementById("btnPause"),
    btnPauseIcon: document.getElementById("btnPauseIcon"),
    pauseOverlay: document.getElementById("pauseOverlay"),
    btnResume: document.getElementById("btnResume"),
    errorsCount: document.getElementById("errorsCount"),
    hintsCount: document.getElementById("hintsCount"),
    keypadSymbolsRow: document.getElementById("keypadSymbolsRow"),
    btnErase: document.getElementById("btnErase"),
    btnHint: document.getElementById("btnHint"),
    btnUndo: document.getElementById("btnUndo"),
    btnCheck: document.getElementById("btnCheck"),
    btnNewGame: document.getElementById("btnNewGame"),
    btnRestartGame: document.getElementById("btnRestartGame"),
    btnModalPlayAgain: document.getElementById("btnModalPlayAgain"),
    btnShare: document.getElementById("btnShare"),
    menuNewGame: document.getElementById("menuNewGame"),
    menuRestart: document.getElementById("menuRestart"),
    menuPause: document.getElementById("menuPause"),
    menuRecords: document.getElementById("menuRecords"),
    symbolModeItems: document.querySelectorAll("[data-symbol-value]"),
    currentThemeLabel: document.getElementById("currentThemeLabel"),
    themeDropdownItems: document.querySelectorAll("[data-theme-value]"),
    
    currentSymbolLabel: document.getElementById("currentSymbolLabel"),
    
    // Modal de Victoria
    victoryModalEl: document.getElementById("victoryModal"),
    modalDifficultyText: document.getElementById("modalDifficultyText"),
    modalTimeText: document.getElementById("modalTimeText"),
    modalErrorsText: document.getElementById("modalErrorsText"),
    victoryRecordNotice: document.getElementById("victoryRecordNotice"),
    btnModalViewRecords: document.getElementById("btnModalViewRecords"),

    // Modal de Récords (Top 5)
    recordsModalEl: document.getElementById("recordsModal"),
    btnOpenRecords: document.getElementById("btnOpenRecords"),
    recordsFilterGroup: document.getElementById("recordsFilterGroup"),
    recordsTableContainer: document.getElementById("recordsTableContainer"),
    recordsTableBody: document.getElementById("recordsTableBody"),
    recordsEmptyState: document.getElementById("recordsEmptyState"),
    btnClearRecords: document.getElementById("btnClearRecords"),
    
    // Modal de Información
    infoModalEl: document.getElementById("infoModal"),
    infoModalTitle: document.getElementById("infoModalTitle"),
    infoModalBody: document.getElementById("infoModalBody"),
    infoModalIcon: document.getElementById("infoModalIcon")
  };

  // Instancias de Modales de Bootstrap
  let victoryModalInstance = null;
  let recordsModalInstance = null;
  let infoModalInstance = null;
  let gameSetupModalInstance = null;

  /* ==========================================================================
   * 3. Motor de Audio Simple (Web Audio API)
   *    Brinda feedback sonoro placentero sin necesidad de archivos externos.
   * ========================================================================== */

  let audioCtx = null;

  /**
   * Inicializa o reanuda el contexto de audio en la primera interacción.
   */
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  /**
   * Reproduce un tono sintetizado corto.
   * @param {number} freq Frecuencia en Hertz
   * @param {string} type Tipo de onda ('sine', 'triangle', etc.)
   * @param {number} duration Duración en segundos
   */
  function playBeep(freq, type = "sine", duration = 0.08) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {
      // Si el navegador bloquea audio sin interacción, se ignora silenciosamente
    }
  }

  /* ==========================================================================
   * 4. Renderizado de Interfaz y Celdas
   * ========================================================================== */

  /**
   * Inicializa la estructura del DOM para las 81 celdas del tablero.
   */
  function initGridDOM() {
    DOM.grid.innerHTML = "";
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement("div");
        cell.className = "sudoku-cell";
        cell.dataset.row = r.toString();
        cell.dataset.col = c.toString();
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("tabindex", "0");
        cell.setAttribute("aria-label", `Fila ${r + 1}, Columna ${c + 1}`);

        // Manejador de clic para seleccionar celda
        cell.addEventListener("click", () => {
          handleCellSelect(r, c);
        });

        DOM.grid.appendChild(cell);
      }
    }
  }

  /**
   * Obtiene el símbolo correspondiente según el modo activo.
   * @param {number} numericVal Valor entre 0 y 9
   * @returns {string} Símbolo visual (número, letra o emoji)
   */
  function getDisplaySymbol(numericVal) {
    if (!numericVal || numericVal < 1 || numericVal > 9) return "";
    const set = SYMBOL_SETS[state.currentSymbolMode] || SYMBOL_SETS.numbers;
    return set[numericVal] || "";
  }

  /**
   * Actualiza el teclado virtual de símbolos según el modo activo (1-9, A-I o Emojis).
   */
  function updateKeypadSymbols() {
    DOM.keypadSymbolsRow.innerHTML = "";
    const symbols = SYMBOL_SETS[state.currentSymbolMode];

    for (let i = 1; i <= 9; i++) {
      const colDiv = document.createElement("div");
      colDiv.className = "col";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn keypad-btn w-100 p-0 shadow-sm";
      if (["emojis", "animals"].includes(state.currentSymbolMode)) btn.classList.add("symbol-emoji");
      if (["japanese", "chinese"].includes(state.currentSymbolMode)) btn.classList.add("symbol-asian");
      btn.textContent = symbols[i];
      btn.title = `Ingresar ${symbols[i]}`;
      btn.setAttribute("aria-label", `Ingresar ${symbols[i]}`);

      // Evento de clic en el botón de símbolo
      btn.addEventListener("click", () => {
        handleInputNumber(i);
      });

      colDiv.appendChild(btn);
      DOM.keypadSymbolsRow.appendChild(colDiv);
    }
  }

  /**
   * Actualiza todo el tablero visualmente reflejando los valores,
   * estilos de pistas fijas, selecciones y resaltados.
   */
  function renderBoard() {
    const cells = DOM.grid.querySelectorAll(".sudoku-cell");
    const { row: selRow, col: selCol } = state.selectedCell;
    const selectedVal = (selRow >= 0 && selCol >= 0) ? state.currentBoard[selRow][selCol] : 0;

    cells.forEach(cell => {
      const r = parseInt(cell.dataset.row, 10);
      const c = parseInt(cell.dataset.col, 10);
      const val = state.currentBoard[r][c];
      const isFixed = state.initialBoard[r][c] !== 0;

      // Colocar el símbolo correspondiente
      cell.textContent = getDisplaySymbol(val);

      // Limpiar clases de estado previas
      cell.classList.remove(
        "cell-fixed",
        "cell-user",
        "cell-selected",
        "cell-related",
        "cell-same-val",
        "cell-error"
      );

      // Asignar clase fija o usuario
      if (val !== 0) {
        if (isFixed) {
          cell.classList.add("cell-fixed");
        } else {
          cell.classList.add("cell-user");
        }
      }

      // Si hay una celda seleccionada, aplicar resaltados relacionales
      if (selRow >= 0 && selCol >= 0) {
        const isSelected = (r === selRow && c === selCol);
        const inSameRow = (r === selRow);
        const inSameCol = (c === selCol);
        const inSameBox = (Math.floor(r / 3) === Math.floor(selRow / 3) &&
                           Math.floor(c / 3) === Math.floor(selCol / 3));

        if (isSelected) {
          cell.classList.add("cell-selected");
        } else if (inSameRow || inSameCol || inSameBox) {
          cell.classList.add("cell-related");
        }

        // Resaltar celdas que tengan el mismo valor
        if (selectedVal !== 0 && val === selectedVal && !isSelected) {
          cell.classList.add("cell-same-val");
        }
      }
    });

    // Actualizar badges de métricas en la interfaz
    DOM.errorsCount.textContent = state.errorsCount.toString();
    DOM.hintsCount.textContent = state.hintsCount.toString();
  }

  /* ==========================================================================
   * 5. Interacciones del Jugador
   * ========================================================================== */

  /**
   * Maneja la selección de una celda del tablero.
   * @param {number} row Fila seleccionada
   * @param {number} col Columna seleccionada
   */
  function handleCellSelect(row, col) {
    if (!state.hasStarted || state.isPaused || state.isCompleted) return;
    state.selectedCell = { row, col };
    playBeep(440, "sine", 0.04);
    renderBoard();
  }

  /**
   * Introduce un valor (1 a 9) en la celda seleccionada.
   * @param {number} val Valor numérico lógico (1 a 9)
   */
  function handleInputNumber(val) {
    if (!state.hasStarted || state.isPaused || state.isCompleted) return;
    const { row, col } = state.selectedCell;

    // Verificar si hay una celda seleccionada y si no es una celda fija original
    if (row < 0 || col < 0) {
      showInfoModal("Atención", "Por favor, selecciona primero una celda del tablero.", "bi-hand-index-thumb");
      return;
    }

    if (state.initialBoard[row][col] !== 0) {
      playBeep(220, "sawtooth", 0.1);
      return; // Las celdas fijas no pueden modificarse
    }

    const previousValue = state.currentBoard[row][col];
    if (previousValue === val) return; // Mismo valor, sin cambios

    // Guardar en el historial para permitir Deshacer
    state.history.push({
      row,
      col,
      prev: previousValue,
      next: val
    });

    // Asignar el nuevo valor
    state.currentBoard[row][col] = val;

    // Verificar si el valor ingresado es un error comparado con la solución
    const isCorrect = (val === state.solutionBoard[row][col]);
    const cellEl = DOM.grid.querySelector(`.sudoku-cell[data-row="${row}"][data-col="${col}"]`);

    if (!isCorrect) {
      state.errorsCount++;
      playBeep(200, "sawtooth", 0.16);
      if (cellEl) {
        cellEl.classList.add("cell-error");
        setTimeout(() => cellEl.classList.remove("cell-error"), 600);
      }
    } else {
      playBeep(587.33, "triangle", 0.08); // Nota armónica (Re5)
      if (cellEl) {
        cellEl.classList.add("cell-pop");
        setTimeout(() => cellEl.classList.remove("cell-pop"), 200);
      }
    }

    renderBoard();

    // Comprobar si el juego ha sido completado
    checkGameCompletion();
  }

  /**
   * Borra el contenido de la celda actualmente seleccionada.
   */
  function handleErase() {
    if (!state.hasStarted || state.isPaused || state.isCompleted) return;
    const { row, col } = state.selectedCell;

    if (row < 0 || col < 0) return;
    if (state.initialBoard[row][col] !== 0) return; // No borrar pistas fijas

    const previousValue = state.currentBoard[row][col];
    if (previousValue === 0) return;

    state.history.push({
      row,
      col,
      prev: previousValue,
      next: 0
    });

    state.currentBoard[row][col] = 0;
    playBeep(330, "sine", 0.06);
    renderBoard();
  }

  /**
   * Deshace el último movimiento realizado por el jugador.
   */
  function handleUndo() {
    if (!state.hasStarted || state.isPaused || state.isCompleted || state.history.length === 0) return;

    const lastAction = state.history.pop();
    state.currentBoard[lastAction.row][lastAction.col] = lastAction.prev;
    state.selectedCell = { row: lastAction.row, col: lastAction.col };

    playBeep(392, "sine", 0.06);
    renderBoard();
  }

  /**
   * Otorga una pista colocando el valor correcto en la celda seleccionada
   * o en la primera celda vacía/errónea encontrada.
   */
  function handleHint() {
    if (!state.hasStarted || state.isPaused || state.isCompleted) return;

    if (state.hintsCount <= 0) {
      showInfoModal("Sin pistas", "Ya has utilizado todas las pistas disponibles en esta partida.", "bi-lightbulb-off");
      return;
    }

    let targetRow = state.selectedCell.row;
    let targetCol = state.selectedCell.col;

    // Si la celda seleccionada ya tiene el valor correcto o es fija, buscar una celda vacía o incorrecta
    const currentSelectedCorrect = (targetRow >= 0 && targetCol >= 0 &&
      state.currentBoard[targetRow][targetCol] === state.solutionBoard[targetRow][targetCol]);

    if (targetRow < 0 || targetCol < 0 || currentSelectedCorrect) {
      let found = false;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (state.currentBoard[r][c] !== state.solutionBoard[r][c]) {
            targetRow = r;
            targetCol = c;
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        checkGameCompletion();
        return;
      }
    }

    // Aplicar la pista
    const correctVal = state.solutionBoard[targetRow][targetCol];
    state.hintsCount--;
    state.selectedCell = { row: targetRow, col: targetCol };

    state.history.push({
      row: targetRow,
      col: targetCol,
      prev: state.currentBoard[targetRow][targetCol],
      next: correctVal
    });

    state.currentBoard[targetRow][targetCol] = correctVal;

    playBeep(880, "triangle", 0.15); // Tono de pista (La5)
    renderBoard();

    // Animación de pop en la celda revelada
    const cellEl = DOM.grid.querySelector(`.sudoku-cell[data-row="${targetRow}"][data-col="${targetCol}"]`);
    if (cellEl) {
      cellEl.classList.add("cell-pop");
      setTimeout(() => cellEl.classList.remove("cell-pop"), 200);
    }

    checkGameCompletion();
  }

  /**
   * Verifica el estado actual del tablero y resalta visualmente cualquier inconsistencia.
   */
  function handleCheckBoard() {
    if (!state.hasStarted || state.isPaused || state.isCompleted) return;

    let conflicts = 0;
    let emptyCells = 0;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = state.currentBoard[r][c];
        if (val === 0) {
          emptyCells++;
        } else if (val !== state.solutionBoard[r][c]) {
          conflicts++;
          const cellEl = DOM.grid.querySelector(`.sudoku-cell[data-row="${r}"][data-col="${c}"]`);
          if (cellEl) {
            cellEl.classList.add("cell-error");
            setTimeout(() => cellEl.classList.remove("cell-error"), 800);
          }
        }
      }
    }

    if (conflicts === 0 && emptyCells === 0) {
      checkGameCompletion();
    } else if (conflicts === 0) {
      playBeep(659.25, "sine", 0.12);
      showInfoModal("¡Vas por buen camino!", `No hay números incorrectos hasta el momento. Te quedan ${emptyCells} celdas por completar.`, "bi-check-circle-fill");
    } else {
      playBeep(220, "sawtooth", 0.2);
      showInfoModal("Inconsistencias encontradas", `Se encontraron ${conflicts} celdas con valores erróneos (resaltadas en rojo).`, "bi-exclamation-triangle-fill");
    }
  }

  /**
   * Comprueba si el tablero fue resuelto satisfactoriamente.
   */
  function checkGameCompletion() {
    if (!state.hasStarted) return false;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.currentBoard[r][c] !== state.solutionBoard[r][c]) {
          return false;
        }
      }
    }

    // Partida completada con éxito
    state.isCompleted = true;
    stopTimer();

    // Fanfarria de victoria con tonos ascendentes
    setTimeout(() => playBeep(523.25, "triangle", 0.15), 0);   // Do5
    setTimeout(() => playBeep(659.25, "triangle", 0.15), 150); // Mi5
    setTimeout(() => playBeep(783.99, "triangle", 0.15), 300); // Sol5
    setTimeout(() => playBeep(1046.50, "triangle", 0.3), 450); // Do6

    // Rellenar datos en el modal de victoria
    DOM.modalDifficultyText.textContent = DIFFICULTY_NAMES[state.currentDifficulty] || state.currentDifficulty;
    DOM.modalTimeText.textContent = formatTime(state.timerSeconds);
    DOM.modalErrorsText.textContent = state.errorsCount.toString();

    // Guardar partida en el historial de récords con fecha y verificar si clasifica en el Top 5
    const isTop5 = saveNewRecord(state.currentDifficulty, state.timerSeconds, state.errorsCount);
    if (isTop5 && DOM.victoryRecordNotice) {
      DOM.victoryRecordNotice.classList.remove("d-none");
    } else if (DOM.victoryRecordNotice) {
      DOM.victoryRecordNotice.classList.add("d-none");
    }

    // Mostrar el modal de victoria
    if (!victoryModalInstance && window.bootstrap) {
      victoryModalInstance = new window.bootstrap.Modal(DOM.victoryModalEl);
    }
    if (victoryModalInstance) {
      victoryModalInstance.show();
    }

    return true;
  }

  /* ==========================================================================
   * 6. Gestión y Persistencia de los Top 5 Mejores Récords con Fecha
   * ========================================================================== */

  const STORAGE_KEY_RECORDS = "sodoku_plus_records";
  let currentRecordsFilter = "all";

  /**
   * Obtiene la lista completa de récords guardados desde el almacenamiento local.
   * @returns {Array<Object>} Arreglo con los registros de partidas resueltas
   */
  function getStoredRecords() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_RECORDS);
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  /**
   * Registra una partida completada con su tiempo, dificultad, errores y fecha actual.
   * Determina además si el resultado entra en el Top 5 de su categoría.
   * @param {string} difficulty Dificultad de la partida
   * @param {number} timeSeconds Tiempo en segundos transcurrido
   * @param {number} errors Cantidad de errores cometidos
   * @returns {boolean} True si entró en el Top 5
   */
  function saveNewRecord(difficulty, timeSeconds, errors) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    const dateFormatted = `${day}/${month}/${year} ${hours}:${mins}`;

    const newRecord = {
      id: "rec_" + Date.now(),
      difficulty,
      difficultyName: DIFFICULTY_NAMES[difficulty] || difficulty,
      timeSeconds,
      timeFormatted: formatTime(timeSeconds),
      errors,
      date: dateFormatted,
      timestamp: Date.now()
    };

    const records = getStoredRecords();
    records.push(newRecord);

    try {
      localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
    } catch (_) {
      // Manejo seguro en caso de cuota excedida o modo privado
    }

    // Comprobar si quedó entre los mejores 5 de su dificultad
    const sameDiffRecords = records
      .filter(r => r.difficulty === difficulty)
      .sort((a, b) => a.timeSeconds - b.timeSeconds || a.errors - b.errors);

    const rankInDiff = sameDiffRecords.findIndex(r => r.id === newRecord.id);
    return rankInDiff >= 0 && rankInDiff < 5;
  }

  /**
   * Obtiene los 5 mejores récords filtrados opcionalmente por nivel de dificultad.
   * Criterio: Menor tiempo primero, menor número de errores como desempate.
   * @param {string} filter 'all' | 'very-easy' | 'easy' | 'medium' | 'hard'
   * @returns {Array<Object>} Arreglo con hasta 5 mejores récords
   */
  function getTop5Records(filter = "all") {
    let records = getStoredRecords();
    if (filter !== "all") {
      records = records.filter(r => r.difficulty === filter);
    }

    records.sort((a, b) => {
      if (a.timeSeconds !== b.timeSeconds) return a.timeSeconds - b.timeSeconds;
      if (a.errors !== b.errors) return a.errors - b.errors;
      return b.timestamp - a.timestamp;
    });

    return records.slice(0, 5);
  }

  /**
   * Renderiza la tabla de los 5 mejores récords en el modal correspondiente.
   * @param {string} filter Filtro de dificultad activo
   */
  function renderRecordsModal(filter = "all") {
    currentRecordsFilter = filter;
    const top5 = getTop5Records(filter);
    DOM.recordsTableBody.innerHTML = "";

    if (top5.length === 0) {
      DOM.recordsTableContainer.classList.add("d-none");
      DOM.recordsEmptyState.classList.remove("d-none");
      return;
    }

    DOM.recordsTableContainer.classList.remove("d-none");
    DOM.recordsEmptyState.classList.add("d-none");

    top5.forEach((rec, index) => {
      const rank = index + 1;
      let badgeClass = "badge-rank-other";
      if (rank === 1) badgeClass = "badge-rank-1";
      else if (rank === 2) badgeClass = "badge-rank-2";
      else if (rank === 3) badgeClass = "badge-rank-3";

      const tr = document.createElement("tr");

      // Columna de Posición con Medalla/Insignia
      const tdRank = document.createElement("td");
      tdRank.className = "text-center";
      const spanRank = document.createElement("span");
      spanRank.className = `badge-rank ${badgeClass}`;
      spanRank.textContent = rank.toString();
      tdRank.appendChild(spanRank);

      // Columna de Dificultad
      const tdDiff = document.createElement("td");
      const spanDiff = document.createElement("span");
      spanDiff.className = "badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle";
      spanDiff.textContent = rec.difficultyName;
      tdDiff.appendChild(spanDiff);

      // Columna de Tiempo
      const tdTime = document.createElement("td");
      tdTime.className = "text-center font-monospace fw-bold text-primary";
      tdTime.innerHTML = `<i class="bi bi-stopwatch me-1"></i>${rec.timeFormatted}`;

      // Columna de Errores
      const tdErrors = document.createElement("td");
      tdErrors.className = "text-center";
      const spanErrors = document.createElement("span");
      spanErrors.className = `badge ${rec.errors === 0 ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`;
      spanErrors.textContent = `${rec.errors} error${rec.errors === 1 ? "" : "es"}`;
      tdErrors.appendChild(spanErrors);

      // Columna de Fecha y Hora
      const tdDate = document.createElement("td");
      tdDate.className = "text-end small text-secondary";
      tdDate.innerHTML = `<i class="bi bi-calendar3 me-1"></i>${rec.date}`;

      tr.appendChild(tdRank);
      tr.appendChild(tdDiff);
      tr.appendChild(tdTime);
      tr.appendChild(tdErrors);
      tr.appendChild(tdDate);

      DOM.recordsTableBody.appendChild(tr);
    });
  }

  /**
   * Activa visualmente el botón de filtro en el modal de récords y actualiza la lista.
   * @param {string} filter Valor del filtro de dificultad
   */
  function setActiveRecordsFilter(filter) {
    currentRecordsFilter = filter;
    const filterButtons = DOM.recordsFilterGroup.querySelectorAll("button");
    filterButtons.forEach(btn => {
      if (btn.dataset.recordsFilter === filter) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    renderRecordsModal(filter);
  }

  /**
   * Elimina todos los récords almacenados tras confirmación del usuario.
   */
  function handleClearRecords() {
    if (getStoredRecords().length === 0) {
      showInfoModal("Aviso", "No hay récords guardados para borrar.", "bi-info-circle");
      return;
    }

    if (window.confirm("¿Estás seguro de que deseas eliminar los récords guardados? Esta acción no se puede deshacer.")) {
      try {
        localStorage.removeItem(STORAGE_KEY_RECORDS);
      } catch (_) {}
      renderRecordsModal(currentRecordsFilter);
      showInfoModal("Récords eliminados", "Se ha restablecido la lista de los mejores tiempos.", "bi-trash3-fill");
    }
  }

  /* ==========================================================================
   * 7. Temporizador y Control de Pausa
   * ========================================================================== */

  /**
   * Da formato a una cantidad de segundos en formato MM:SS.
   * @param {number} totalSeconds Segundos transcurridos
   * @returns {string} Tiempo en formato '00:00'
   */
  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const formattedMins = mins.toString().padStart(2, "0");
    const formattedSecs = secs.toString().padStart(2, "0");
    return `${formattedMins}:${formattedSecs}`;
  }

  /**
   * Inicia el temporizador de la partida.
   */
  function startTimer() {
    stopTimer();
    state.timerSeconds = 0;
    renderTimer();
    state.timerInterval = setInterval(() => {
      if (!state.isPaused && !state.isCompleted) {
        state.timerSeconds++;
        renderTimer();
      }
    }, 1000);
  }

  function renderTimer() {
    DOM.timerDisplay.textContent = formatTime(state.timerSeconds);
  }

  /**
   * Detiene el temporizador.
   */
  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  /**
   * Alterna entre pausar y reanudar la partida.
   */
  function togglePause() {
    if (!state.hasStarted || state.isCompleted) return;
    state.isPaused = !state.isPaused;

    if (state.isPaused) {
      DOM.pauseOverlay.classList.remove("d-none");
      DOM.btnPauseIcon.className = "bi bi-play-fill";
      DOM.btnPause.title = "Reanudar partida";
    } else {
      DOM.pauseOverlay.classList.add("d-none");
      DOM.btnPauseIcon.className = "bi bi-pause-fill";
      DOM.btnPause.title = "Pausar partida";
    }
  }

  /* ==========================================================================
   * 8. Cambio de Temas de Color y Variantes de Símbolos
   * ========================================================================== */

  /**
   * Cambia el tema de color visual en la etiqueta raíz html.
   * @param {string} themeName 'light' | 'dark' | 'sepia' | 'contrast'
   */
  function setTheme(themeName) {
    if (!THEME_NAMES[themeName]) return;
    state.currentTheme = themeName;
    document.documentElement.setAttribute("data-theme", themeName);
    DOM.currentThemeLabel.textContent = THEME_NAMES[themeName];
    try {
      localStorage.setItem("sodoku_plus_theme", themeName);
    } catch (_) {
      // Manejo seguro ante restricciones de almacenamiento
    }
  }

  /**
   * Cambia el conjunto de símbolos activo (números, letras o emojis).
   * Actualiza la configuración, el teclado virtual y el tablero.
   * Guarda la preferencia en localStorage según las reglas 9 y 11 del proyecto.
   * @param {string} mode 'numbers' | 'letters' | 'emojis'
   */
  function setSymbolMode(mode) {
    if (!SYMBOL_SETS[mode]) return;
    state.currentSymbolMode = mode;

    const info = SYMBOL_MODE_NAMES[mode] || SYMBOL_MODE_NAMES.numbers;
    if (DOM.currentSymbolLabel) {
      DOM.currentSymbolLabel.textContent = info.label;
    }
    if (DOM.setupSymbolSelect) {
      DOM.setupSymbolSelect.value = mode;
    }

    // Persistir preferencia en localStorage
    try {
      localStorage.setItem("sodoku_plus_symbol_mode", mode);
    } catch (_) {
      // Manejo seguro ante restricciones de almacenamiento
    }

    updateKeypadSymbols();
    renderBoard();
  }

  /* ==========================================================================
   * 9. Gestión de Partidas (Nuevo Juego y Reiniciar)
   * ========================================================================== */

  /**
   * Inicia una partida con la cantidad de casillas vacías y el tipo de fichas elegidos.
   */
  function startNewGame() {
    state.emptyCells = Math.min(54, Math.max(20, Number(DOM.emptyCellsSelect.value)));
    state.currentDifficulty = getDifficultyForEmptyCells(state.emptyCells);
    state.hasStarted = true;
    DOM.currentEmptyCells.textContent = state.emptyCells.toString();
    const { solution, puzzle } = generateNewPuzzle(state.emptyCells);

    state.solutionBoard = solution;
    state.initialBoard = puzzle.map(r => [...r]);
    state.currentBoard = puzzle.map(r => [...r]);

    state.selectedCell = { row: -1, col: -1 };
    state.history = [];
    state.errorsCount = 0;
    state.hintsCount = 3;
    state.isPaused = false;
    state.isCompleted = false;

    // Ocultar overlay de pausa si estuviera activo
    DOM.pauseOverlay.classList.add("d-none");
    DOM.btnPauseIcon.className = "bi bi-pause-fill";
    DOM.btnPause.title = "Pausar partida";

    // Reiniciar y arrancar el reloj
    startTimer();

    // Actualizar vista
    renderBoard();
  }

  /**
   * Reinicia la partida actual con el mismo tablero inicial, limpiando movimientos del jugador.
   */
  function restartCurrentGame() {
    if (!state.hasStarted) return;
    state.currentBoard = state.initialBoard.map(r => [...r]);
    state.selectedCell = { row: -1, col: -1 };
    state.history = [];
    state.errorsCount = 0;
    state.isPaused = false;
    state.isCompleted = false;

    DOM.pauseOverlay.classList.add("d-none");
    DOM.btnPauseIcon.className = "bi bi-pause-fill";

    startTimer();
    renderBoard();
    showInfoModal("Partida Reiniciada", "El tablero se ha restaurado al estado original de la partida.", "bi-arrow-repeat");
  }

  function openGameSetupModal() {
    DOM.setupSymbolSelect.value = state.currentSymbolMode;
    DOM.emptyCellsSelect.value = state.emptyCells.toString();
    DOM.emptyCellsValue.textContent = state.emptyCells.toString();

    if (state.hasStarted && !state.isCompleted) {
      state.isPaused = true;
    }

    if (!gameSetupModalInstance && window.bootstrap) {
      gameSetupModalInstance = new window.bootstrap.Modal(DOM.gameSetupModalEl);
    }
    if (gameSetupModalInstance) {
      gameSetupModalInstance.show();
    } else {
      window.alert("No se pudo abrir la configuración de la partida. Recarga la página e inténtalo de nuevo.");
    }
  }

  function confirmGameSetup() {
    const emptyCells = Number(DOM.emptyCellsSelect.value);
    const symbolMode = DOM.setupSymbolSelect.value;
    if (!Number.isInteger(emptyCells) || emptyCells < 20 || emptyCells > 54 || !SYMBOL_SETS[symbolMode]) {
      showInfoModal("Configuración inválida", "Elige entre 20 y 54 casillas vacías y selecciona un tipo de fichas válido.", "bi-exclamation-triangle-fill");
      return;
    }

    startNewGame();
    setSymbolMode(symbolMode);
    gameSetupModalInstance.hide();
  }

  /**
   * Muestra el modal genérico de información.
   * @param {string} title Título del modal
   * @param {string} message Mensaje a mostrar
   * @param {string} iconClass Clase de Bootstrap Icon (ej: 'bi-info-circle-fill')
   */
  function showInfoModal(title, message, iconClass = "bi-info-circle-fill") {
    DOM.infoModalTitle.textContent = title;
    DOM.infoModalBody.textContent = message;
    DOM.infoModalIcon.innerHTML = `<i class="bi ${iconClass}"></i>`;

    if (!infoModalInstance && window.bootstrap) {
      infoModalInstance = new window.bootstrap.Modal(DOM.infoModalEl);
    }
    if (infoModalInstance) {
      infoModalInstance.show();
    }
  }

  function moveSelectedCell(direction) {
    if (state.isPaused || state.isCompleted) return;
    let { row, col } = state.selectedCell;
    if (row < 0 || col < 0) {
      row = 0;
      col = 0;
    } else {
      if (direction === "up") row = Math.max(0, row - 1);
      if (direction === "down") row = Math.min(8, row + 1);
      if (direction === "left") col = Math.max(0, col - 1);
      if (direction === "right") col = Math.min(8, col + 1);
    }
    handleCellSelect(row, col);
  }

  async function shareGame() {
    const shareData = {
      title: "SodokuPlus",
      text: `Estoy jugando SodokuPlus en nivel ${DIFFICULTY_NAMES[state.currentDifficulty]}.`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        showInfoModal("Enlace copiado", "El enlace del juego se copió al portapapeles.", "bi-share");
      } else {
        showInfoModal("Compartir", shareData.url, "bi-share");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        showInfoModal("No se pudo compartir", "Abre el menú de tu navegador para copiar o compartir la página.", "bi-share");
      }
    }
  }

  let lastGamepadDirection = "";
  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find(Boolean);
    if (!pad) return;

    const axes = pad.axes || [];
    const buttons = pad.buttons || [];
    let direction = "";
    if (axes[1] < -0.5 || buttons[12]?.pressed) direction = "up";
    else if (axes[1] > 0.5 || buttons[13]?.pressed) direction = "down";
    else if (axes[0] < -0.5 || buttons[14]?.pressed) direction = "left";
    else if (axes[0] > 0.5 || buttons[15]?.pressed) direction = "right";

    if (direction && direction !== lastGamepadDirection) {
      moveSelectedCell(direction);
    }
    lastGamepadDirection = direction;
  }

  /* ==========================================================================
   * 10. Manejo de Eventos de Teclado
   * ========================================================================== */

  /**
   * Captura pulsaciones de teclado físico para permitir jugar cómodamente.
   * @param {KeyboardEvent} e Evento de teclado
   */
  function handleKeyDown(e) {
    if (state.isPaused || state.isCompleted) return;

    const key = e.key.toLowerCase();

    // Atajo para Deshacer: Ctrl + Z
    if (e.ctrlKey && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      handleUndo();
      return;
    }

    // Teclas de dirección para moverse por el tablero
    let { row, col } = state.selectedCell;
    const arrowOrWasd = {
      ArrowUp: "up", w: "up",
      ArrowDown: "down", s: "down",
      ArrowLeft: "left", a: "left",
      ArrowRight: "right", d: "right"
    };
    if (arrowOrWasd[e.key] || arrowOrWasd[key]) {
      e.preventDefault();
      const direction = arrowOrWasd[e.key] || arrowOrWasd[key];
      if (row === -1 || col === -1) {
        row = 0;
        col = 0;
      } else {
        if (direction === "up")    row = Math.max(0, row - 1);
        if (direction === "down")  row = Math.min(8, row + 1);
        if (direction === "left")  col = Math.max(0, col - 1);
        if (direction === "right") col = Math.min(8, col + 1);
      }
      handleCellSelect(row, col);
      return;
    }

    // Borrado: Backspace o Delete / Supr
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      handleErase();
      return;
    }

    // Entrada de dígitos 1 a 9
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      const num = parseInt(e.key, 10);
      handleInputNumber(num);
      return;
    }

    // Entrada de letras A a I (independiente de mayúsculas/minúsculas)
    if (/^[a-iA-I]$/.test(e.key)) {
      e.preventDefault();
      const code = e.key.toUpperCase().charCodeAt(0);
      const numFromLetter = code - 64; // 'A' es 65 => 1, 'B' es 66 => 2, etc.
      if (numFromLetter >= 1 && numFromLetter <= 9) {
        handleInputNumber(numFromLetter);
      }
    }
  }

  /* ==========================================================================
   * 11. Vinculación de Event Listeners e Inicialización
   * ========================================================================== */

  /**
   * Registra todos los escuchadores de eventos requeridos por la interfaz.
   */
  function setupEventListeners() {
    DOM.emptyCellsSelect.addEventListener("input", () => {
      DOM.emptyCellsValue.textContent = DOM.emptyCellsSelect.value;
    });
    DOM.btnConfirmGameSetup.addEventListener("click", confirmGameSetup);
    DOM.gameSetupModalEl.addEventListener("hidden.bs.modal", () => {
      if (state.hasStarted && !state.isCompleted) {
        state.isPaused = false;
        DOM.pauseOverlay.classList.add("d-none");
        DOM.btnPauseIcon.className = "bi bi-pause-fill";
        DOM.btnPause.title = "Pausar partida";
      }
    });
    DOM.gameSetupModalEl.addEventListener("hide.bs.modal", () => {
      if (DOM.gameSetupModalEl.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    });

    // Botones de acción principales
    DOM.btnNewGame.addEventListener("click", openGameSetupModal);
    DOM.btnRestartGame.addEventListener("click", restartCurrentGame);
    DOM.btnPause.addEventListener("click", togglePause);
    DOM.btnResume.addEventListener("click", togglePause);

    // Botones de acción de jugada
    DOM.btnErase.addEventListener("click", handleErase);
    DOM.btnHint.addEventListener("click", handleHint);
    DOM.btnUndo.addEventListener("click", handleUndo);
    DOM.btnCheck.addEventListener("click", handleCheckBoard);

    // Botón jugar de nuevo dentro del modal de victoria
    DOM.btnModalPlayAgain.addEventListener("click", () => {
      if (victoryModalInstance) {
        DOM.victoryModalEl.addEventListener("hidden.bs.modal", openGameSetupModal, { once: true });
        victoryModalInstance.hide();
      } else {
        openGameSetupModal();
      }
    });

    // Botón para ver récords desde el modal de victoria
    if (DOM.btnModalViewRecords) {
      DOM.btnModalViewRecords.addEventListener("click", () => {
        if (victoryModalInstance) {
          victoryModalInstance.hide();
        }
        if (!recordsModalInstance && window.bootstrap) {
          recordsModalInstance = new window.bootstrap.Modal(DOM.recordsModalEl);
        }
        setActiveRecordsFilter(state.currentDifficulty);
        if (recordsModalInstance) {
          recordsModalInstance.show();
        }
      });
    }

    // Botón de Top 5 Récords en la barra superior
    if (DOM.btnOpenRecords) {
      DOM.btnOpenRecords.addEventListener("click", () => {
        setActiveRecordsFilter(currentRecordsFilter);
      });
    }

    // Filtros de dificultad dentro del modal de récords
    if (DOM.recordsFilterGroup) {
      DOM.recordsFilterGroup.addEventListener("click", (e) => {
        const targetBtn = e.target.closest("[data-records-filter]");
        if (targetBtn) {
          setActiveRecordsFilter(targetBtn.dataset.recordsFilter);
        }
      });
    }

    // Botón para borrar el historial de récords
    if (DOM.btnClearRecords) {
      DOM.btnClearRecords.addEventListener("click", handleClearRecords);
    }

    // Selector de temas de color (Dropdown)
    DOM.themeDropdownItems.forEach(item => {
      item.addEventListener("click", () => {
        const themeValue = item.dataset.themeValue;
        setTheme(themeValue);
      });
    });

    DOM.symbolModeItems.forEach(item => {
      item.addEventListener("click", () => {
        setSymbolMode(item.dataset.symbolValue);
      });
    });

    if (DOM.btnShare) {
      DOM.btnShare.addEventListener("click", shareGame);
    }

    if (DOM.menuNewGame) {
      DOM.menuNewGame.addEventListener("click", openGameSetupModal);
    }
    if (DOM.menuRestart) {
      DOM.menuRestart.addEventListener("click", restartCurrentGame);
    }
    if (DOM.menuPause) {
      DOM.menuPause.addEventListener("click", togglePause);
    }
    if (DOM.menuRecords) {
      DOM.menuRecords.addEventListener("click", () => {
        setActiveRecordsFilter(currentRecordsFilter);
        if (!recordsModalInstance && window.bootstrap) {
          recordsModalInstance = new window.bootstrap.Modal(DOM.recordsModalEl);
        }
        if (recordsModalInstance) recordsModalInstance.show();
      });
    }

    document.addEventListener("contextmenu", (event) => event.preventDefault());
    document.addEventListener("copy", (event) => event.preventDefault());
    document.addEventListener("cut", (event) => event.preventDefault());
    document.addEventListener("paste", (event) => event.preventDefault());
    document.addEventListener("selectstart", (event) => event.preventDefault());

    // Eventos globales de teclado
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("gamepadconnected", () => {
      showInfoModal("Joystick conectado", "Se detectó un mando compatible. Puedes mover la selección con la cruceta o el stick.", "bi-controller");
    });
    setInterval(pollGamepad, 150);
  }

  /**
   * Inicialización global de la aplicación al cargar el DOM.
   */
  function initApp() {
    // Cargar tema guardado en localStorage si existe (Reglas 9 y 11)
    try {
      const savedTheme = localStorage.getItem("sodoku_plus_theme");
      if (savedTheme && THEME_NAMES[savedTheme]) {
        setTheme(savedTheme);
      } else {
        setTheme("light");
      }
    } catch (_) {
      setTheme("light");
    }

    // Cargar modo de símbolos guardado en localStorage si existe (Reglas 9 y 11)
    try {
      const savedSymbolMode = localStorage.getItem("sodoku_plus_symbol_mode");
      if (savedSymbolMode && SYMBOL_SETS[savedSymbolMode]) {
        setSymbolMode(savedSymbolMode);
      } else {
        setSymbolMode("numbers");
      }
    } catch (_) {
      setSymbolMode("numbers");
    }

    // Inicializar rejilla DOM y teclado de símbolos
    initGridDOM();
    updateKeypadSymbols();

    // Configurar manejadores de eventos
    setupEventListeners();

    // Solicitar la configuración antes de iniciar la primera partida
    openGameSetupModal();
  }

  // Ejecutar cuando el DOM esté listo
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }

})();

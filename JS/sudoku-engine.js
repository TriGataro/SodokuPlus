import { DIFFICULTY_EMPTY_CELLS } from "./config.js";

function createEmptyMatrix() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function isValidPlacement(board, row, col, value) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === value || board[i][col] === value) return false;
  }

  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (board[startRow + r][startCol + c] === value) return false;
    }
  }

  return true;
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function solveSudokuRandomized(board) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] !== 0) continue;

      for (const value of shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if (!isValidPlacement(board, row, col, value)) continue;
        board[row][col] = value;
        if (solveSudokuRandomized(board)) return true;
        board[row][col] = 0;
      }
      return false;
    }
  }
  return true;
}

function generateCompleteBoard() {
  const board = createEmptyMatrix();

  for (let block = 0; block < 9; block += 3) {
    const numbers = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let index = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        board[block + row][block + col] = numbers[index++];
      }
    }
  }

  solveSudokuRandomized(board);
  return board;
}

/**
 * Crea una solución completa y un tablero con la cantidad de huecos elegida.
 * @param {number} emptyCells Cantidad de casillas vacías, entre 20 y 54
 * @returns {{solution: number[][], puzzle: number[][]}}
 */
export function generateNewPuzzle(emptyCells) {
  const solution = generateCompleteBoard();
  const puzzle = solution.map(row => [...row]);
  const cellsToRemove = Math.min(54, Math.max(20, emptyCells));
  const coordinates = [];

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) coordinates.push({ row, col });
  }

  for (const { row, col } of shuffleArray(coordinates).slice(0, cellsToRemove)) {
    puzzle[row][col] = 0;
  }

  return { solution, puzzle };
}

export function getDifficultyForEmptyCells(emptyCells) {
  for (const [difficulty, range] of Object.entries(DIFFICULTY_EMPTY_CELLS)) {
    if (emptyCells >= range.min && emptyCells <= range.max) return difficulty;
  }
  return "easy";
}

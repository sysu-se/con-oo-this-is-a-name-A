
function deepCopyGrid(grid) {
	return structuredClone(grid);
}

function validateGrid(grid) {
	var invalidCells = [];
	var BOX_SIZE = 3;
	var SUDOKU_SIZE = 9;

	function addInvalid(x, y) {
		var xy = x + ',' + y;
		if (!invalidCells.includes(xy)) invalidCells.push(xy);
	}

	for (var y = 0; y < SUDOKU_SIZE; y++) {
		for (var x = 0; x < SUDOKU_SIZE; x++) {
			var value = grid[y][x];
			if (value) {
				for (var i = 0; i < SUDOKU_SIZE; i++) {
					if (i !== x && grid[y][i] === value) {
						addInvalid(x, y);
					}
					if (i !== y && grid[i][x] === value) {
						addInvalid(x, i);
					}
				}
				var startY = Math.floor(y / BOX_SIZE) * BOX_SIZE;
				var endY = startY + BOX_SIZE;
				var startX = Math.floor(x / BOX_SIZE) * BOX_SIZE;
				var endX = startX + BOX_SIZE;
				for (var row = startY; row < endY; row++) {
					for (var col = startX; col < endX; col++) {
						if (row !== y && col !== x && grid[row][col] === value) {
							addInvalid(col, row);
						}
					}
				}
			}
		}
	}
	return invalidCells;
}

function checkWon(grid) {
	var SUDOKU_SIZE = 9;
	for (var row = 0; row < SUDOKU_SIZE; row++) {
		for (var col = 0; col < SUDOKU_SIZE; col++) {
			if (grid[row][col] === 0) return false;
		}
	}
	var invalidCells = validateGrid(grid);
	return invalidCells.length === 0;
}

function createSudoku(input) {
	var grid = deepCopyGrid(input);
	var initialGrid = deepCopyGrid(input);

	return {
		getGrid: function() {
			return deepCopyGrid(grid);
		},
		getInitialGrid: function() {
			return deepCopyGrid(initialGrid);
		},
		guess: function(move) {
			grid[move.row][move.col] = move.value;
		},
		getInvalidCells: function() {
			return validateGrid(grid);
		},
		isWon: function() {
			return checkWon(grid);
		},
		clone: function() {
			var cloned = createSudoku(initialGrid);
			for (var row = 0; row < 9; row++) {
				for (var col = 0; col < 9; col++) {
					cloned.guess({ row: row, col: col, value: grid[row][col] });
				}
			}
			return cloned;
		},
		toJSON: function() {
			return { grid: deepCopyGrid(grid), initialGrid: deepCopyGrid(initialGrid) };
		},
		toString: function() {
			return JSON.stringify(grid);
		}
	};
}

function createSudokuFromJSON(json) {
	var sudoku = createSudoku(json.initialGrid || json.grid);
	if (json.grid) {
		for (var row = 0; row < 9; row++) {
			for (var col = 0; col < 9; col++) {
				sudoku.guess({ row: row, col: col, value: json.grid[row][col] });
			}
		}
	}
	return sudoku;
}

function createGame(options) {
	var sudoku = options.sudoku;
	var history = options.history ? options.history.slice() : [];
	var redoStack = options.redoStack ? options.redoStack.slice() : [];

	return {
		getSudoku: function() {
			return sudoku;
		},
		guess: function(move) {
			history.push(sudoku.clone());
			redoStack = [];
			sudoku.guess(move);
		},
		undo: function() {
			if (history.length) {
				redoStack.push(sudoku.clone());
				sudoku = history.pop();
			}
		},
		redo: function() {
			if (redoStack.length) {
				history.push(sudoku.clone());
				sudoku = redoStack.pop();
			}
		},
		canUndo: function() {
			return !!history.length;
		},
		canRedo: function() {
			return !!redoStack.length;
		},
		toJSON: function() {
			return {
				sudoku: sudoku.toJSON(),
				history: history.map(function(s) { return s.toJSON(); }),
				redoStack: redoStack.map(function(s) { return s.toJSON(); })
			};
		}
	};
}

function createGameFromJSON(json) {
	var sudoku = createSudokuFromJSON(json.sudoku);
	var history = json.history.map(function(j) { return createSudokuFromJSON(j); });
	var redoStack = json.redoStack.map(function(j) { return createSudokuFromJSON(j); });
	return createGame({
		sudoku: sudoku,
		history: history,
		redoStack: redoStack
	});
}

export {
	createSudoku,
	createSudokuFromJSON,
	createGame,
	createGameFromJSON
};


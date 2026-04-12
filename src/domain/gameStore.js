import { writable } from 'svelte/store';
import { createSudoku, createGame } from './index.js';
import { solveSudoku } from '@sudoku/sudoku';

/*
面向 Svelte 的适配层 (Store Adapter)
持有 Game / Sudoku，对外暴露响应式状态和方法
*/

function createGameStore() {
	// 内部状态
	let game = null;

	// 初始空棋盘
	const emptyGrid = [
		[0, 0, 0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0, 0, 0],
	];

	// 响应式状态
	const state = writable({
		grid: emptyGrid,           // 当前棋盘 (用户输入后的)
		initialGrid: emptyGrid,    // 初始棋盘
		invalidCells: [],          // 冲突格子 ["x,y", ...]
		won: false,                // 是否胜利
		canUndo: false,            // 能否撤销
		canRedo: false,            // 能否重做
	});

	// 更新状态
	function updateState() {
		if (!game) return;
		const sudoku = game.getSudoku();
		state.set({
			grid: sudoku.getGrid(),
			initialGrid: sudoku.getInitialGrid(),
			invalidCells: sudoku.getInvalidCells(),
			won: sudoku.isWon(),
			canUndo: game.canUndo(),
			canRedo: game.canRedo(),
		});
	}

	// 初始化游戏
	function init(grid) {
		const sudoku = createSudoku(grid);
		game = createGame({ sudoku });
		updateState();
	}

	// 猜测（填入数字）
	function guess(row, col, value) {
		if (!game) return;
		game.guess({ row, col, value });
		updateState();
	}

	// 撤销
	function undo() {
		if (!game) return;
		game.undo();
		updateState();
	}

	// 重做
	function redo() {
		if (!game) return;
		game.redo();
		updateState();
	}

	// 使用提示（填入正确答案）
	function applyHint(row, col) {
		if (!game) return;
		const currentGrid = game.getSudoku().getGrid();
		const solved = solveSudoku(currentGrid);
		game.guess({ row, col, value: solved[row][col] });
		updateState();
	}

	return {
		subscribe: state.subscribe,

		init,
		guess,
		undo,
		redo,
		applyHint,

		// 获取底层 Game 对象（用于特殊需求）
		getGame: () => game,
	};
}

// 创建单例
const gameStore = createGameStore();

export default gameStore;

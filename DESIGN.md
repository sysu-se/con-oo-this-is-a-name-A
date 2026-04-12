# Homework 1.1 设计文档

## 一、领域对象如何被消费

### 1. View 层直接消费的是什么？

View 层消费的是 **`gameStore`**（位于 `src/domain/gameStore.js`），而不是直接消费 `Game` 或 `Sudoku`。

```
┌─────────────────────────────────────────────────────┐
│  Svelte 组件 (Board, Keyboard, Actions)             │
│  使用 $gameStore.grid, 调用 gameStore.guess() 等     │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  gameStore (Store Adapter)                         │
│  - 持有 Game / Sudoku 实例                         │
│  - 对外暴露响应式状态                               │
│  - 对外暴露可调用方法                               │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  Game / Sudoku (领域对象)                          │
│  - 纯业务逻辑，无 Svelte 依赖                       │
└─────────────────────────────────────────────────────┘
```

### 2. View 层拿到的数据是什么？

| 数据 | 类型 | 用途 |
|------|------|------|
| `grid` | `number[][]` | 当前棋盘（包含用户填入的数字） |
| `initialGrid` | `number[][]` | 初始题目（用于区分初始数字和用户输入） |
| `invalidCells` | `string[]` | 冲突格子，格式为 `["x,y", ...]` |
| `won` | `boolean` | 是否胜利 |
| `canUndo` | `boolean` | 能否撤销 |
| `canRedo` | `boolean` | 能否重做 |

### 3. 用户操作如何进入领域对象？

**点击数字填入**：
```javascript
// Keyboard.svelte
gameStore.guess(row, col, value)
    → Game.guess({ row, col, value })
        → Sudoku.guess({ row, col, value })
```

**撤销**：
```javascript
// Actions.svelte
gameStore.undo()
    → Game.undo()
```

**重做**：
```javascript
// Actions.svelte
gameStore.redo()
    → Game.redo()
```

### 4. 领域对象变化后，Svelte 为什么会更新？

关键在于 `updateState()` 函数：

```javascript
function updateState() {
    state.set({
        grid: sudoku.getGrid(),
        invalidCells: sudoku.getInvalidCells(),
        won: sudoku.isWon(),
        canUndo: game.canUndo(),
        canRedo: game.canRedo(),
    });
}
```

每次领域对象变化后，调用 `state.set({...})`，这会**重新赋值**整个状态对象。Svelte 检测到这个赋值操作，自动通知所有订阅 `$gameStore` 的组件，触发 UI 重新渲染。

---

## 二、响应式机制说明

### 1. 我们依赖的是什么机制？

我们依赖的是 **Svelte Store 的订阅机制**（`writable` + `subscribe`）。

```javascript
const state = writable({ grid: [...], ... });

return {
    subscribe: state.subscribe,  // 暴露订阅方法
    init, guess, undo, redo, applyHint
};
```

### 2. 哪些数据是响应式暴露给 UI 的？

```javascript
const state = writable({
    grid: emptyGrid,           // ✓ 响应式
    initialGrid: emptyGrid,    // ✓ 响应式
    invalidCells: [],          // ✓ 响应式
    won: false,               // ✓ 响应式
    canUndo: false,           // ✓ 响应式
    canRedo: false,           // ✓ 响应式
});
```

### 3. 哪些状态留在领域对象内部？

| 状态 | 位置 | 说明 |
|------|------|------|
| 历史记录 | `Game.history` | 撤销用的状态栈 |
| 重做栈 | `Game.redoStack` | 重做用的状态栈 |
| 当前 Sudoku | `Game.sudoku` | 内部持有的 Sudoku 实例 |

这些状态不对 UI 暴露，UI 只能通过 `canUndo` / `canRedo` 间接知道历史存在。

### 4. 如果不用 store，而是直接 mutate 对象，会出现什么问题？

```javascript
// ❌ 错误做法
function guess(row, col, value) {
    game.grid[row][col] = value;  // 直接修改数组
}
// 问题：Svelte 检测不到变化，UI 不刷新
```

Svelte 3 的响应式基于**赋值操作**，不是基于**引用变化**。直接修改对象内部字段不会触发赋值，Svelte 不知道数据变了。

**正确做法**：
```javascript
// ✓
function guess(row, col, value) {
    game.guess({ row, col, value });
    updateState();  // 调用 set() 重新赋值
}
```

### 5. 为什么 `state.set({...})` 能触发更新？

`writable.set()` 内部会：
1. 更新内部存储的值
2. **调用所有订阅者的回调函数**，通知数据变化

Svelte 组件通过 `$gameStore` 自动订阅了这个变化，所以能收到通知并重新渲染。

---

## 三、改进说明

### 1. 相比 HW1，改进了什么？

| 方面 | HW1 | HW1.1 |
|------|-----|-------|
| 领域对象 | 存在但未接入 UI | 通过 gameStore 接入真实流程 |
| UI 数据源 | 旧的 grid store | gameStore.grid |
| 用户输入 | 直接操作旧 store | 调用领域对象方法 |
| Undo/Redo | 未实现 | 已实现并接入 UI |
| 校验逻辑 | 无 | Sudoku.getInvalidCells() |
| 胜利判断 | 旧的 derived store | Sudoku.isWon() |

### 2. 为什么 HW1 中的做法不足以支撑真实接入？

HW1 中 `Sudoku` / `Game` 虽然实现了完整的业务逻辑，但：

1. **UI 仍然读旧的 store**：Board 组件读的是 `$userGrid`，不是 `$gameStore.grid`
2. **用户输入没有走领域对象**：Keyboard 调用的是 `userGrid.set()`，不是 `gameStore.guess()`
3. **响应式没有打通**：领域对象变了，UI 不知道

结果是"领域对象存在但未被使用"。

### 3. 新设计有哪些 trade-off？

**优点**：
- 领域对象保持纯净，不依赖 Svelte
- 核心逻辑易于测试
- UI 与业务逻辑解耦
- 将来迁移到 Svelte 5 只需要改 gameStore 层

**缺点**：
- 多了一层间接（gameStore），增加了一点复杂度
- 每次操作都要调用 `updateState()`，有微小性能开销

**取舍**：
选择了方案 A（Store Adapter）而不是方案 B（领域对象自身实现可订阅），因为：
- 方案 A 让领域对象保持框架无关性
- 便于单元测试
- 符合"领域驱动设计"的思想

---

## 四、关键原理问答

### Q1: 为什么修改对象内部字段后，界面不一定自动更新？

Svelte 3 基于**赋值**追踪变化，不是基于**引用**。修改 `obj.field` 不是赋值，Svelte 检测不到。

### Q2: 为什么 store 可以被 `$store` 消费？

因为 store 实现了 `subscribe()` 方法，这是 Svelte 的约定协议。Svelte 编译器看到 `$store` 会自动变成 `store.subscribe(callback)`。

### Q3: 我们的 UI 为什么会更新？

调用链：
1. `gameStore.guess()` → `Game.guess()` → `Sudoku.guess()`
2. `updateState()` → `state.set({...})`
3. Svelte 检测到 store 被重新赋值
4. 订阅者收到通知，组件重新渲染

### Q4: 如果错误地直接 mutate 对象，会出什么问题？

UI 不会更新。因为没有触发"赋值"操作，Svelte 不知道数据变了。

---

## 五、架构图

```
┌──────────────────────────────────────────────────────────────┐
│                         UI 层                                │
│  Board.svelte    Keyboard.svelte    Actions.svelte          │
│       ↓                ↓                  ↓                  │
│  $gameStore.grid  gameStore.guess()  gameStore.undo()       │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                      gameStore (适配层)                       │
│  - writable store，提供响应式状态                             │
│  - init() / guess() / undo() / redo() / applyHint()         │
│  - 内部持有 Game / Sudoku 实例                               │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                    领域对象层 (domain/)                        │
│                                                              │
│  ┌─────────────┐         ┌─────────────┐                    │
│  │   Sudoku    │         │    Game     │                    │
│  ├─────────────┤         ├─────────────┤                    │
│  │ getGrid()   │◄────────│ guess()     │                    │
│  │ guess()     │         │ undo()      │                    │
│  │ getInvalid  │         │ redo()      │                    │
│  │   Cells()   │         │ canUndo()   │                    │
│  │ isWon()     │         │ canRedo()   │                    │
│  │ clone()     │         └─────────────┘                    │
│  └─────────────┘                                              │
└──────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                    基础设施层 (@sudoku/)                       │
│  - generateSudoku() / decodeSencode() (生成/解码题目)         │
│  - solveSudoku() (提示功能)                                  │
│  - timer / cursor / candidates (UI 辅助状态)                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 六、课堂讨论问题

### 1. 你的 view 层直接消费的是谁？

View 层直接消费的是 **`gameStore`**（Store Adapter），而不是直接消费 `Game` 或 `Sudoku`。

- UI 读取：`$gameStore.grid`
- UI 调用：`gameStore.guess()`, `gameStore.undo()`, `gameStore.redo()`

### 2. 为什么你的 UI 在领域对象变化后会刷新？

因为 gameStore 内部调用了 `state.set({...})`，这会**重新赋值**整个状态对象。Svelte 检测到这个赋值操作，自动通知所有订阅 `$gameStore` 的组件，触发 UI 重新渲染。

调用链：
```
用户操作 → gameStore.guess() → Game.guess() → Sudoku.guess()
    ↓
updateState() → state.set({grid: ...}) → Svelte 通知订阅者 → UI 刷新
```

### 3. 你的方案中，响应式边界在哪里？

响应式边界在 **gameStore 层**。

| 层级 | 是否响应式 | 说明 |
|------|-----------|------|
| UI 层 (svelte) | ✓ | 使用 $gameStore 订阅 |
| gameStore 层 | ✓ | writable store，自动通知 |
| 领域对象层 (domain/) | ✗ | 纯 JS 对象，无响应式 |

领域对象变化后，必须通过 `updateState()` → `state.set()` 才能触发 UI 更新。

### 4. 你的 `Sudoku` / `Game` 哪些状态对 UI 可见，哪些不可见？

**UI 可见**（通过 gameStore 暴露）：
- `grid` - 当前棋盘
- `initialGrid` - 初始棋盘
- `invalidCells` - 冲突格子
- `won` - 是否胜利
- `canUndo` / `canRedo` - 能否撤销/重做

**UI 不可见**（内部状态）：
- `Game.history` - 历史记录栈
- `Game.redoStack` - 重做栈
- `Sudoku` 内部持有的 `grid` 和 `initialGrid`（通过 getGrid() 获取副本）

### 5. 如果将来迁移到 Svelte 5，你的哪一层最稳定，哪一层最可能改动？

| 层级 | 稳定性 | 说明 |
|------|--------|------|
| 领域对象 (domain/) | **最稳定** | 纯 JS，无 Svelte 依赖，零改动 |
| gameStore | 需要改动 | Svelte 5 用 runes，需要改成新的响应式写法 |
| UI 组件 | 可能微调 | 语法略有变化，但逻辑不变 |

---

## 七、HW1 核心问题

### 1. 你的 `Sudoku` / `Game` 的职责边界是什么？

| 对象 | 职责 |
|------|------|
| **Sudoku** | 持有棋盘数据，提供 guess() 操作棋盘，提供 getInvalidCells() 校验，提供 isWon() 判断胜利 |
| **Game** | 持有 Sudoku 实例，管理历史 (undo/redo)，对外提供面向 UI 的操作入口 |

**边界划分**：
- `Game` 不直接操作棋盘，委托给 `Sudoku`
- `Game` 负责历史管理，`Sudoku` 负责棋盘逻辑
- 校验和胜利判断在 `Sudoku` 层，因为这是棋盘状态的固有属性

### 2. `Move` 是值对象还是实体对象？为什么？

**`Move` 是值对象**。

判断依据：
- **标识**：由 `{row, col, value}` 三个值组成，无唯一标识
- **相等性**：两个 Move 相等当且仅当 row/col/value 都相同
- **不可变**：Move 创建后不会被修改，只会被使用

在本实现中，Move 没有被建模为独立对象，而是直接作为 `guess({ row, col, value })` 的参数传递，符合轻量级值对象的设计。

### 3. history 中存储的是什么？为什么？

`history` 中存储的是 **Sudoku 的快照（clone）**。

```javascript
guess: function(move) {
    history.push(sudoku.clone());  // 保存当前状态
    redoStack = [];
    sudoku.guess(move);           // 执行新操作
}
```

**为什么存储快照而不是 Move？**
- 快照可以完整恢复任意历史状态
- 不用担心"逆向操作"如何实现
- 代价是内存，但数独 9x9 的数据量很小
- 简化了撤销/重做的实现复杂度

### 4. 你的复制策略是什么？哪些地方需要深拷贝？

**复制策略**：使用 `structuredClone()` 进行深拷贝。

```javascript
function deepCopyGrid(grid) {
    return structuredClone(grid);
}
```

**需要深拷贝的地方**：
1. **Sudoku 构造函数**：用 `deepCopyGrid(input)` 保存初始棋盘
2. **Sudoku.getGrid()**：返回棋盘副本，防止外部修改内部状态
3. **Sudoku.clone()**：创建 Sudoku 的完整副本，用于历史记录
4. **Sudoku.toJSON()**：序列化时返回深拷贝

**不需要深拷贝的地方**：
- 历史记录栈 `history` 和重做栈 `redoStack`：存储的是 Sudoku 对象引用
- 实际上 clone() 已经创建了新的 Sudoku 对象，所以栈中存的是不同对象

### 5. 你的序列化 / 反序列化设计是什么？

```javascript
// Sudoku 序列化
toJSON: function() {
    return {
        grid: deepCopyGrid(grid),
        initialGrid: deepCopyGrid(initialGrid)
    };
}

// Sudoku 反序列化
createSudokuFromJSON: function(json) {
    var sudoku = createSudoku(json.initialGrid || json.grid);
    if (json.grid) {
        for (var row = 0; row < 9; row++) {
            for (var col = 0; col < 9; col++) {
                sudoku.guess({ row, col, value: json.grid[row][col] });
            }
        }
    }
    return sudoku;
}

// Game 序列化
toJSON: function() {
    return {
        sudoku: sudoku.toJSON(),
        history: history.map(s => s.toJSON()),
        redoStack: redoStack.map(s => s.toJSON())
    };
}
```

**设计考虑**：
- 保存 `initialGrid` 用于区分初始数字和用户输入
- 如果有 `grid`（用户已填入），则恢复完整状态
- history 和 redoStack 都要序列化，支持撤销/重做的持久化

### 6. 你的外表化接口是什么？为什么这样设计？

**外表化接口**：

```javascript
// 棋盘数据
getGrid()        // 获取当前棋盘副本
getInitialGrid() // 获取初始棋盘副本

// 状态检查
getInvalidCells() // 获取冲突格子
isWon()          // 判断是否胜利
canUndo()        // 能否撤销
canRedo()        // 能否重做

// 序列化
toJSON()         // 导出完整状态
toString()       // 调试用字符串
```

**为什么这样设计**：
1. **方法而非属性**：返回副本或计算结果，不暴露内部状态
2. **get 开头**：符合 getter 命名规范，表示读取操作
3. **返回副本**：`getGrid()` 返回深拷贝，外部修改不影响内部
4. **职责分明**：每个方法只做一件事

**防止外部直接修改**：
```javascript
// ❌ 外部不能这样
sudoku.grid[0][0] = 5;

// ✓ 必须这样
sudoku.guess({ row: 0, col: 0, value: 5 });
```

这样设计保证了领域对象的封装性，外部只能通过定义好的接口操作棋盘。

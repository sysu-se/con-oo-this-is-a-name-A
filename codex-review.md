# con-oo-this-is-a-name-A - Review

## Review 结论

实现已经把 Game/Sudoku 接入到真实界面的部分主流程，但当前仍然是“领域对象 + 旧 store 并存”的半接入状态。棋盘渲染、开局、撤销重做已经开始消费领域对象，这是正确方向；不过关键业务约束仍未真正收口到领域层，且有几条旧 Svelte 状态链没有被替换干净，已经产生了会影响数独正确性的缺陷。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | fair |
| JS Convention | fair |
| Sudoku Business | poor |
| OOD | fair |

## 缺点

### 1. 可编辑性判断仍依赖旧 grid，题面数字会被当成可修改单元

- 严重程度：core
- 位置：src/node_modules/@sudoku/game.js:15-18; src/node_modules/@sudoku/stores/keyboard.js:1-10; src/node_modules/@sudoku/stores/grid.js:1-41; src/domain/index.js:67-68
- 原因：新开局只调用 gameStore.init(...)，并没有同步旧的 grid store；但 keyboardDisabled 仍然读取旧 grid。这样它长期把所有格子都看成 0，选中任意格后键盘都会解锁。再加上 Sudoku.guess 本身没有阻止覆盖 givens，UI 实际上允许改写初始题面，既违反数独业务，也说明 Svelte 侧仍存在双状态源。

### 2. 提示次数与统计在新接入路径中失效

- 严重程度：core
- 位置：src/components/Controls/ActionBar/Actions.svelte:13-20; src/domain/gameStore.js:79-85; src/node_modules/@sudoku/stores/grid.js:80-87; src/components/Modal/Types/GameOver.svelte:65-79
- 原因：旧实现的 applyHint 会先调用 hints.useHint()，而现在的 handleHint -> gameStore.applyHint 只改棋盘，不扣减剩余提示，也不会累加 usedHints。开启限次提示时，UI 显示的是有限资源，但实际可以无限使用，Game Over 页面上的 Hints used 也会失真。

### 3. 候选数/Notes 被当成正式落子写入领域历史

- 严重程度：major
- 位置：src/components/Controls/Keyboard.svelte:8-23; src/domain/index.js:115-119
- 原因：Notes 模式下每次增删候选数都会额外执行 gameStore.guess(..., 0)。这会让纯 UI 的候选标记进入 Game 的 undo/redo 历史；若当前格原本有用户填写的数字，还会被直接清零。领域对象因此承担了不属于数独领域的展示态，职责边界被打穿。

### 4. 领域对象没有守住数独规则和输入约束

- 严重程度：major
- 位置：src/domain/index.js:67-68; src/domain/index.js:115-119; src/domain/gameStore.js:59-62
- 原因：Sudoku.guess 只是直接赋值，Game.guess 也没有做任何前置校验。越界坐标、非法数字、对 givens 的覆盖、重复提交同值都会被接受，并直接进入历史。这样业务约束完全依赖外层 UI 自觉遵守，不符合“对象自己维护不变量”的 OOP/OOD 设计。

### 5. 分享功能导出的是当前局面，不是题目本身

- 严重程度：major
- 位置：src/components/Modal/Types/Share.svelte:12-18; src/node_modules/@sudoku/game.js:31-35; src/domain/gameStore.js:52-55
- 原因：Share 直接编码 $gameStore.grid，而 startCustom 又把解码结果当成新的 initialGrid 初始化。结果是把当前进度、用户填写和 hint 结果都固化成新题面的 givens。对外表化没有复用领域对象自己的序列化语义，业务上“分享题目”与“分享当前状态”被混在了一起。

## 优点

### 1. 采用了作业推荐的 Store Adapter 方向

- 位置：src/domain/gameStore.js:10-99
- 原因：gameStore 在内部持有 Game，并统一向 Svelte 暴露 grid、initialGrid、invalidCells、won、canUndo、canRedo 以及 guess/undo/redo/applyHint。相比把业务逻辑散落在组件中，这个适配层方向是正确的。

### 2. Sudoku 与 Game 的职责边界已经初步建立

- 位置：src/domain/index.js:56-91; src/domain/index.js:106-145
- 原因：Sudoku 负责棋盘、校验、clone 和外表化，Game 负责历史与 undo/redo。虽然约束还不够完整，但对象分工已经比“所有逻辑都堆在组件里”更清晰。

### 3. 棋盘渲染已经直接消费领域快照

- 位置：src/components/Board/index.svelte:40-51
- 原因：Board 不再直接读取旧的 userGrid/invalidCells，而是从 $gameStore 读取当前 grid、initialGrid 和 invalidCells，说明领域对象已经进入真实界面的渲染链路。

### 4. 开局入口已统一走领域适配层

- 位置：src/node_modules/@sudoku/game.js:15-37; src/components/Modal/Types/Welcome.svelte:16-24; src/components/Header/Dropdown.svelte:11-55
- 原因：欢迎弹窗和菜单触发的新局/载入都集中走 startNew/startCustom，再由它们调用 gameStore.init 并重置 cursor、timer、hints。这说明接入不是只停留在测试，而是已经进入真实游戏流程。

### 5. 胜负判断已从领域状态派生到 UI

- 位置：src/node_modules/@sudoku/stores/game.js:6-12; src/App.svelte:12-17
- 原因：gameWon 由 gameStore.won 派生，App 再基于它弹出 Game Over。胜利条件没有再在组件里重复计算，这符合“View 消费领域状态”的思路。

## 补充说明

- 本次结论完全基于静态阅读，没有运行测试，也没有做实际界面交互验证。
- 审查范围限定在 src/domain/* 及其直接接入的 Svelte 代码；其中包含实际桥接层 src/node_modules/@sudoku/*，因为这些文件直接消费了 src/domain。
- 关于“题面可被改写”“hint 不扣次数”“分享会把当前进度固化为 givens”等判断，都是根据代码路径静态推导得出：startNew/startCustom -> gameStore.init、keyboardDisabled -> 旧 grid、handleHint -> gameStore.applyHint、Share -> startCustom。

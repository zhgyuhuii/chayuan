# 新建 / 编辑助手页面 — 布局优化方案

## 问题诊断

当前 `SettingsDialog.vue` 的助手编辑面板(L680-1180,~500 行模板)存在以下问题:

| # | 问题 | 后果 |
|---|------|------|
| 1 | **21 个 `.config-item` 垂直平铺** | 滚动深度 2000-3000px,新手懵 |
| 2 | **每条字段下方贴 50+ 字的 `.config-hint`** | 视觉与下一字段 label 混淆,page rhythm 破碎 |
| 3 | **`config-content { gap: 20px }`** + hint 高度 = 单字段实占 100-150px | 信息密度过低 |
| 4 | **报告设置 4 个嵌套字段**(类型 / 自定义类型 / 模板 / 提示词)平铺不折叠 | 最复杂的子表单占据最多空间 |
| 5 | **多媒体偏好** 字段对 chat 助手不可见但仍占 placeholder 高度切换 | 内容跳动 |
| 6 | **`.assistant-preset-panel`(快捷模板)** 在底部展开后又是一长片 | 影响主流程聚焦 |
| 7 | **必填项**(名称/系统提示词)与 **微调项**(温度/显示优先级) 视觉权重相同 | 用户不知道先填哪个 |
| 8 | **没有 sticky 操作栏** | 滚到底才能点"创建",滚回顶部修改某项后又得滚回底 |

---

## 最佳方案:**Tab 分组 + Hint 折叠 + Sticky 操作栏**

### 一、把 21 字段重组为 4 组(顶部 Tab 切换)

```
┌──────────────────────────────────────────────────────────────────┐
│ 📝 基础  │  🎯 能力  │  📤 输出  │  ⚙️ 高级    [创建智能助手]  │  ← sticky tab + action
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  当前 Tab 内容(密度提升、hint 折叠)                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

| Tab | 字段 | 必填字段 |
|-----|------|----------|
| **📝 基础信息**(默认选中) | 助手名称 / 图标 / 功能说明 / 助手类型 / 输入范围 / 执行模型 | 名称 |
| **🎯 能力定义** | 角色设定 / 系统提示词 / 用户提示词模板 / 智能推荐入口 / 目标语言(翻译) | 系统提示词、用户提示词模板 |
| **📤 输出与写回** | 输出格式 / 文档动作 / 温度 / 输出报告(及其 4 子项,默认折叠) | — |
| **⚙️ 高级 / 显示** | 显示位置 / 显示优先级 / 多媒体偏好 / 快捷模板 | — |

效果:**新手只需填基础信息和能力定义两个 Tab**,15 秒可建好一个助手;高级用户进 ⚙️ Tab 调显示 / 报告等。

### 二、Hint 文本规则

| 规则 | 之前 | 之后 |
|------|------|------|
| 短 hint(≤ 20 字) | 多行紧贴 input 下方 | 内联放 input 旁,小灰字 |
| 中 hint(20-60 字) | 整段灰字独占一行 | 折叠为 ⓘ 图标,hover/click 展开 |
| 长 hint(60+ 字) | 独占 2-3 行,严重影响节奏 | 改为 collapsible 子 panel,默认收起 |
| 超长 hint(报告模板) | 占 200px 高度 | 移入"高级 Tab"的折叠区块 |

### 三、视觉层级

- **必填字段** label 加红色 `*`(`必填` 用语义):`<label data-required>助手名称</label>`
- **textarea** 单色等宽字体(`--font-mono`)+ 浅灰背景,与单行 input 区别
- **Hint 改为左 border-style** 而非全段灰字,视觉降权:
  ```css
  .config-hint {
    border-left: 2px solid var(--chy-ink-300);
    padding-left: 8px;
    background: var(--chy-ink-50);
    font-size: 11px;
  }
  ```
- **报告子项** 用左缩进 + 左 border 表示从属关系:
  ```
  ☐ 输出报告
    │
    ├─ 类型
    ├─ 自定义类型(disabled)
    ├─ 报告格式 [textarea]
    └─ 报告提示词 [textarea]
  ```

### 四、Sticky 操作栏

操作按钮("创建智能助手" / "删除当前助手" / "恢复默认模板")**永远固定在面板底部**:

```css
.config-content > .assistant-inline-actions:last-child {
  position: sticky;
  bottom: 0;
  background: linear-gradient(to top, var(--color-bg-elevated) 70%, transparent);
  padding: 12px 0 8px;
  margin: 0 -4px;
  border-top: 1px solid var(--chy-ink-100);
}
```

### 五、字段两栏(>720px 屏)

宽屏下用 `grid-template-columns: 110px 1fr` 让 label 右对齐左侧,input 右侧自适应。
小屏 fallback 回单栏。

```css
@media (min-width: 720px) {
  .config-item {
    display: grid;
    grid-template-columns: 110px 1fr;
    column-gap: 16px;
    align-items: start;
  }
  .config-label { text-align: right; padding-top: 10px; }
}
```

---

## 实施策略 — 三层递进,不动主文件

### 第一层:**CSS 增强**(立刻见效,零代码改动主文件)
新建 `src/assets/assistant-form-enhanced.css`,通过 cascade 提升旧表单视觉:
- 字段密度优化(`gap: 14px`)
- Hint 视觉降权(border-left + 浅灰背景)
- 必填 label 加 `*`
- Sticky 操作栏
- 宽屏两栏

main.js 引入即生效。**风险:零**(纯 CSS 装饰,出问题去掉一行 import 回退)。

### 第二层:**目标布局 demo 页**(供团队评审目标方向)
新建 `src/components/AssistantFormDemoPage.vue`,路由 `/assistant-form-demo`,展示:
- 顶部 4 个 Tab + sticky 切换
- 报告子项 Collapsible 折叠
- Hint ⓘ tooltip

业务方在 demo 上调好交互细节后,再考虑改主文件。**风险:零**(独立路由,不影响现有)。

### 第三层(后续):**真正切到 Tab 布局**
等 demo 评审通过后,再动 SettingsDialog 主文件 — 此时改动是机械的(把现有 `<div class="config-content">` 内的 21 个 `.config-item` 按分组移到 4 个 `<TabPane>` 里),risk 可控。

本次先交付**第一层 + 第二层**,改动主文件留待评审后。

---

## 验收标准

第一层完成后:
- 新建助手页滚动深度 2000-3000px → 1200-1500px(密度提升 + hint 视觉降权)
- Hint 文本不再"打断" 视觉节奏
- 操作按钮永远可见,不必滚到底

第二层完成后:
- `/assistant-form-demo` 可点开看目标布局
- 4 个 Tab 切换流畅,无字段错位
- 必填字段 + 红 `*` 一目了然

---

## 不做(已知,留待第三层)

- 改 SettingsDialog 主文件 21 个 .config-item 的位置(等评审通过)
- 重排 报告设置 4 子项的字段顺序(也等评审)
- 移除任何字段(用户配置兼容性需保护)

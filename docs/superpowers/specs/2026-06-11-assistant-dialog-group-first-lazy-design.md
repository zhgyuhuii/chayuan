# 助手对话窗口 group-first 懒加载 —— 设计文档

日期：2026-06-11
项目：chayuan-wps（WPS 加载项）
状态：设计待评审

## 1. 问题

`AIAssistantDialog.vue` 助手选择窗口在内置助手达到 **4526 个 / 228 领域**后打开明显变慢。

## 2. RCA（瓶颈，按影响排序）

1. **首屏渲染约 4.5 万个 DOM 节点**。模板按领域分组 `v-for`，但折叠用的是
   `v-show="!isAssistantGroupCollapsed(...)"`（`AIAssistantDialog.vue:90`）——**折叠分组的
   子项仍在 DOM 中**，只是 `display:none`。4526 项 ×~10 元素一次性进 DOM，是头号瓶颈。
2. **mounted 即 `Promise.all` 加载全部 228+ 领域包**（`ensureDomainPacksLoaded`，
   `assistantRegistry.js:1888`，`AIAssistantDialog.vue:4012`）——350 个动态 chunk 一起拉。
3. **搜索每按键 O(4526) 重算** `assistantGroups` computed（过滤+分组+排序）。
4. 次要：`loadAssistantItems()` 有 26 个触发点，10+ 在 intent/文档操作热路径，反复重建全列表。

注：`getAssistantSettingItems`（`assistantRegistry.js:1958`）本身是轻量 O(n)、不深克隆、
不含 systemPrompt 等大字段，**不是**瓶颈。

## 3. 关键事实（决定方案可行性）

- 每个 pack 文件**只含 1 个 domain**（0 个跨域包）。
- 228 个 domain 中 **122 个跨 2 个包**（base + `*Ext`），其余单包。映射为 `domain → [pack...]`。
- `ASSISTANT_GROUP_LABELS`（`assistantRegistry.js:50`）已是 domain→中文名全集，228 项全有标签。
- 收藏 `assistantFavorites`、折叠状态 `assistantGroupCollapsed`、自定义助手均已与全量列表解耦或可解耦。
- 执行链（`ribbon.js:689`、`assistantTaskRunner.js:1791`）各自独立 `await ensureDomainPacksLoaded()`
  作兜底——对话窗口改懒加载不影响「按 id 跑助手」，因为执行前仍会确保全量已加载。

## 4. 设计

### 4.1 静态 manifest（零运行时成本）

脚本零 token 生成 `src/utils/assistant/assistantDomainManifest.js`，导出：

```js
export const DOMAIN_ORDER = [/* 按内置优先级+计数排序的 domain key */]
export const DOMAIN_MANIFEST = {
  legal: { label: '合同 / 法务', count: 44, packs: ['Legal', 'LegalExt'] },
  // ... 228 项
}
```

`packs` 用 pack 短键（去掉 `builtinAssistants` 前缀与 `.js`）。生成器
`scripts/gen-assistant-domain-manifest.mjs` 复用 tutorial/catalog 同套 loader 解析，
助手定义变更后重跑即同步。

### 4.2 按 pack 键的 loader 映射（支持按域加载）

把现有扁平 `DOMAIN_PACK_LOADERS` 数组**改造为按 pack 短键的对象** `PACK_LOADERS`：

```js
const PACK_LOADERS = {
  Legal: () => import('./assistant/builtinAssistantsLegal.js').then(m => m.LEGAL_BUILTIN_ASSISTANTS),
  LegalExt: () => import('./assistant/builtinAssistantsLegalExt.js').then(m => m.LEGAL_EXT_BUILTIN_ASSISTANTS),
  // ...
}
```

（保留字面 import 字符串，Vite chunk 切分不变。该块也由生成器产出。）

新增注册器 API：

```js
// 幂等加载某 domain 的全部 pack；并发共享 Promise；失败/超时跳过。返回该 domain 是否已就绪。
export function ensureDomainLoaded(domain): Promise<boolean>
// 该 domain 是否已加载完毕（同步查询，渲染时用）
export function isDomainLoaded(domain): boolean
```

`ensureDomainPacksLoaded()` 保留（=对所有 domain 调 `ensureDomainLoaded`），供执行链/搜索兜底。

### 4.3 对话窗口 group-first 懒渲染

- 打开窗口**不调** `ensureDomainPacksLoaded`。改为：
  - 顶部小列表**立即渲染**：收藏、最近使用、自定义、少量核心常用（合计几十项，从已随主包加载的 base/core 取）。
  - 领域区**只渲染 228 个分组标题 + 计数 badge**（数据来自 `DOMAIN_MANIFEST`，**0 助手 DOM、0 包加载**）。所有领域组**默认折叠**。
- 分组容器 `v-show` → **`v-if`**：折叠的组不进 DOM。
- **点开某分组**：`toggleAssistantGroup` 钩子里，若该 domain 未加载 → `await ensureDomainLoaded(domain)` →
  `loadAssistantItems()` 重建（此时只有已加载 domain 的项进列表）→ 渲染该组助手。展开态显示 loading 占位。
- `assistantGroups` computed 改为：分组标题来自 `DOMAIN_MANIFEST`（含未加载的组，显示计数+折叠态空壳），
  组内 items 仅对「已加载 domain」从 `assistantItems` 取。

### 4.4 搜索懒触发

- 搜索框获得首个字符时触发 `ensureDomainPacksLoaded()`（全量，带 loading 态），加载期间显示「正在加载全部助手…」。
- 结果按组懒渲染：只渲染命中项；命中分组自动展开。
- 防抖 + 命中后才展开，避免每键全量重排。

### 4.5 小列表解耦

收藏/最近/自定义置顶区独立 computed，不随领域懒加载变化；自定义助手增删只重建这部分，
不触碰领域区。

## 5. 分阶段实施

- **P1**：生成器 + `assistantDomainManifest.js` 数据文件；registry 改 `PACK_LOADERS` 键化 +
  `ensureDomainLoaded/isDomainLoaded`（`ensureDomainPacksLoaded` 兼容保留）。
- **P2**：对话窗口 group-first 懒渲染（`v-if` per 组 + 计数 badge + 默认折叠 + 顶部小列表立即渲染）。
  **单这步即消灭 4.5 万 DOM 瓶颈，首屏立竿见影。**
- **P3**：分组展开触发 `ensureDomainLoaded`（消灭 mounted 全量 350 chunk）。
- **P4**：搜索懒触发 + loading 态 + 收藏/最近/核心置顶细化。

每阶段独立可验证、可回退。P1 纯新增不改行为；P2 视觉变化最大需实机验。

## 6. 兼容与风险

- 执行链不动：ribbon/taskRunner 仍 `ensureDomainPacksLoaded` 兜底，跑任意 domain 助手不受影响。
- 历史会话/已保存配置按 id 解析助手时，若所属 domain 未加载，解析处已有 `ensureDomainPacksLoaded` 兜底。
- 收藏的助手可能属未加载 domain → 收藏区渲染只需 manifest 里的轻量元数据（label/icon），
  点击执行时再兜底加载。需确认收藏项的 icon/label 来源（P2 落实）。
- WPS 环境无虚拟滚动库；本方案靠「折叠不渲染 + 按需展开」把 DOM 控制在数百级，无需引入虚拟滚动。

## 7. 决策

- D1：默认全部领域组折叠，仅顶部小列表（收藏/最近/自定义/核心）展开。
- D2：计数 badge 用静态 manifest 数，避免为显示数字而加载包。
- D3：搜索触发全量加载（用户主动搜索时可接受一次性加载+loading 态），非搜索路径永不全量加载。
- D4：`ensureDomainPacksLoaded` 保留为兜底，不删；新增 `ensureDomainLoaded` 为按域入口。
- D5：manifest 与 PACK_LOADERS 均由生成器产出，助手变更重跑同步，杜绝手维护漂移。

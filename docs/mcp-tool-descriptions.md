# MCP 工具描述规范（给大模型识别）

工具目录源码：[`mcp-sidecar/lib/toolCatalog.mjs`](../mcp-sidecar/lib/toolCatalog.mjs)

## 描述结构（每条工具）

| 段 | 含义 |
|---|---|
| **WHAT** | 领域结果是什么 |
| **WHEN** | 用户中英文触发话术 |
| **NOT** | 常见误用 + 应改用的工具 |
| **HOW** | 关键参数 / `confirmed` 规则 |
| **EXAMPLE** | 最小合法 JSON 参数 |

另附 MCP `annotations`：`readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint`。

## 服务级 instructions

`initialize.instructions` 来自 `SERVER_INSTRUCTIONS`，明确：

- 用户不提供工具名
- 推理/翻译在外部模型；WPS 只读写
- 逐段翻译插段后的标准编排

## 辅助发现

- Resource：`chayuan://guide/user-intents`
- Prompt：`para_translate_insert_after`、`open_local_document`

## 维护

改工具说明只改 `toolCatalog.mjs`，勿在 `mcpHandler.mjs` 内联重复定义。

# 察元 AI 文档助手 v3.0 — 远程知识库 RAG 集成

> 发布日期：2026-05-06
> 兼容性：WPS 文字 12.x / WPS 365 / Office 2019+（WebView2）
> 升级路径：v2.x → v3.0 全量替换，**配置 / 凭据自动迁移**，无需重新登录已绑定的模型平台

本次发布是 v2.0 之后的首个大版本，主线工作是**让察元 AI 直接消费企业 / 团队 / 个人知识库**——在 WPS 编辑器里写问题，AI 自动检索 → 拼上下文 → 给出带引用的回答，并支持引用气泡内一键下载原文附件。

---

## 一、最大亮点 — 远程知识库集成（KB Integration）

### 1.1 双模认证连接

| 类型 | 场景 | 必填字段 |
| --- | --- | --- |
| **JWT（用户模式）** | 个人账号登录 chayuan-server，使用本人有权访问的 KB | 服务器地址 / 用户名 / 密码 |
| **HMAC（应用模式）** | 部门共享账号，管理员预发 App ID + AppKey | 服务器地址 / App ID / App Secret |

凭据**端侧加密落盘**：AES-GCM + HKDF，密钥派生自设备绑定的 OPFS 盐，明文永不落盘、不参与同步。

### 1.2 三步连通性自检

新增「测试连接」面板，按 ① 服务地址（`/healthz`）→ ② 凭据（JWT login / HMAC ping）→ ③ 知识库列表 顺序探活，错误码细分到 4011 / 4014 / 4031 / 4032 / 4033，定位问题不再靠猜。

### 1.3 检索编排（services/kb）

引入完整的 RAG 客户端栈，对话发送前在本地完成"问题改写 → 多查询批量召回 → 去重 → 重排打分 → 拼引用 prompt"：

- `queryPlanner` 把用户问题拆 1~N 个子查询（按段落 / 选区 / 全文 / 核对模式动态规划）
- `searchClient.searchBatch` / `knowledge_universe/ask` 直连 chayuan-server 拉 chunks
- `deduper` 按 `chunk_id` 去重，`credibilityScorer` 按命中度 + 置信度加权
- `promptBuilder v1.4` 静态审计驱动重写了 7 项 prompt 工程改进，引用占位符、相关度提示、不命中兜底全部显式可控
- 全程 LRU 缓存（5 分钟 TTL）+ 120s 总超时 + AbortController 取消

### 1.4 引用展示与原文下载

每条 AI 回答下方折叠出「知识库引用条」（KbSourceStrip）：

- 角标 `[c1]` 可点击，定位回原句
- 每条引用显示信任度星级、所属 KB、来源文件、命中片段
- 文档型来源支持**一键下载原文**（短期签名令牌，2 分钟有效）
- 结构化 / 向量 / 办公源会清晰区分类型，不再误展示成可下载附件

### 1.5 一键灰度

KB 链路全部受 `kbRemoteIntegration` flag 控制，出问题在「设置 → 知识库设置」顶部 banner 一键关闭，连接信息和绑定关系不丢，恢复时无缝接回。

### 1.6 失效自愈

知识库被删除 / 被收回权限时，加载项自动检测：

- 发送前用 catalog 预过滤已绑定 KB，剔除已不可用项
- 服务端返回 403 / 404 时**静默清缓存**，下一轮自动同步最新列表
- 不再弹"检索失败：search_batch HTTP 403"红字，而是软提示"绑定的知识库已变更，请重新选择"

---

## 二、其它新增 / 优化

- **KbSettingsPanel 三栏布局**：连接列表 / 详情 / 操作分离，添加 / 编辑改走模态弹窗，移动端折叠也能用
- **KbSelectorDialog**：支持按文档型 / 结构化 / 向量 / 办公私库分组浏览，搜索框模糊匹配 KB 名
- **KbEmptyTopology**：未配置 KB 时显示一个引导图，从零到首次连接的链路视觉化
- **CSP 收紧**：默认 `default-src 'self'`，DocsAPI 域名走显式白名单
- **AIAssistantDialog 与设置弹窗**：重构窗口尺寸控制，从助手对话框 / 编审两处打开同步，不再出现一大一小
- **助手任务执行器**（assistantTaskRunner）：表单字段渲染重写，支持 `inAppDialog` 内嵌弹窗，避免新开窗口被 WPS 吞
- **内置助手优化**（P5+ 补丁）：拼写 / 语法等近义助手合并去重，分组与拖拽排序回归
- **服务侧默认设置**：对话模型选择跟随主对话窗口，不再各自独立漂移
- **文档 / 品牌**：通义千问 → 阿里百炼，API 地址同步更新；公司全称统一为「北京智灵鸟科技中心」；点击 `aidooo.com` 直开浏览器

---

## 三、修复

- 助手「插入段前 / 段后」误触发替换原文（如翻译多段时整段被覆盖）
- ESLint 长期遗留的未用变量、Vue 保留键、computed 副作用警告
- promptBuilder 静态审计 7 项问题（引用编号溢出、空命中分支、长内容截断策略等）
- 多语言 README 同步：en / ja / ru / de / es / fr 与中文版正文对齐

---

## 四、升级与兼容性

- **配置 / 凭据**：v2.x 升级到 v3.0 后无需重新设置，老连接和模型平台配置自动读出
- **离线 / 内网**：v3.0 仍**优先支持**离线模型（Ollama / LM Studio / Xinference / OneAPI 等 OpenAI 兼容端点），知识库特性可选关闭
- **chayuan-server 最低版本**：远程 KB 需要服务端开启 `OPEN_CROSS_DOMAIN: true` 并暴露 `/healthz`、`/auth/login`、`/knowledge_universe/list`、`/knowledge_base/search_batch` 等接口
- **WPS 加载项打包**：`npm run build:wps`、`npm run build:wps-online`、`npm run build:wps-offline` 三种产物，按需取
- **不兼容变更**：无（旧版 v2.x 配置 100% 向前兼容）

---

## 五、已知问题

- HMAC 应用账号默认看不到 public KB，需管理员显式授 `kb:public-read`
- 跨主机部署时若前端为 HTTPS、chayuan-server 为 HTTP，浏览器会因 mixed-content 拒载 OnlyOffice api.js 等资源——请保持协议一致或前端走反代统一为 HTTPS
- 选区检索（verify 模式）在某些罕见场景下，selection 文本被 WPS API 返回为空，目前会降级为全文检索并显式提示

---

## 六、安装 / 升级

```bash
# 源码方式
git fetch --all
git checkout v3.0.0
npm install
npm run build:wps          # 产物在 release/

# 增量更新打包
npm run build:wps-online   # 在线分发包(走云端模型默认走 OpenAI 兼容端点)
npm run build:wps-offline  # 离线包(内网部署/不依赖外网)
```

将 `release/chayuan-3.0.0-*.zip` 加载到 WPS 加载项目录即可。详细安装步骤见 [README.md](README.md)。

---

## 七、文档

- [使用指南](plans/kb-integration-user-guide.md) — 一分钟上手 / 故障排查 / 错误码速查
- [开发者 README](src/services/kb/README.md) — services/kb 各模块职责、扩展点
- [设计文档](plans/plan-knowledge-base-integration.md) — 完整架构设计与决策

---

## 八、致谢与联系

- 官网：[https://aidooo.com](https://aidooo.com)
- 出品：北京智灵鸟科技中心
- 微信公众号：智灵鸟科技
- License：Apache 2.0（注意品牌标识使用条款，详见 [README §二节](README.md#二特别说明察元品牌标识不得擅自改动)）

如需企业私有化部署、白标授权或商务合作，请通过官网联系。

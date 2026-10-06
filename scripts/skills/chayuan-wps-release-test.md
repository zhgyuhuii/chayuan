# chayuan-wps 发布前全面测试

**描述**：chayuan-wps 加载项发布前全面测试——覆盖打包安装、模型配置、知识库、三宿主（文字/表格/演示）对话与工具、三级生图、跨宿主、会话隔离、安全脱密等全功能。全部通过后才允许发布版本。

**触发**：用户说"发布前测试"、"版本测试"、"跑测试技能"、"chayuan-wps 测试"

---

## 前置条件

- Mac 宿主 WPS 已安装并运行，加载项 5.1.x 已部署到 `~/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/`
- 侧车服务 `com.chayuan.mcp` 已启动（`launchctl list | grep chayuan`），healthz 200
- 模型 API Key 有效（`~/.config/chayuan/settings.json` 或面板设置里已配好至少一个对话模型）
- 测试文档已备好（桌面 `chayuan-et-test.xlsx` / `vm-report.pptx` / `writer-test.docx`）
- 测试脚本：`scripts/scenarios-et-wpp-vm.py`（24 场景自动化）、`scripts/test-chat-turn-routing.mjs`（路由单测）

## 测试阶段（按序执行，全部通过才发布）

### 第一阶段 · 单元与集成测试（无 GUI，命令行）

```
npm run test:chat-turn-routing     # chat.turn 路由 6 项
npm run test:write-lock            # 写锁 25 项
npm run test:doc-binding           # 文档绑定守卫
npm run test:agent-loop            # agent-loop 冒烟
node scripts/inspect-chat-store.mjs  # 持久层体检（无空壳残留）
```

### 第二阶段 · 打包与安装

1. `npm run build` → 确认 dist/ 无报错
2. `npm run mcp:build-binary macos-arm64 linux-arm64` → 侧车二进制
3. `node scripts/build-wps-addon.mjs` → staging 目录
4. 检查 staging：
   - `chayuan_5.1.x/assets/AIAssistantDialog-*.js` 含关键标记（composer-doc-binding 等）
   - `publish.xml` 三宿主条目且版本号一致
   - `mcp-sidecar/bin/` 含当前平台二进制
5. 部署到 Mac 宿主 jsaddons（三目录 + publish.xml + jsplugins.xml）
6. 重启 WPS → 处理"已被修改"弹窗（点确定）
7. 验证 agent 注册：`/agent/status` → et=true, wpp=true（各宿主至少 1 个）

### 第三阶段 · 模型配置

1. 检查 `~/.config/chayuan/settings.json` 含 modelConfigs（至少 1 个有效 Key）
2. 打开面板 → 确认欢迎语为"已配置"变体（非"请先前往设置"）
3. 发送简单消息 → 确认模型响应正常（非"模型服务暂时不可用"）
4. 确认配置桥生效：面板设置窗口的 API 密钥框旁粘贴按钮 → 点后 Key 填入

### 第四阶段 · 知识库与模型发现

1. 确认 chayuan-harness 知识库连接（面板 KB 选择器有可用 KB）
2. 确认本地模型（Ollama）发现（模型下拉列表含本地条目）
3. 确认云端模型（DeepSeek/阿里百炼等）在模型下拉中可选
4. 切换模型 → 发消息 → 确认新模型响应

### 第五阶段 · 文字宿主（Writer）

1. 打开 writer-test.docx
2. 场景：选中一段 → 点击"数据洞察"或发消息 → 确认模型调用 document_get_text 并返回分析
3. 场景：发"把XX改成YY" → 确认 document_replace 执行成功
4. 场景：发"加一个批注" → 确认 comment.add 执行
5. 场景：发"校对全文" → 确认 proofread_run 执行并返回 issues
6. 场景：发"导出 PDF" → 确认文件生成
7. 场景：脱密预览 → 确认 declassify_preview 返回结果

### 第六阶段 · 表格宿主（ET）——24 场景自动化

运行 `scripts/scenarios-et-wpp-vm.py et` 或手动逐项：

| # | 场景 | 工具链 | 验证 |
|---|------|--------|------|
| 1 | 生成模拟数据100条带表头 | sheet_add + range_write | 行数+表头 |
| 2 | 公式生成 | range_write（公式） | 计算结果 |
| 3 | 数据洞察 | range_read → 分析 | 回复含数字 |
| 4 | 一键图表 | chart_add | chart_list |
| 5 | 降序排序 | sort | 数据递减 |
| 6 | 自动筛选 | autofilter | 状态栏 |
| 7 | 表头美化 | format（bold+bgColor） | 视觉 |
| 8 | 查找替换 | find_replace | 替换处数 |
| 9 | 跨表 COUNTIF | sheet_add + formula | 汇总表 |
| 10 | 数据清洗 | range_read/write | 空值填充 |
| 11 | 导出 CSV+PDF | export | 文件存在 |
| 12 | 删表 | sheet_delete | 表消失 |

### 第七阶段 · 演示宿主（WPP）——12 场景自动化

| # | 场景 | 工具链 | 验证 |
|---|------|--------|------|
| 1 | 长文生成 5 页 PPT | slide_add ×5 | 页数+标题 |
| 2 | 摘要页 | slide_read → slide_add | 新增页 |
| 3 | 全稿改字 | text_replace | 替换结果 |
| 4 | 文字审核 | slide_read → 分析 | 回复 |
| 5 | 口播稿写入备注 | notes_set | 备注内容 |
| 6 | 美化统一 | format_uniform | 触及数 |
| 7 | 移页+加页 | slide_move + slide_add | 页序 |
| 8 | 插入图片 | picture_add | 图片可见 |
| 9 | 表格页 | table_add | 表格内容 |
| 10 | 跨宿主取数 | spreadsheet.range_read → slide_add | 跨宿主 pin |
| 11 | 单页导出 PNG | slide_export_image | 文件 |
| 12 | 整套导出 PDF | export | 文件 |

### 第八阶段 · 三级生图（WPP 宿主）

| 级 | 测试 | 预期 |
|----|------|------|
| web | image_search → picture_add | 图片插入 |
| model | generate_image → picture_add | 插画插入 |
| svg | svg_add（模型内联 SVG）→ picture_add | 矢量插入 |
| 降级 | generate_image 失败（删 image-gen.json）→ 自动 svg_add | 矢量兜底 |

### 第九阶段 · 跨宿主与会话隔离

1. 文档 A 发消息建会话 → 切文档 B → B 应为空/独立会话
2. 切回 A → A 的对话应回显
3. 跨宿主写（ET 读 → WPP 写）→ pin 探针自动触发，写入正确文件
4. 对话↔文档绑定：构造 docId 错配 → DOC_MISMATCH 拒绝
5. 绑定指示器：切文档 → 指示器文字实时变化

### 第十阶段 · 稳定性与安全

1. 安全脱密：选中含敏感词文本 → declassify_preview → 确认脱密建议
2. 审计日志：`~/.config/chayuan-wps/mcp/audit.jsonl` 有本次操作记录
3. 容量预算：构造 >200KB 会话 → 裁剪生效
4. 侧车重启：`systemctl/launchctl restart` → agent 30s 内重注册
5. WPS 重启：完全退出 → 重开 → 加载项自动加载（处理信任弹窗）

### 第十一阶段 · 发布检查单

- [ ] 全部单元测试通过
- [ ] 24 场景自动化 PASS
- [ ] 三宿主 ribbon + 面板助手列表正常
- [ ] 三级生图全通（或已知限制记录）
- [ ] 跨宿主 pin + 守卫通过
- [ ] 会话隔离 + 回显通过
- [ ] 脱密/安全无回归
- [ ] 审计日志覆盖完整
- [ ] 版本号一致性（package.json = staging 目录 = publish.xml）
- [ ] 已知限制文档已更新

---

### 第十点五阶段 · 补充维度（易遗漏项）

| 维度 | 测试内容 | 方法 |
|------|---------|------|
| 粘贴功能 | 设置窗 API 密钥/API 地址粘贴按钮三通道 | 点击粘贴按钮 → Key 填入 |
| 剪贴板安全 | /clipboard 端点 token 门禁 | 无 token → 401 |
| 多模态生成 | 文本转图像/语音/视频（面板助手） | 面板助手点击 → 任务执行 |
| 模板功能 | 文档模板加载与填充 | 模板入口 → 填充测试 |
| 规则库/星标 | 规则库面板加载 / 星标提示触发 | 功能入口检查 |
| 审计日志 | audit.jsonl 有本次操作记录 | `tail audit.jsonl` |
| 容量预算 | >200KB 会话裁剪 / >100 条裁剪 / LRU 驱逐 | 构造超限数据验证 |
| 侧车生命周期 | launchd/systemd 重启后 agent 30s 内重注册 | kill → 等 → status |
| 写穿持久层 | PluginStorage → sidecar /session-store 同步 | 检查 session-store/*.json |
| 宿主切换 | 切宿主标签 → 助手列表/模型/指示器自动切换 | UI 操作验证 |
| 对话绑定指示器 | 输入框上方显示当前绑定文档名 | 切文档看指示器变化 |
| 升级安装 | 覆盖安装后"已被修改"弹窗点确定 → 正常加载 | 部署后重启验证 |
| 版本一致性 | package.json = staging = publish.xml | 脚本自动比对 |
| WPS 兼容 | Mac WPS 12.1.x / Linux WPS 12.1.2 / Windows WPS（如有） | 逐平台验证 |

## 已知限制（测试时注意，非缺陷）

- dev:debug 模式 TaskPane 打不开（CreateTaskPane 超时）——生产安装正常
- dev 模式 ribbon 按钮图标 '?'——vite 图片路径差异，生产安装正常
- ET 宿主会话 scope 探测需 ActiveWorkbook 属性——Windows ET 某些版本返回 undefined
- Mac WPS 重启后"已被修改"弹窗需手动点确定——jsaddons 覆盖部署的固有时序
- PluginStorage 不跨 WPS 重启持久化——会话数据在 WPS 关闭后清空（设计如此，靠 sidecar 写穿持久层兜底）

## VM 真机测试补充

VM（Ubuntu ARM / WPS Linux 12.1.2）额外注意：
- jsplugins.xml 与 publish.xml 版本必须一致（WPS 按前者找目录）
- 同目录覆盖升级需 bump 版本号换新路径（CEF file:// 缓存会钉住旧 chunk）
- xdotool 坐标基于 1280×800（VM 屏幕分辨率）
- IME 需切英文（`ibus engine xkb:us::eng`）才能 xdotool type ASCII
- WPS Linux 启动后等 25s 才加载加载项（信任弹窗需逐个点确定）

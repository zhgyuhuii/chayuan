# 模型选择功能说明

## 问题解决方案

### 1. 图标显示问题 ✅
**原因分析**：
- WPS 的 `dynamicMenu` 控件不支持 `getLabel` 和 `getImage` 回调
- 图标白名单限制导致大部分模型使用通用图标
- 图标路径解析问题

**解决方案**：
- ✅ 改用 **splitButton + menu** 结构（Office Ribbon 标准做法）
- ✅ 创建了 **19 个本地 SVG 图标**（`public/images/models/`）
- ✅ 移除白名单限制，所有模型直接使用各自图标
- ✅ 使用相对路径（WPS 会自动解析）

### 2. 回显不生效问题 ✅
**原因分析**：
- `dynamicMenu` 不支持按钮状态回显
- 需要使用 `splitButton` 结构

**解决方案**：
- ✅ 使用 `splitButton` 包含主按钮和下拉菜单
- ✅ 主按钮通过 `getLabel` 和 `getImage` 回调显示当前选中模型
- ✅ 选择模型后调用 `InvalidateControl` 刷新按钮状态

## 技术实现

### Ribbon XML 结构
```xml
<splitButton id="splitBtnModelSelect" size="large">
    <button id="btnModelSelect" 
            getLabel="ribbon.GetModelMenuLabel"
            getImage="ribbon.GetImage"
            onAction="ribbon.OnAction"/>
    <menu id="menuModelSelect" 
          getContent="ribbon.GetModelMenuContent"
          invalidateContentOnDrop="true"/>
</splitButton>
```

### 图标资源
已创建的模型图标（`public/images/models/`）：
- ✅ openai.svg - OpenAI 系列（GPT-4、GPT-3.5 等）
- ✅ claude.svg - Anthropic Claude 系列
- ✅ gemini.svg - Google Gemini 系列
- ✅ deepseek.svg - DeepSeek 系列
- ✅ doubao.svg - 字节豆包系列
- ✅ qwen.svg - 阿里通义千问系列
- ✅ wenxin.svg - 百度文心系列
- ✅ chatglm.svg - 智谱 ChatGLM 系列
- ✅ kimi.svg - 月之暗面 Kimi 系列
- ✅ yi.svg - 零一万物 Yi 系列
- ✅ baichuan.svg - 百川大模型
- ✅ mistral.svg - Mistral 系列
- ✅ llama.svg - Meta Llama 系列
- ✅ hunyuan.svg - 腾讯混元
- ✅ xinghuo.svg - 讯飞星火
- ✅ minimax.svg - MiniMax
- ✅ step.svg - 阶跃星辰
- ✅ grok.svg - xAI Grok
- ✅ perplexity.svg - Perplexity

### 回调函数
1. **GetModelMenuLabel(control)** - 返回当前选中模型名称
2. **GetImage(control)** - 返回当前选中模型图标
3. **GetModelMenuContent(control)** - 动态生成下拉菜单项
4. **OnModelToggle(control, pressed)** - 处理模型选择并刷新回显

## 使用效果

1. **主按钮显示**：显示当前选中的模型名称和图标
2. **下拉菜单**：列出所有可用模型，每个模型带图标
3. **单选行为**：使用 toggleButton 实现 radio 效果
4. **自动回显**：选择后主按钮立即更新显示

## 扩展说明

### 添加新模型
1. 在 `DEFAULT_MODELS` 数组中添加模型配置
2. 在 `public/images/models/` 下添加对应 SVG 图标
3. 图标命名与 `icon` 字段路径一致

### 自定义图标
- 所有图标都是 24x24 的 SVG 格式
- 使用圆形背景 + 文字/图形的简洁设计
- 可以替换为品牌官方图标以获得更好效果

## 测试建议

1. 启动 WPS 加载插件
2. 查看 Ribbon 上的模型选择按钮
3. 点击下拉箭头查看所有模型列表（带图标）
4. 选择任一模型，观察主按钮是否更新为该模型名称和图标
5. 重新打开文档，验证选中状态是否保持

## 注意事项

- 图标文件必须放在 `public/images/models/` 目录
- 打包时确保图标文件被正确复制到 dist 目录
- 如果图标不显示，检查浏览器控制台是否有 404 错误

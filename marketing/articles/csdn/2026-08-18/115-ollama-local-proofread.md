# Ollama 本地跑校对：显存、上下文、速度的实用建议

单位明确了红线：文稿数据不能出域。云端 API 再好用也与你无关，剩下的问题只有一个——本地模型能把校对这个活干到什么程度。DeepSeek、Qwen 这些国产模型本地部署的教程满大街都是，但讲文档校对场景下显存、上下文、速度怎么平衡的很少。我用 Ollama 加察元AI文档助手跑了两个月，把经验整理成一篇教程。

## 第零步：先把察元装好

Windows 用 PowerShell 一行命令（脚本会自动处理老版本 PowerShell 的编码问题）：

```powershell
& {[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$w=New-Object Net.WebClient;$w.Encoding=[Text.Encoding]::UTF8;$s=$w.DownloadString('https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.ps1');if($s.Length -and $s[0]-eq[char]0xFEFF){$s=$s.Substring(1)};& ([scriptblock]::Create($s)) -Fetch}
```

macOS 和 Linux 用 curl：

```bash
curl -fsSL https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.sh | bash -s -- --fetch
```

下载源是 Gitee、aidooo、GitHub 多源回退，带 sha256 强校验；加载项、本机 MCP 服务、技能投放一个脚本全办完，服务是单文件二进制，不需要装 Node.js。装完脚本还会自动跑四级体检，从 jsaddons 注册、/healthz 到 initialize 握手、工具桥接逐层验证，哪层出问题终端里直接亮出来。

## 第一步：装 Ollama，拉一个校对模型

```
ollama pull qwen2.5:7b
```

Qwen、DeepSeek 系列的量化版都能跑，起手建议 7B 级，跑顺了再按需升降档，别一上来就挑战大模型。拉完记一下模型标签名，后面在察元里配置模型时要填的就是它。

## 第二步：在察元里配 OpenAI 兼容端点

察元的设计取向是离线内网优先，支持任意 OpenAI 兼容端点，Ollama、LM Studio、Xinference、OneAPI、New API 都行。Ollama 自带 OpenAI 兼容层，默认地址一般是 http://127.0.0.1:11434/v1，填进察元的模型配置即可。配完先确认本机 MCP 服务在线：

```
curl http://127.0.0.1:62588/healthz
```

返回 online 说明加载项和本机服务都活着。端口 62588 只监听 127.0.0.1，不出本机，本机即信任边界，不用配 Token。

## 第三步：显存档位怎么选

经验量级（量化后的粗略参考）：3B 级模型 4GB 显存能跑，7B 级要 8GB 上下，14B 级 12 到 16GB，再往上就是 24GB 级显卡的地盘。校对任务的特点是高频、零碎、批量大，7B 级是甜点位：显存压力小、吞吐可接受、错别字和明显语病的召回够用。核显或纯 CPU 也能跑，速度换隐私，多数单位能接受这个交换。

## 第四步：上下文别硬塞，用分块

本地模型的上下文窗口普遍不如云端旗舰，硬塞长文要么截断要么变慢。察元这边的正确姿势是：先调 `document_meta` 看字数和"是否建议分块"；`document_get_text` 超过约 80k 就别强取（除非 force:true），改用 `document_chunks` 按 cursor/limit 分页喂给模型。分块之后，小上下文的模型也能稳定处理长文档，这是本地部署最实用的一招，比换大模型省钱得多。还有个隐性好处：哪一块跑失败了只需重试当前块，不用整篇从头再来。

## 第五步：速度优化三招

一是先 dryRun 小样试跑：

```
先跑一遍校对（dryRun），汇总问题列表，不要先改正文；我确认后再写成批注
```

`proofread_run` 默认只返回问题列表不写回，拿一节先测速度和误报率，再决定全文跑不跑，避免整篇跑完才发现模型不合适。二是长任务走异步，`proofread_job_poll` 轮询结果，别在界面上干等。三是错峰跑批量，中午休息时间让显卡加班，人回来正好收结果。

## 第六步：让智能体也走本地链路

配好之后不止加载项能用。Claude Code 一条命令接上察元，整条"读文档、跑校对、写批注"的调用链同样落在本机：

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

这样敏感文稿交给智能体处理也不出域，红线和效率终于不用二选一。

## 边界与心得

如实说，本地模型的误报率客观上高于云端旗舰，批注只是建议，落盘前要人工过目，这一步省不掉。误报也有套路可治：反复误报的词，用编审里的模板与规则功能收进规则文件，比一次次人工删批注划算。我的结论是：日常校对完全可以用本地 7B 顶着，数据不出域这条红线换来的是安心；速度损失用分块和异步摊薄，多数场景够用。真到发正式文件前的终检，再考虑更强的模型或人工加码，分级对待比一刀切聪明。

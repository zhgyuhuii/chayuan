#!/usr/bin/env node
// 读 manifest.csv 批量生成 9:16 竖版 SVG 封面：covers/001.svg ... 100.svg
// 纯文本生成，无需外部渲染工具。字体走系统中文回退。
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const csv = fs.readFileSync(path.join(ROOT, 'manifest.csv'), 'utf8').trim().split(/\r?\n/);
const header = csv.shift().split(',');
const rows = csv.map(line => {
  const c = line.split(',');
  const o = {};
  header.forEach((h, i) => (o[h] = c[i]));
  return o;
});

// 系列主色（深色，配白字）
const SERIES_COLOR = {
  A: ['#1e3a8a', '#0b1f4d'], // 政务公文合规
  B: ['#334155', '#1a2230'], // 合同法务
  C: ['#0f766e', '#06302c'], // 标书投标
  D: ['#4338ca', '#221b6b'], // 通用写作提效
  E: ['#6d28d9', '#37146e'], // 摘要会议纪要
  F: ['#0e7490', '#063846'], // 翻译多语言
  G: ['#047857', '#023a2b'], // 知识库RAG
  H: ['#92400e', '#4a2107'], // 批量处理
  I: ['#a21caf', '#530e58'], // 多模态
  J: ['#9f1239', '#50091d'], // 部署信任开源
};

const W = 1080, H = 1920;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 按每行最多 n 个汉字折行
function wrap(title, perLine) {
  const out = [];
  for (let i = 0; i < title.length; i += perLine) out.push(title.slice(i, i + perLine));
  return out;
}

let count = 0;
for (const r of rows) {
  const [c1, c2] = SERIES_COLOR[r.series_code] || ['#222', '#000'];
  const lines = wrap(r.title, 7);
  const titleStartY = 980 - (lines.length - 1) * 60;
  const titleTspans = lines
    .map((ln, i) => `<text x="90" y="${titleStartY + i * 120}" font-size="96" font-weight="800" fill="#ffffff" font-family="'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',sans-serif">${esc(ln)}</text>`)
    .join('\n    ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <!-- 顶部品牌 -->
  <text x="90" y="180" font-size="56" font-weight="800" fill="#ffffff" font-family="'Microsoft YaHei','PingFang SC',sans-serif">察元 AI</text>
  <text x="90" y="240" font-size="34" fill="#ffffffcc" font-family="'Microsoft YaHei','PingFang SC',sans-serif">AI 办公助手 · 就在你写文档的页面里</text>
  <!-- 编号 -->
  <text x="90" y="560" font-size="240" font-weight="900" fill="#ffffff22" font-family="Arial,sans-serif">${r.id}</text>
  <!-- 系列标签 -->
  <rect x="90" y="600" rx="36" ry="36" width="${260 + r.series_name.length * 38}" height="72" fill="#ffffff22"/>
  <text x="126" y="650" font-size="40" font-weight="700" fill="#ffffff" font-family="'Microsoft YaHei','PingFang SC',sans-serif">${esc(r.series_code)} · ${esc(r.series_name)}</text>
  <!-- 标题 -->
  ${titleTspans}
  <!-- 受众 / 时长 -->
  <text x="90" y="1180" font-size="40" fill="#ffffffdd" font-family="'Microsoft YaHei','PingFang SC',sans-serif">面向 ${esc(r.audience)} · 时长约 ${esc(r.duration_s)}s · 竖屏 9:16</text>
  <!-- 底部 CTA -->
  <rect x="0" y="1740" width="${W}" height="180" fill="#00000033"/>
  <text x="90" y="1815" font-size="40" font-weight="700" fill="#ffffff" font-family="'Microsoft YaHei','PingFang SC',sans-serif">官网 aidooo.com</text>
  <text x="90" y="1875" font-size="34" fill="#ffffffcc" font-family="'Microsoft YaHei','PingFang SC',sans-serif">Apache 2.0 开源 · 出品：北京智灵鸟科技中心</text>
</svg>
`;
  fs.writeFileSync(path.join(ROOT, 'covers', `${r.id}.svg`), svg, 'utf8');
  count++;
}
console.log(`生成封面 ${count} 张 -> covers/`);

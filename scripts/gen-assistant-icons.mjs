// 生成 public/images/assistants/ 语义图标（与既有 24 枚同风格：24×24 圆角底 + 白色矢量字形）
// 用法: node scripts/gen-assistant-icons.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'images', 'assistants')

const SBASE = 'stroke="white" fill="none" stroke-linecap="round" stroke-linejoin="round"'
const S = SBASE + ' stroke-width="1.7"'
const sw = (n) => SBASE + ` stroke-width="${n}"`
const SOFT = 'fill="white" opacity="0.85"'
const SOFT2 = 'fill="white" opacity="0.55"'
const ACC = '#FCD34D'

// ── 字形库：每个字形返回 inner SVG（坐标系 24×24，背景矩形之外） ──
const glyphs = {
  arrowsUpDown: () => `<path d="M9 6 L9 18 M9 6 L6.8 8.5 M9 6 L11.2 8.5" ${S}/><path d="M15 18 L15 6 M15 18 L12.8 15.5 M15 18 L17.2 15.5" ${S}/>`,
  receipt: () => `<path d="M6.5 4.5 H17.5 V19 L15.8 17.6 L14 19 L12 17.6 L10 19 L8.2 17.6 L6.5 19 Z" ${S}/><path d="M9 8.5 H15 M9 11.5 H15 M9 14.5 H12.5" ${sw(1.3)}/>`,
  barChart3: () => `<rect x="5.5" y="12" width="3.4" height="6.5" rx="0.8" ${SOFT}/><rect x="10.3" y="9" width="3.4" height="9.5" rx="0.8" ${SOFT}/><rect x="15.1" y="5.5" width="3.4" height="13" rx="0.8" fill="${ACC}"/>`,
  downTrend: () => `<path d="M5 8 L10 13 L13 10.5 L19 16.5" ${S}/><path d="M19 16.5 L19 12.8 M19 16.5 L15.3 16.5" ${S}/><circle cx="7" cy="10" r="1.6" fill="${ACC}"/>`,
  scaleBalance: () => `<path d="M12 5 V19 M8 19.5 H16 M5 8 H19" ${S}/><path d="M5 8 L3.2 12 A2.6 2.6 0 0 0 6.8 12 Z" ${SOFT}/><path d="M19 8 L17.2 12 A2.6 2.6 0 0 0 20.8 12 Z" ${SOFT}/>`,
  speechBubble: () => `<path d="M4.5 6.5 A2 2 0 0 1 6.5 4.5 H17.5 A2 2 0 0 1 19.5 6.5 V13.5 A2 2 0 0 1 17.5 15.5 H10 L5.5 19.5 V15.5 H6.5 A2 2 0 0 1 4.5 13.5 Z" ${SOFT}/><circle cx="9" cy="10" r="1.1" fill="#0EA5E9"/><circle cx="12.5" cy="10" r="1.1" fill="#0EA5E9"/><circle cx="16" cy="10" r="1.1" fill="#0EA5E9"/>`,
  packageBox: () => `<path d="M5 8.5 L12 5 L19 8.5 V15.5 L12 19 L5 15.5 Z" ${SOFT}/><path d="M5 8.5 L12 12 L19 8.5 M12 12 V19" ${sw(1.3)}/>`,
  clock: () => `<circle cx="12" cy="12" r="7.5" ${S}/><path d="M12 7.5 V12 L15.2 14" ${S}/>`,
  banknote: () => `<rect x="4" y="7.5" width="16" height="9" rx="1.5" ${S}/><circle cx="12" cy="12" r="2.6" ${sw(1.4)}/><path d="M6.8 10 V14 M17.2 10 V14" ${sw(1.3)}/>`,
  peopleTwo: () => `<circle cx="9" cy="8.5" r="2.6" ${SOFT}/><path d="M4.5 18.5 A4.5 4.5 0 0 1 13.5 18.5" ${S}/><circle cx="16" cy="8" r="2.2" ${SOFT2}/><path d="M14.5 13.6 A4.3 4.3 0 0 1 19.8 17.8" ${sw(1.4)}/>`,
  medal: () => `<path d="M8.5 4.5 L11 9.5 M15.5 4.5 L13 9.5" ${S}/><circle cx="12" cy="13.5" r="4.6" ${SOFT}/><path d="M12 11.2 L12.9 13 L14.5 13.2 L13.3 14.4 L13.6 16 L12 15.2 L10.4 16 L10.7 14.4 L9.5 13.2 L11.1 13 Z" fill="${ACC}"/>`,
  crystalBall: () => `<circle cx="12" cy="10" r="5.5" ${S}/><path d="M8.5 18.5 H15.5 M10 15.8 V18.5 M14 15.8 V18.5" ${sw(1.4)}/><path d="M12 7.2 L12.8 9.2 L14.8 9.5 L13.3 11 L13.6 13 L12 12 L10.4 13 L10.7 11 L9.2 9.5 L11.2 9.2 Z" fill="${ACC}"/>`,
  contactsCard: () => `<rect x="4" y="5.5" width="16" height="13" rx="1.8" ${S}/><circle cx="9" cy="11" r="1.9" ${sw(1.4)}/><path d="M6.3 16.2 A2.9 2.9 0 0 1 11.7 16.2" ${sw(1.4)}/><path d="M13.8 9.5 H17.5 M13.8 12.3 H17.5 M13.8 15.1 H16" ${sw(1.3)}/>`,
  funnel: () => `<path d="M4.5 5.5 H19.5 L14.5 12 V18 L9.5 20 V12 Z" ${SOFT}/><path d="M7 8.5 H17" stroke="#0EA5E9" stroke-width="1.4" stroke-linecap="round"/>`,
  mapRegion: () => `<path d="M4.5 7 L9 5 L14.5 7 L19.5 5 V17 L14.5 19 L9 17 L4.5 19 Z" ${sw(1.4)}/><circle cx="12" cy="11.5" r="2.2" fill="${ACC}"/><path d="M12 13.5 A0 0" ${sw(0)}/>`,
  clipboardList: () => `<rect x="5.5" y="5" width="13" height="15" rx="1.8" ${SOFT}/><rect x="9" y="3.5" width="6" height="3" rx="1" fill="white"/><path d="M8.3 10.5 H15.7 M8.3 13.3 H15.7 M8.3 16.1 H13" stroke="${ACC}" stroke-width="1.4" stroke-linecap="round"/>`,
  house: () => `<path d="M4.5 11.5 L12 4.5 L19.5 11.5" ${S}/><path d="M6.5 10.5 V19 H17.5 V10.5" ${S}/><rect x="10.4" y="14" width="3.2" height="5" rx="0.5" fill="${ACC}"/>`,
  rulerTriangle: () => `<path d="M5.5 18.5 L18.5 18.5 L18.5 5.5 Z" ${S}/><path d="M9 18.5 L9 15.8 M12.2 18.5 L12.2 13 M15.4 18.5 L15.4 10.2" ${sw(1.2)}/>`,
  dice: () => `<rect x="5" y="5" width="14" height="14" rx="3" ${SOFT}/><circle cx="9.2" cy="9.2" r="1.3" fill="#0EA5E9"/><circle cx="14.8" cy="14.8" r="1.3" fill="#0EA5E9"/><circle cx="14.8" cy="9.2" r="1.3" fill="#0EA5E9"/><circle cx="9.2" cy="14.8" r="1.3" fill="#0EA5E9"/>`,
  calendar: () => `<rect x="4.5" y="6" width="15" height="13.5" rx="1.8" ${SOFT}/><path d="M4.5 10 H19.5" stroke="#0EA5E9" stroke-width="1.4"/><path d="M8.5 4 V7.5 M15.5 4 V7.5" ${sw(1.5)}/><rect x="8" y="12.5" width="2.4" height="2.2" rx="0.4" fill="${ACC}"/>`,
  mergeGrid: () => `<rect x="4" y="4.5" width="7" height="7" rx="1" ${sw(1.3)}/><rect x="13" y="4.5" width="7" height="7" rx="1" ${sw(1.3)}/><path d="M7.5 14.5 H16.5 M12 11.8 V17.2" ${S}/><rect x="8.5" y="16" width="7" height="4.5" rx="1" fill="${ACC}"/>`,
  versusPanel: () => `<rect x="3.5" y="6" width="7.2" height="12" rx="1.5" ${sw(1.3)}/><rect x="13.3" y="6" width="7.2" height="12" rx="1.5" ${sw(1.3)}/><text x="12" y="14.5" font-size="6.5" font-weight="bold" fill="${ACC}" text-anchor="middle">VS</text>`,
  globe: () => `<circle cx="12" cy="12" r="7.5" ${S}/><ellipse cx="12" cy="12" rx="3.4" ry="7.5" ${sw(1.2)}/><path d="M4.5 12 H19.5" ${sw(1.2)}/>`,
  shield: () => `<path d="M12 4 L18.5 6.2 V11.5 C18.5 15.8 15.8 18.6 12 20 C8.2 18.6 5.5 15.8 5.5 11.5 V6.2 Z" ${SOFT}/><path d="M9 11.8 L11.2 14 L15.2 9.8" stroke="#0EA5E9" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  scissors: () => `<circle cx="7" cy="7.5" r="2.4" ${sw(1.4)}/><circle cx="7" cy="16.5" r="2.4" ${sw(1.4)}/><path d="M9 9 L19 16.5 M9 15 L19 7.5" ${S}/>`,
  splitSheet: () => `<rect x="4.5" y="4.5" width="15" height="15" rx="1.5" ${sw(1.3)}/><path d="M12 4.5 V19.5 M4.5 12 H19.5" stroke="white" stroke-width="1.1" stroke-dasharray="2 1.6"/><circle cx="12" cy="12" r="1.6" fill="${ACC}"/>`,
  drawers: () => `<rect x="5" y="4.5" width="14" height="15" rx="1.8" ${S}/><path d="M5 12 H19" ${sw(1.3)}/><path d="M10 8.2 H14 M10 15.8 H14" ${sw(1.5)}/>`,
  bulb: () => `<circle cx="12" cy="10" r="4.8" ${SOFT}/><path d="M9.8 16.8 H14.2 M10.4 19 H13.6" ${sw(1.5)}/><path d="M12 8 L12.9 10 L11.1 10 Z" fill="${ACC}"/><path d="M4 6.5 L5.6 7.6 M20 6.5 L18.4 7.6" ${sw(1.4)}/>`,
  sparkles: () => `<path d="M10 4.5 L11.6 9.4 L16.5 11 L11.6 12.6 L10 17.5 L8.4 12.6 L3.5 11 L8.4 9.4 Z" fill="white"/><path d="M16.8 14.2 L17.6 16.4 L19.8 17.2 L17.6 18 L16.8 20.2 L16 18 L13.8 17.2 L16 16.4 Z" fill="${ACC}"/>`,
  alertMark: () => `<path d="M12 4.5 L20 18.5 H4 Z" ${SOFT}/><path d="M12 9.5 V13.8" stroke="#EF4444" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.3" r="1" fill="#EF4444"/>`,
  inboxTray: () => `<path d="M4.5 13.5 H8.5 L10.5 16 H13.5 L15.5 13.5 H19.5" ${S}/><path d="M4.5 13.5 L6.5 5.5 H17.5 L19.5 13.5 V18 A1.5 1.5 0 0 1 18 19.5 H6 A1.5 1.5 0 0 1 4.5 18 Z" ${sw(1.4)}/><path d="M12 7.5 V12.5 M12 12.5 L9.8 10.3 M12 12.5 L14.2 10.3" ${sw(1.5)}/>`,
  megaphone: () => `<path d="M4.5 10.5 V13.5 A1.5 1.5 0 0 0 6 15 H8 L14 19 V5 L8 9 H6 A1.5 1.5 0 0 0 4.5 10.5 Z" ${SOFT}/><path d="M16.5 9 A4.5 4.5 0 0 1 16.5 15" ${sw(1.5)}/><path d="M18.8 7 A7.5 7.5 0 0 1 18.8 17" ${sw(1.3)}/>`,
  newspaper: () => `<rect x="4" y="5.5" width="16" height="13" rx="1.5" ${S}/><rect x="6.5" y="8" width="6" height="4.5" rx="0.6" fill="${ACC}"/><path d="M14.5 8.5 H17.5 M14.5 11 H17.5 M6.5 15.2 H17.5" ${sw(1.3)}/>`,
  checkCircle: () => `<circle cx="12" cy="12" r="7.8" ${SOFT}/><path d="M8.3 12.2 L11 14.8 L15.8 9.5" stroke="#10B981" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  returnArrow: () => `<path d="M9 5.5 L4.5 10 L9 14.5" ${S}/><path d="M4.5 10 H14.5 A4.5 4.5 0 0 1 19 14.5 V15 A4.5 4.5 0 0 1 14.5 19.5 H9" ${S}/><circle cx="17.5" cy="8" r="1.6" fill="${ACC}"/>`,
  target: () => `<circle cx="12" cy="12" r="7.5" ${sw(1.4)}/><circle cx="12" cy="12" r="4.3" ${sw(1.4)}/><circle cx="12" cy="12" r="1.6" fill="${ACC}"/>`,
  key: () => `<circle cx="8.5" cy="12" r="3.6" ${S}/><path d="M12.1 12 H19.5 M16.5 12 V15 M19 12 V14" ${S}/><circle cx="8.5" cy="12" r="1.2" fill="${ACC}"/>`,
  doorTurnover: () => `<rect x="6" y="4.5" width="11" height="15" rx="1" ${S}/><path d="M6 19.5 H19.5" ${sw(1.4)}/><circle cx="14.2" cy="12" r="1" fill="${ACC}"/><path d="M3.5 8 V16" ${sw(1.3)}/>`,
  medicalCross: () => `<path d="M9.2 4.5 H14.8 V9.2 H19.5 V14.8 H14.8 V19.5 H9.2 V14.8 H4.5 V9.2 H9.2 Z" ${SOFT}/><circle cx="12" cy="12" r="1.6" fill="#EF4444"/>`,
  perfBars: () => `<path d="M5 7.5 H15 M5 12 H12.5 M5 16.5 H17.5" ${sw(1.8)}/><rect x="17" y="5.5" width="3" height="13" rx="0.8" fill="${ACC}" opacity="0.9"/>`,
  factory: () => `<path d="M4.5 19 V9.5 L9.5 12.5 V9.5 L14.5 12.5 V6.5 H19.5 V19 Z" ${SOFT}/><rect x="7" y="15.5" width="2.6" height="3.5" rx="0.5" fill="#475569"/><rect x="12" y="15.5" width="2.6" height="3.5" rx="0.5" fill="#475569"/><path d="M16 9.5 H18" stroke="${ACC}" stroke-width="1.4" stroke-linecap="round"/>`,
  bankColumns: () => `<path d="M4.5 9 L12 4.5 L19.5 9 Z" ${sw(1.4)}/><path d="M6.5 10.5 V16.5 M10.2 10.5 V16.5 M13.8 10.5 V16.5 M17.5 10.5 V16.5" ${sw(1.6)}/><path d="M4.5 18.5 H19.5" ${sw(1.8)}/>`,
  storefront: () => `<path d="M5 5 H19 L20 9 A2.3 2.3 0 0 1 15.5 9.6 A2.3 2.3 0 0 1 11 9.6 A2.3 2.3 0 0 1 6.5 9.6 A2.3 2.3 0 0 1 4 9 Z" ${SOFT}/><path d="M5.5 11.5 V19 H18.5 V11.5" ${sw(1.4)}/><rect x="13.5" y="14" width="3.4" height="5" rx="0.5" fill="${ACC}"/>`,
  handshake: () => `<path d="M3.5 9.5 L7 7.5 L12 10.5 L17 7.5 L20.5 9.5" ${sw(1.5)}/><path d="M7 7.5 V15 L12 18.5 L17 15 V7.5" ${sw(1.5)}/><path d="M9.8 12.5 L12 14.2 L14.2 12.5" ${sw(1.4)}/>`,
  suitcase: () => `<rect x="4.5" y="8" width="15" height="11" rx="2" ${SOFT}/><path d="M9.5 8 V6.2 A1.2 1.2 0 0 1 10.7 5 H13.3 A1.2 1.2 0 0 1 14.5 6.2 V8" ${sw(1.4)}/><path d="M8 8 V19 M16 8 V19" stroke="#94A3B8" stroke-width="1.2"/>`,
  dumbbell: () => `<path d="M8 12 H16" ${sw(2)}/><rect x="4.5" y="7.5" width="3" height="9" rx="1.2" ${SOFT}/><rect x="16.5" y="7.5" width="3" height="9" rx="1.2" ${SOFT}/><circle cx="18" cy="6" r="1.5" fill="${ACC}"/>`,
  flagWave: () => `<path d="M6 4 V20" ${sw(1.8)}/><path d="M6 5 C9.5 3.5 12.5 6.5 17.5 5 V12.5 C12.5 14 9.5 11 6 12.5 Z" fill="${ACC}"/>`,
  scrollDoc: () => `<path d="M7 4.5 H16 A2 2 0 0 1 18 6.5 V17.5 A2 2 0 0 1 16 19.5 H8 A2 2 0 0 1 6 17.5 V6 A1.5 1.5 0 0 1 7.5 4.5 Z" ${SOFT}/><path d="M9 8.5 H15 M9 11.5 H15 M9 14.5 H12.5" stroke="${ACC}" stroke-width="1.3" stroke-linecap="round"/><circle cx="17.8" cy="18.2" r="1.8" fill="white" opacity="0.7"/>`,
  housesRow: () => `<path d="M3.5 11 L8 7 L12.5 11" ${sw(1.4)}/><path d="M5 10.5 V18 H11 V10.5" ${sw(1.4)}/><path d="M12 11 L16 7.5 L20.5 11.5" ${sw(1.4)}/><path d="M13.5 11 V18 H19 V11.5" ${sw(1.4)}/><rect x="7.2" y="14" width="2.4" height="4" rx="0.4" fill="${ACC}"/>`,
  briefcase: () => `<rect x="4" y="8" width="16" height="11" rx="1.8" ${SOFT}/><path d="M9.5 8 V6.5 A1.5 1.5 0 0 1 11 5 H13 A1.5 1.5 0 0 1 14.5 6.5 V8" ${sw(1.4)}/><rect x="10.5" y="12" width="3" height="2.4" rx="0.5" fill="${ACC}"/>`,
  crossedTools: () => `<path d="M5 5 L19 19 M19 5 L5 19" ${S}/><path d="M4 16.5 L7.5 20 M20 16.5 L16.5 20" ${sw(1.4)}/><circle cx="12" cy="12" r="1.7" fill="${ACC}"/>`,
  compassNeedle: () => `<circle cx="12" cy="12" r="7.8" ${S}/><path d="M15.5 8.5 L13.2 13.2 L8.5 15.5 L10.8 10.8 Z" fill="${ACC}"/><circle cx="12" cy="12" r="1" fill="white"/>`,
  refreshCycle: () => `<path d="M18.5 9 A7 7 0 0 0 6 8" ${S}/><path d="M6 4.5 V8 H9.5" ${sw(1.4)}/><path d="M5.5 15 A7 7 0 0 0 18 16" ${S}/><path d="M18 19.5 V16 H14.5" ${sw(1.4)}/>`,
  bricksWall: () => `<rect x="4" y="5" width="16" height="14" rx="1" ${sw(1.3)}/><path d="M4 9.8 H20 M4 14.6 H20" ${sw(1.2)}/><path d="M9.3 5 V9.8 M14.6 5 V9.8 M6.6 9.8 V14.6 M12 9.8 V14.6 M17.3 9.8 V14.6 M9.3 14.6 V19 M14.6 14.6 V19" ${sw(1.2)}/>`,
  schoolHouse: () => `<path d="M4.5 11.5 L12 5 L19.5 11.5" ${sw(1.5)}/><path d="M6.5 10.5 V19 H17.5 V10.5" ${sw(1.4)}/><path d="M12 5 V3 M12 3 H15 L13.8 4.2 L15 5.4 H12" fill="${ACC}"/><rect x="10.4" y="14.5" width="3.2" height="4.5" rx="0.5" fill="white" opacity="0.85"/>`,
  gradCap: () => `<path d="M12 5.5 L21 9.5 L12 13.5 L3 9.5 Z" ${SOFT}/><path d="M7 11.5 V15.5 C7 17 9.3 18.3 12 18.3 C14.7 18.3 17 17 17 15.5 V11.5" ${sw(1.4)}/><path d="M21 9.5 V14.5" ${sw(1.4)}/><circle cx="21" cy="15.3" r="1.1" fill="${ACC}"/>`,
  questionMark: () => `<circle cx="12" cy="12" r="7.8" ${SOFT}/><path d="M9.3 9.5 A2.7 2.7 0 1 1 12 13.2 V14.8" stroke="#0EA5E9" stroke-width="1.9" fill="none" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.1" fill="#0EA5E9"/>`,
  familyGroup: () => `<circle cx="7.5" cy="8" r="2.2" ${sw(1.4)}/><circle cx="16.5" cy="8" r="2.2" ${sw(1.4)}/><circle cx="12" cy="10.5" r="1.8" fill="${ACC}"/><path d="M3.8 18 A3.8 3.8 0 0 1 11.2 18 M12.8 18 A3.8 3.8 0 0 1 20.2 18" ${sw(1.4)}/>`,
  appleFruit: () => `<path d="M12 8.5 C9 6.5 5.5 8.5 5.5 12.5 C5.5 16.5 8.5 19.5 12 19 C15.5 19.5 18.5 16.5 18.5 12.5 C18.5 8.5 15 6.5 12 8.5 Z" ${SOFT}/><path d="M12 8.5 C12 6.8 13 5.5 14.5 5" ${sw(1.4)}/><path d="M14.5 6.5 C16 6 17 6.8 17.2 8 C15.8 8.5 14.8 7.8 14.5 6.5 Z" fill="${ACC}"/>`,
  structureNodes: () => `<rect x="9" y="4" width="6" height="4.5" rx="1" fill="white"/><rect x="3.5" y="15" width="6" height="4.5" rx="1" fill="${ACC}"/><rect x="14.5" y="15" width="6" height="4.5" rx="1" fill="${ACC}"/><path d="M12 8.5 V11.5 M6.5 15 V11.5 H17.5 V15" ${sw(1.4)}/>`,
  docArrowDown: () => `<path d="M6 4.5 H14 L18 8.5 V19.5 H6 Z" ${sw(1.4)}/><path d="M12 10.5 V15.5 M12 15.5 L9.8 13.3 M12 15.5 L14.2 13.3" ${sw(1.5)}/><rect x="8" y="6.5" width="4" height="1.6" rx="0.6" fill="${ACC}"/>`,
  stopwatch: () => `<circle cx="12" cy="13" r="6.8" ${S}/><path d="M12 9.8 V13 L14.3 14.6" ${sw(1.5)}/><path d="M10 3.8 H14 M12 3.8 V6" ${sw(1.5)}/><path d="M17.5 7.5 L19 6" ${sw(1.5)}/>`,
  translateMark: () => `<text x="8.5" y="13" font-size="9" font-weight="bold" fill="white" text-anchor="middle" font-family="serif">A</text><path d="M13.5 8.5 H19 M16.2 8.5 V10" ${sw(1.3)}/><path d="M13.8 16 C14.8 16.8 17.5 16.8 19 15.5 M13.5 14.5 H19.5 M15 14.5 C15.5 17 17 18.2 18.8 18.8" ${sw(1.3)}/>`,
  pageHash: () => `<path d="M6.5 4.5 H14 L17.5 8 V19.5 H6.5 Z" ${SOFT}/><path d="M9.5 10.5 L9 16 M13.5 10.5 L13 16 M7.8 12.2 H15.2 M7.5 14.4 H14.9" stroke="#0EA5E9" stroke-width="1.3" stroke-linecap="round"/>`,
  xrayScan: () => `<rect x="4" y="4" width="16" height="16" rx="1.5" ${sw(1.2)} stroke-dasharray="2.5 1.8"/><path d="M12 6.5 V17.5" ${sw(1.3)}/><path d="M8.5 8.5 C10 10 14 10 15.5 8.5 M8.5 12 C10 13.5 14 13.5 15.5 12 M9.5 15.5 C10.8 16.8 13.2 16.8 14.5 15.5" ${sw(1.2)}/>`,
  heartPulse: () => `<path d="M12 19.5 C7 15.5 4 12.5 4 9.3 C4 7 5.8 5.2 8 5.2 C9.6 5.2 11.1 6.1 12 7.5 C12.9 6.1 14.4 5.2 16 5.2 C18.2 5.2 20 7 20 9.3 C20 12.5 17 15.5 12 19.5 Z" ${SOFT}/><path d="M6.5 11.5 H9.5 L10.8 9.5 L12.8 13.5 L14 12 H17.5" stroke="#EF4444" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  hospitalBuilding: () => `<rect x="5" y="6" width="14" height="13.5" rx="1.2" ${SOFT}/><path d="M12 9 V15 M9 12 H15" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/><path d="M3.5 19.5 H20.5" ${sw(1.6)}/>`,
  safetyHelmet: () => `<path d="M5 14.5 A7 7 0 0 1 19 14.5" ${SOFT}/><path d="M3.8 14.5 H20.2 A0.8 0.8 0 0 1 20.2 16.2 H3.8 A0.8 0.8 0 0 1 3.8 14.5 Z" fill="${ACC}"/><path d="M10.9 7.8 V14.4" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" opacity="0.95"/><path d="M12 7.5 V14.4" stroke="${ACC}" stroke-width="1.4" stroke-linecap="round"/>`,
  gearCog: () => `<path d="M12 4.8 L13.2 6.8 A5.4 5.4 0 0 1 15 7.8 L17.3 7.2 L18.5 9.3 L16.9 11 A5.4 5.4 0 0 1 16.9 13 L18.5 14.7 L17.3 16.8 L15 16.2 A5.4 5.4 0 0 1 13.2 17.2 L12 19.2 L10.8 17.2 A5.4 5.4 0 0 1 9 16.2 L6.7 16.8 L5.5 14.7 L7.1 13 A5.4 5.4 0 0 1 7.1 11 L5.5 9.3 L6.7 7.2 L9 7.8 A5.4 5.4 0 0 1 10.8 6.8 Z" ${SOFT}/><circle cx="12" cy="12" r="2.2" ${sw(1.4)}/>`,
  circusTent: () => `<path d="M12 4 L19 18.5 H5 Z" ${SOFT}/><path d="M12 4 V2.5 M12 2.5 H14.6 L13.2 3.6 L14.6 4.7 H12" fill="${ACC}"/><path d="M12 9.5 L9 18.5 M12 9.5 L15 18.5 M8.5 12.5 H15.5" stroke="#7C3AED" stroke-width="1.2"/>`,
  fireworkBurst: () => `<path d="M12 12 L12 5 M12 12 L17.3 8.5 M12 12 L19 12 M12 12 L17.3 15.5 M12 12 L12 19 M12 12 L6.7 15.5 M12 12 L5 12 M12 12 L6.7 8.5" stroke="white" stroke-width="1.2" stroke-linecap="round"/><circle cx="12" cy="12" r="1.6" fill="${ACC}"/><circle cx="12" cy="4.6" r="1" fill="${ACC}"/><circle cx="18.5" cy="12" r="1" fill="${ACC}"/><circle cx="6.2" cy="16" r="1" fill="${ACC}"/>`,
  clapperBoard: () => `<rect x="4" y="10" width="16" height="9" rx="1.2" ${SOFT}/><path d="M4.3 9.8 L19.7 9.8 L19.3 6 L4 6.6 Z" fill="white"/><path d="M7.5 6.3 L6.5 9.7 M11.5 6.2 L10.5 9.7 M15.5 6.1 L14.5 9.7" stroke="#F97316" stroke-width="1.4"/>`,
  skylineCity: () => `<rect x="4" y="9" width="4.5" height="10.5" rx="0.6" ${SOFT2}/><rect x="9.5" y="5" width="5" height="14.5" rx="0.6" ${SOFT}/><rect x="15.5" y="11" width="4.5" height="8.5" rx="0.6" fill="${ACC}"/><path d="M3.5 19.5 H20.5" ${sw(1.4)}/>`,
  ringDiamond: () => `<path d="M9 6.5 L12 3.8 L15 6.5 L12 9.2 Z" fill="${ACC}"/><circle cx="12" cy="14.8" r="5.2" ${sw(1.7)}/>`,
  giftBox: () => `<rect x="4.5" y="10" width="15" height="9.5" rx="1.2" ${SOFT}/><rect x="10.6" y="10" width="2.8" height="9.5" fill="${ACC}"/><path d="M4 10 H20 M12 10 C9 10 7.5 8.5 8 6.8 C8.5 5.2 10.8 5.4 12 7.5 C13.2 5.4 15.5 5.2 16 6.8 C16.5 8.5 15 10 12 10 Z" ${sw(1.3)}/>`,
  noodleBowl: () => `<path d="M4.5 12 H19.5 A7.5 7.5 0 0 1 12 19 A7.5 7.5 0 0 1 4.5 12 Z" ${SOFT}/><path d="M7 9.5 L17 4.5 M8.5 10.5 L18.5 6.5" ${sw(1.3)}/><path d="M6 12 H18" stroke="${ACC}" stroke-width="1.4" stroke-linecap="round"/>`,
  ballotBox: () => `<rect x="5" y="10.5" width="14" height="9" rx="1.4" ${SOFT}/><path d="M9.5 10.5 V14 H14.5 V10.5" ${sw(1.3)}/><path d="M12 3.5 L13.4 6 L16.2 6.5 L14.1 8.5 L14.6 11.2 L12 9.9 L9.4 11.2 L9.9 8.5 L7.8 6.5 L10.6 6 Z" fill="${ACC}" transform="translate(0,-1) scale(0.72) translate(4.6,2.6)"/>`,
  hourglass: () => `<path d="M6.5 4.5 H17.5 M6.5 19.5 H17.5" ${sw(1.6)}/><path d="M8 4.5 C8 9 11 10.5 11 12 C11 13.5 8 15 8 19.5 M16 4.5 C16 9 13 10.5 13 12 C13 13.5 16 15 16 19.5" ${sw(1.4)}/><path d="M9.8 17.5 L14.2 17.5 L12 14.8 Z" fill="${ACC}"/>`,
  monthEndCheck: () => `<rect x="4.5" y="5.5" width="12" height="15" rx="1.5" ${SOFT}/><circle cx="16.5" cy="16" r="4.6" fill="white"/><path d="M14.4 16.1 L16 17.7 L18.9 14.4" stroke="#10B981" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 9 H13.5 M7.5 12 H11.5" stroke="${ACC}" stroke-width="1.3" stroke-linecap="round"/>`,
  abacusCount: () => `<rect x="4" y="5" width="16" height="14" rx="1.5" ${sw(1.3)}/><path d="M4 9.5 H20 M4 14.5 H20 M9 5 V19 M15 5 V19" ${sw(1.2)}/><circle cx="9" cy="7.3" r="1.2" fill="${ACC}"/><circle cx="15" cy="12" r="1.2" fill="white"/><circle cx="9" cy="16.8" r="1.2" fill="white"/>`,
  bellRing: () => `<path d="M12 4.5 A5 5 0 0 1 17 9.5 C17 13 18 14.5 19 15.5 H5 C6 14.5 7 13 7 9.5 A5 5 0 0 1 12 4.5 Z" ${SOFT}/><path d="M10 18 A2 2 0 0 0 14 18" ${sw(1.5)}/><circle cx="19.5" cy="6" r="1.4" fill="${ACC}"/>`,
  hospitalSmall: () => `<rect x="6" y="5" width="12" height="14" rx="1.2" ${SOFT}/><path d="M12 8.5 V14 M9.2 11.2 H14.8" stroke="#EF4444" stroke-width="1.8" stroke-linecap="round"/><path d="M4.5 19 H19.5" ${sw(1.5)}/><rect x="10.6" y="16" width="2.8" height="3" rx="0.4" fill="#64748B"/>`,
  warningTriangle: () => `<path d="M12 4.5 L20.5 19 H3.5 Z" ${SOFT}/><path d="M12 9.5 V13.8" stroke="#DC2626" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="16.4" r="1.05" fill="#DC2626"/>`,
  bankSmall: () => `<path d="M5 9.5 L12 5.5 L19 9.5 Z" ${sw(1.4)}/><path d="M6.8 11 V16.5 M12 11 V16.5 M17.2 11 V16.5" ${sw(1.6)}/><text x="12" y="15.8" font-size="6" fill="${ACC}" text-anchor="middle" font-weight="bold">¥</text><path d="M4.5 18.5 H19.5" ${sw(1.7)}/>`,
  sitemapStetho: () => `<circle cx="12" cy="6" r="2.4" ${sw(1.4)}/><circle cx="5.5" cy="17.5" r="2.4" ${sw(1.4)}/><circle cx="18.5" cy="17.5" r="2.4" fill="${ACC}"/><path d="M12 8.4 V12 M5.5 15.1 V12 H18.5 V15.1" ${sw(1.3)}/>`,
  frameSpark: () => `<rect x="4" y="5" width="16" height="13" rx="1.5" ${S}/><circle cx="9" cy="9.5" r="1.4" fill="${ACC}"/><path d="M5.5 16.5 L9.5 12.5 L12.5 15 L15 13 L18.5 16" ${sw(1.3)}/><path d="M18.2 2.6 L18.9 4.4 L20.7 5.1 L18.9 5.8 L18.2 7.6 L17.5 5.8 L15.7 5.1 L17.5 4.4 Z" fill="white"/>`,
  stethoscope: () => `<path d="M7 4.5 V10 A3.5 3.5 0 0 0 14 10 V4.5" ${sw(1.5)}/><path d="M10.5 13.5 V15 A4 4 0 0 0 18.5 15 V12.8" ${sw(1.5)}/><circle cx="18.5" cy="11" r="2" fill="${ACC}"/><path d="M5.2 4.5 H8.8 M12.2 4.5 H15.8" ${sw(1.5)}/>`,
}

// ── 94 条新图标规格：id → [背景色, 字形] ──
const SPECS = {
  // ET · 通用高频扩展
  'et-sort': ['#3B82F6', 'arrowsUpDown'],
  'et-merge-sheets': ['#0EA5E9', 'mergeGrid'],
  'et-diff-two': ['#6366F1', 'versusPanel'],
  'et-translate': ['#06B6D4', 'globe'],
  'et-mask': ['#475569', 'shield'],
  'et-split-cols': ['#8B5CF6', 'scissors'],
  'et-split-sheets': ['#3B82F6', 'splitSheet'],
  'et-formula-explain': ['#F59E0B', 'bulb'],
  'et-beautify': ['#EC4899', 'sparkles'],
  'et-mark': ['#EF4444', 'alertMark'],
  'et-x-extract': ['#10B981', 'inboxTray'],
  'et-x-ppt': ['#F97316', 'megaphone'],
  'et-x-report': ['#0EA5E9', 'newspaper'],
  // ET · 财务
  'et-fin-invoice': ['#D97706', 'receipt'],
  'et-fin-statements': ['#10B981', 'barChart3'],
  'et-fin-budget': ['#EF4444', 'downTrend'],
  'et-fin-aging': ['#F59E0B', 'hourglass'],
  'et-fin-bankrec': ['#0EA5E9', 'scaleBalance'],
  'et-fin-closecheck': ['#10B981', 'monthEndCheck'],
  // ET · 电商
  'et-ec-competitor': ['#F97316', 'scaleBalance'],
  'et-ec-comments': ['#EC4899', 'speechBubble'],
  'et-ec-stock': ['#8B5CF6', 'packageBox'],
  'et-ec-refund': ['#F43F5E', 'returnArrow'],
  'et-ec-roi': ['#F59E0B', 'target'],
  'et-ec-keywords': ['#6366F1', 'key'],
  // ET · HR
  'et-hr-attendance': ['#14B8A6', 'clock'],
  'et-hr-payroll': ['#10B981', 'banknote'],
  'et-hr-recruit': ['#3B82F6', 'peopleTwo'],
  'et-hr-turnover': ['#F97316', 'doorTurnover'],
  'et-hr-social': ['#EF4444', 'medicalCross'],
  'et-hr-perfbox': ['#6366F1', 'perfBars'],
  // ET · 销售
  'et-sale-rank': ['#F59E0B', 'medal'],
  'et-sale-forecast': ['#8B5CF6', 'crystalBall'],
  'et-sale-follow': ['#0EA5E9', 'contactsCard'],
  'et-sale-funnel-amt': ['#06B6D4', 'funnel'],
  'et-sale-region': ['#10B981', 'mapRegion'],
  // ET · 教育
  'et-edu-attendance': ['#14B8A6', 'clipboardList'],
  'et-edu-budget': ['#22C55E', 'house'],
  'et-edu-exam': ['#3B82F6', 'rulerTriangle'],
  'et-edu-group': ['#F97316', 'dice'],
  'et-edu-timetable': ['#6366F1', 'calendar'],
  // ET · 行业（医疗/制造/政务/门店/生活）
  'et-med-schedule': ['#0EA5E9', 'calendar'],
  'et-med-followup': ['#EC4899', 'bellRing'],
  'et-mfg-bom': ['#64748B', 'factory'],
  'et-mfg-stocktake': ['#0EA5E9', 'clipboardList'],
  'et-gov-statcheck': ['#4F46E5', 'bankColumns'],
  'et-gov-rostercheck': ['#0891B2', 'contactsCard'],
  'et-shop-diff': ['#D97706', 'storefront'],
  'et-shop-supply': ['#10B981', 'handshake'],
  'et-life-travel': ['#06B6D4', 'suitcase'],
  'et-life-loan': ['#6366F1', 'bankSmall'],
  'et-life-fitness': ['#EF4444', 'dumbbell'],
  'wpp-img-model': ['#A855F7', 'frameSpark'],
  // WPP · 政企汇报
  'wpp-gov-annual': ['#B91C1C', 'bankColumns'],
  'wpp-gov-shuzhi': ['#C2410C', 'scrollDoc'],
  'wpp-gov-party': ['#DC2626', 'flagWave'],
  'wpp-gov-meeting': ['#0D9488', 'clipboardList'],
  'wpp-gov-rectify': ['#B45309', 'receipt'],
  'wpp-gov-livelihood': ['#EA580C', 'housesRow'],
  'wpp-gov-safetyedu': ['#D97706', 'warningTriangle'],
  // WPP · 销售提案
  'wpp-sale-pitch': ['#F59E0B', 'briefcase'],
  'wpp-sale-competitor': ['#EF4444', 'crossedTools'],
  'wpp-sale-case': ['#F97316', 'medal'],
  // WPP · 咨询方案
  'wpp-con-framework': ['#0891B2', 'compassNeedle'],
  'wpp-con-review': ['#0EA5E9', 'refreshCycle'],
  'wpp-con-bp': ['#7C3AED', 'bricksWall'],
  // WPP · 教育培训
  'wpp-edu-course': ['#16A34A', 'schoolHouse'],
  'wpp-edu-defense': ['#6366F1', 'gradCap'],
  'wpp-edu-quiz': ['#0EA5E9', 'questionMark'],
  'wpp-edu-parents': ['#EC4899', 'familyGroup'],
  'wpp-edu-recruit': ['#F97316', 'megaphone'],
  'wpp-edu-class': ['#EF4444', 'appleFruit'],
  // WPP · 通用职场
  'wpp-work-weekly': ['#3B82F6', 'calendar'],
  'wpp-work-actions': ['#10B981', 'checkCircle'],
  // WPP · 质量与转换
  'wpp-proof': ['#8B5CF6', 'receipt'],
  'wpp-structure': ['#6366F1', 'sitemapStetho'],
  'wpp-scaffold': ['#94A3B8', 'bricksWall'],
  'wpp-to-doc': ['#0EA5E9', 'docArrowDown'],
  'wpp-notes-timed': ['#F97316', 'stopwatch'],
  'wpp-translate': ['#06B6D4', 'translateMark'],
  'wpp-footer': ['#64748B', 'pageHash'],
  // WPP · 医疗
  'wpp-med-mdt': ['#E11D48', 'xrayScan'],
  'wpp-med-edu': ['#F43F5E', 'heartPulse'],
  'wpp-med-dept': ['#BE123C', 'hospitalBuilding'],
  // WPP · 制造
  'wpp-mfg-safety': ['#EA580C', 'safetyHelmet'],
  'wpp-mfg-sop': ['#64748B', 'gearCog'],
  // WPP · 财经
  'wpp-fin-roadshow': ['#C026D3', 'circusTent'],
  'wpp-fin-compliance': ['#059669', 'megaphone'],
  'wpp-fin-product': ['#7C3AED', 'bankSmall'],
  // WPP · 电商
  'wpp-ec-battle': ['#F97316', 'fireworkBurst'],
  'wpp-ec-live-script': ['#EC4899', 'clapperBoard'],
  // WPP · 其他行业
  'wpp-realestate': ['#4F46E5', 'skylineCity'],
  'wpp-wed-flow': ['#F472B6', 'ringDiamond'],
  'wpp-event-plan': ['#DB2777', 'giftBox'],
  'wpp-food-new': ['#D97706', 'noodleBowl'],
}

// 生成
fs.mkdirSync(OUT_DIR, { recursive: true })
let written = 0
for (const [id, [bg, glyphName]] of Object.entries(SPECS)) {
  const glyph = glyphs[glyphName]
  if (!glyph) { console.error(`✗ 未知字形: ${id} → ${glyphName}`); process.exit(1) }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="${bg}"/>${glyph()}</svg>`
  fs.writeFileSync(path.join(OUT_DIR, `${id}.svg`), svg)
  written++
}
// 严格 XML 良构校验（零依赖）：WPS/浏览器对重复属性零容忍——duplicate attribute 直接裂图
function assertWellFormed(svg, name) {
  const openRe = /<(\w+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g
  const stack = []
  let m
  while ((m = openRe.exec(svg))) {
    const [, tag, attrs, selfClose] = m
    const names = [...attrs.matchAll(/[\w:-]+=/g)].map(x => x[0])
    if (new Set(names).size !== names.length) {
      throw new Error(`${name}: 重复属性 [${names.join(',')}]`)
    }
    if (!selfClose) stack.push(tag)
    const closeIdx = svg.indexOf(`</${tag}>`, openRe.lastIndex)
    if (!selfClose && closeIdx === -1 && tag !== 'svg') {
      throw new Error(`${name}: <${tag}> 未闭合`)
    }
  }
  if (!/<\/svg>\s*$/.test(svg)) throw new Error(`${name}: 缺少 </svg> 结尾`)
  for (let i = stack.length - 1; i >= 0; i--) {
    if (!svg.includes(`</${stack[i]}>`)) throw new Error(`${name}: <${stack[i]}> 未闭合`)
  }
}
let invalid = 0
for (const f of fs.readdirSync(OUT_DIR)) {
  try { assertWellFormed(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'), f) }
  catch (e) { console.error(`✗ XML 非法 ${e.message}`); invalid++ }
}
if (invalid) process.exit(1)
console.log(`✓ 写入 ${written} 枚图标并全部通过严格 XML 校验 → ${OUT_DIR}`)

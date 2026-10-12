import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("C:\\Users\\sunchenxi\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\sharp");
const root = dirname(fileURLToPath(import.meta.url));
const assets = join(root, "assets");
const [currentTitle, referenceTitle, character] = await Promise.all([
  readFile(join(assets, "first-mix-title-kid.png")),
  readFile(join(assets, "first-mix-title-reference.png")),
  readFile(join(assets, "rebel-dj-hero.png")),
]);

const width = 1480;
const height = 1030;
const panelY = 155;
const panelWidth = 440;
const panelHeight = 800;
const panelXs = [30, 520, 1010];
const currentData = currentTitle.toString("base64");
const referenceData = referenceTitle.toString("base64");
const characterData = character.toString("base64");

const panel = (index, title, note) => {
  const x = panelXs[index];
  return `<g>
    <text x="${x + 4}" y="116" class="label">${title}</text>
    <text x="${x + 4}" y="139" class="note">${note}</text>
    <rect x="${x}" y="${panelY}" width="${panelWidth}" height="${panelHeight}" rx="30" fill="#111114" stroke="#ffffff" stroke-opacity=".28"/>
    <rect x="${x + 12}" y="${panelY + 12}" width="${panelWidth - 24}" height="${panelHeight - 24}" rx="24" fill="#08080a"/>
    <text x="${x + 32}" y="${panelY + 54}" class="brand">FIRST MIX</text>
    <text x="${x + 32}" y="${panelY + 646}" class="tagline">YOUR FIRST MIX, DONE RIGHT</text>
    <rect x="${x + 83}" y="${panelY + 696}" width="274" height="58" rx="20" fill="#ffffff" fill-opacity=".09" stroke="#ffffff" stroke-opacity=".36"/>
    <text x="${x + 220}" y="${panelY + 733}" text-anchor="middle" class="button">进入 FIRST MIX　→</text>
  </g>`;
};

const images = [
  `<image href="data:image/png;base64,${currentData}" x="${panelXs[0] + 18}" y="${panelY + 90}" width="230" height="345" preserveAspectRatio="xMinYMin meet"/>` +
    `<image href="data:image/png;base64,${characterData}" x="${panelXs[0] + 158}" y="${panelY + 265}" width="250" height="375" preserveAspectRatio="xMidYMid meet"/>`,
  `<image href="data:image/png;base64,${referenceData}" x="${panelXs[1] + 20}" y="${panelY + 108}" width="388" height="189" preserveAspectRatio="xMidYMid meet"/>` +
    `<image href="data:image/png;base64,${characterData}" x="${panelXs[1] + 165}" y="${panelY + 225}" width="242" height="363" preserveAspectRatio="xMidYMid meet"/>`,
  `<image href="data:image/png;base64,${referenceData}" x="${panelXs[2] + 20}" y="${panelY + 108}" width="388" height="189" preserveAspectRatio="xMidYMid meet"/>` +
    `<image href="data:image/png;base64,${characterData}" x="${panelXs[2] + 185}" y="${panelY + 225}" width="242" height="363" preserveAspectRatio="xMidYMid meet"/>`,
];

const labels = [
  ["当前版", "黑字＋粉色高光"],
  ["方案 A", "原图不变 · 多遮一点"],
  ["方案 B", "原图不变 · 轻遮挡"],
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .head{font:700 34px system-ui,'Microsoft YaHei UI',sans-serif;fill:#17181b}
    .sub{font:400 17px system-ui,'Microsoft YaHei UI',sans-serif;fill:#62646b}
    .label{font:700 21px system-ui,'Microsoft YaHei UI',sans-serif;fill:#17181b}
    .note{font:400 14px system-ui,'Microsoft YaHei UI',sans-serif;fill:#62646b}
    .brand{font:700 20px system-ui,sans-serif;letter-spacing:1px;fill:#f7f4ef}
    .tagline{font:600 10px system-ui,sans-serif;letter-spacing:1.4px;fill:#a4a1a8}
    .button{font:700 16px system-ui,'Microsoft YaHei UI',sans-serif;fill:#fff}
  </style>
  <rect width="100%" height="100%" fill="#f3f1ea"/>
  <text x="40" y="56" class="head">FIRST MIX　标题对比</text>
  <text x="40" y="88" class="sub">保留原图文字摆放　·　人物只轻轻压住「混得像样」</text>
  ${labels.map((item, index) => panel(index, ...item)).join("")}
  ${images.join("")}
  <text x="40" y="994" class="note">A / B 使用你发来的原图（两张附件内容相同），仅调整人物遮挡量；当前版保留现有标题。</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(join(root, "title-comparison.png"));

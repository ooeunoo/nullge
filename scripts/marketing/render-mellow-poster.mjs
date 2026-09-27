// Render a mellow 4:5 Instagram poster: photo + headline (white/lime) + wordmark. No AI note: the operator decided (2026-09-27) that images and videos carry no disclosure text.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const [,, photo, line1, line2, sub, out] = process.argv;
const dir = path.dirname(new URL(import.meta.url).pathname);
const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const logo = readFileSync(path.join(dir, 'mellow-logo-light.svg'), 'utf8');
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><style>
html,body{margin:0;width:1080px;height:1350px;overflow:hidden;background:#212620;font-family:"Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif}
.bg{position:absolute;inset:0;background:url(${b64(photo)}) center/cover no-repeat}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,22,20,.86) 0%,rgba(20,22,20,.55) 26%,rgba(20,22,20,0) 48%,rgba(20,22,20,0) 70%,rgba(20,22,20,.78) 100%)}
.copy{position:absolute;left:72px;top:96px;right:72px;color:#f9f9f9}
h1{margin:0;font-size:104px;line-height:1.14;font-weight:800;letter-spacing:-3px;word-break:keep-all}
h1 .lime{color:#c6ed82}
p{margin:26px 0 0;font-size:38px;line-height:1.45;font-weight:500;color:rgba(249,249,249,.88);word-break:keep-all}
.foot{position:absolute;left:72px;right:72px;bottom:64px;display:flex;justify-content:space-between;align-items:flex-end;color:#f9f9f9}
.logo{width:300px}.logo svg{width:100%;height:auto;display:block}
.tag{margin-top:14px;font-size:26px;font-weight:600;color:rgba(249,249,249,.85)}
</style><div class="bg"></div><div class="shade"></div>
<div class="copy"><h1>${line1}<br><span class="lime">${line2}</span></h1><p>${sub}</p></div>
<div class="foot"><div><div class="logo">${logo}</div><div class="tag">먼저 전화하는 AI 친구</div></div></div>`;
const htmlPath = out.replace(/\.png$/, '.html');
writeFileSync(htmlPath, html);
execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new','--hide-scrollbars','--no-first-run','--disable-gpu',`--window-size=1080,1350`,`--screenshot=${out}`,`file://${htmlPath}`], { stdio: 'ignore' });
console.log('rendered', out);

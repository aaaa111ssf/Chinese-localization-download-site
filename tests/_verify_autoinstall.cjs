/* 行为验证：从 app.js 提取自动安装代码段，桩掉 DOM 后模拟各模式点击 */
const fs = require('fs');
const path = 'D:/zm/wnagzahn/Chinese-localization-download-site-main/app.js';
const src = fs.readFileSync(path, 'utf8');

const start = src.indexOf('/* ---------- 下载方式与 Android 安装助手 ---------- */');
const end = src.indexOf('/* ---------- 渲染：主卡片（截图风格） ---------- */');
if (start < 0 || end < 0) { console.error('提取失败'); process.exit(1); }
const chunk = src.slice(start, end);

const SAMPLE = 'a'.repeat(64);
let calls = { open: [], toast: [], log: [], nav: [] };

function makeEnv(savedMode, ua) {
  calls = { open: [], toast: [], log: [], nav: [] };
  const sandbox = {
    console,
    URL, URLSearchParams, Date, JSON, String, Boolean, Number, RegExp, Error, Object, Array,
    localStorage: { getItem: () => JSON.stringify({ downloadMode: savedMode }) },
    navigator: { userAgent: ua },
    window: null, // 由下方补
    document: {
      querySelectorAll: () => [],
      addEventListener: () => {},
      visibilityState: 'visible',
    },
  };
  sandbox.window = {
    open: (u) => { calls.open.push(u); return { opener: null }; },
    addEventListener: () => {},
    setTimeout: (fn) => {}, // 不触发"未检测到安装助手"提示
  };
  sandbox.location = { set href(u) { calls.nav.push(u); }, get href() { return calls.nav.at(-1) || 'https://sfszhmod.pages.dev/'; } };
  sandbox.toast = (m) => calls.toast.push(m);
  sandbox.logDownload = () => calls.log.push(1);
  sandbox.files = [{
    name: '测试模组',
    installType: 'parts',
    installUrl: 'https://nasyt.dpdns.org/sd/aGJ5g2gU/',
    sha256: SAMPLE,
    link: 'https://www.lanzou.com/xxx',
  }];
  sandbox.isDllFile = () => false;
  sandbox.isMobileDevice = () => /Mobile|Android/i.test(ua);
  return sandbox;
}

function run(label, savedMode, ua) {
  const sandbox = makeEnv(savedMode, ua);
  const keys = Object.keys(sandbox);
  const body = `
    const { ${keys.join(',')} } = __sb;
    ${chunk}
    window.handleModDownload(0, fakeEvent());
    function fakeEvent() { return { preventDefault(){}, stopImmediatePropagation(){}, stopPropagation(){} }; }
  `;
  try {
    new Function('__sb', body)(sandbox);
  } catch (e) {
    console.log(`FAIL ${label}: 执行异常 ${e.message}`);
    return;
  }
  const opened = calls.open.concat(calls.nav);
  const schemeHit = opened.find(u => u.startsWith('sfsmodinstaller://install?'));
  console.log(`--- ${label}`);
  console.log(`  toast: ${JSON.stringify(calls.toast)}`);
  console.log(`  open : ${opened.length ? opened[0].slice(0, 100) : '(无)'}`);
  console.log(`  结论 : ${schemeHit ? '✅ 唤起安装助手深度链接' : opened.length ? '➡ 打开普通下载页' : '❌ 无任何动作'}`);
  return { schemeHit, opened, toast: calls.toast, nav: calls.nav };
}

const r1 = run('安卓 + auto 模式', 'auto', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36');
const r2 = run('安卓 + direct 模式(默认)', 'direct', 'Mozilla/5.0 (Linux; Android 14) Chrome/126 Mobile');
const r3 = run('桌面 + auto 模式', 'auto', 'Mozilla/5.0 (Windows NT 10.0) Chrome/126');
const r4 = run('安卓 + 蓝奏云模式', 'lanzou', 'Mozilla/5.0 (Linux; Android 14) Chrome/126 Mobile');
const r5 = run('安卓 + auto + 无直链资源', 'auto', 'Mozilla/5.0 (Linux; Android 14) Chrome/126 Mobile') // files 同一个（有直链）
;

// 深度链接参数核对
if (r1 && r1.schemeHit) {
  const u = new URL(r1.schemeHit.replace('sfsmodinstaller://install?', 'https://x/?'));
  console.log('\n=== 深度链接参数核对 ===');
  console.log('name =', u.searchParams.get('name'));
  console.log('url  =', u.searchParams.get('url'));
  console.log('type =', u.searchParams.get('type'));
  console.log('sha256 长度 =', (u.searchParams.get('sha256') || '').length);
  // APK 端 parseInstallFields 白名单复验
  const dl = u.searchParams.get('url');
  const parsed = new URL(dl);
  const ok = parsed.protocol === 'https:' && ['sfszhmod.pages.dev', 'sfs-cn-mod.pages.dev', 'nasyt.dpdns.org'].includes(parsed.hostname)
    && (!parsed.hostname.includes('nasyt') || /^\/sd\/[A-Za-z0-9_-]+\/?$/.test(parsed.pathname));
  console.log('APK 白名单校验 =', ok ? '✅ 通过' : '❌ 拒绝');
}

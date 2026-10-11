// Visual-only local harness for the authenticated editorial routes. It serves
// the real HTML/CSS, suppressing app/data modules and inserting representative
// static states; it must not be mistaken for an end-to-end auth/data test.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '../public');
const outputDir = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'fuelphysique-paper-qa'));
const mobile = process.argv[4] === 'mobile';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const routes = ['my-nutrition-plans', 'nutrition-builder', 'progress', 'social', 'app'];
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };

function fixture(route) {
  if (route === 'my-nutrition-plans') return `
    document.getElementById('plansStatus').hidden = true;
    document.getElementById('planCount').textContent = '2';
    document.getElementById('plansGrid').innerHTML = '<article class="plan-card"><h2>Balanced Muscle Building Plan</h2><div class="plan-meta"><span>2950 calories</span><span>150 g protein</span></div><div class="plan-actions"><button class="activate-button">Use this plan</button><a class="share-social-link" href="#">Share with friend</a><div class="manage-actions"><button class="rename-button">Rename</button><button class="delete-button">Delete</button></div></div></article><article class="plan-card active"><span class="active-badge">Active plan</span><h2>Balanced Muscle Building Plan</h2><div class="plan-meta"><span>2950 calories</span><span>150 g protein</span></div><div class="plan-actions"><button class="activate-button" disabled>Current plan</button><a class="share-social-link" href="#">Share with friend</a><div class="manage-actions"><button class="rename-button">Rename</button><button class="delete-button">Delete</button></div></div></article>';
  `;
  if (route === 'social') return `
    document.getElementById('socialApp').hidden = false;
    document.getElementById('messagesView').hidden = false;
    document.getElementById('friendsView').hidden = true;
    document.getElementById('conversationSkeletons').hidden = true;
    document.getElementById('conversationList').innerHTML = '<button class="conversation-card"><span class="avatar">FP</span><span class="conversation-copy"><strong>FuelPhysique</strong><span>Welcome</span></span><span class="conversation-meta">Today</span></button>';
  `;
  return '';
}

function previewHtml(source, route) {
  // Preserve only the shared shell, which injects the same route stylesheet
  // and body classes as production. Suppress auth/API scripts in this fixture.
  const withoutAppScripts = source.replace(/<script\b(?![^>]*redesign-shell\.js)[^>]*>[\s\S]*?<\/script>/gi, '');
  const setup = `<script>document.addEventListener('DOMContentLoaded', function () { ${fixture(route)} });</script>`;
  const withOpenSettings = route === 'app'
    ? withoutAppScripts.replace('id="settingsOverlay" class="settings-overlay" aria-hidden="true"', 'id="settingsOverlay" class="settings-overlay show" aria-hidden="false"')
    : withoutAppScripts;
  if (route === 'app' && !withOpenSettings.includes('class="settings-overlay show"')) throw new Error('Settings modal not found');
  return withOpenSettings.replace('</body>', `${setup}</body>`);
}

function capture(port, route) {
  return new Promise((resolve, reject) => {
    const output = path.join(outputDir, `paper-${route}${process.argv[3] ? `-${process.argv[3]}` : ''}.png`);
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), `fp-paper-${route}-`));
    const child = spawn(chrome, [
      '--headless=old', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
      '--no-first-run', `--user-data-dir=${profile}`, mobile ? '--window-size=390,844' : '--window-size=1855,1044',
      '--hide-scrollbars', '--virtual-time-budget=10000', `--screenshot=${output}`,
      `http://127.0.0.1:${port}/${route}.html`,
    ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let chromeError = '';
    child.stderr.on('data', (chunk) => { chromeError += chunk.toString(); });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Timed out capturing ${route}`)); }, 18000);
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('exit', () => {
      clearTimeout(timer);
      if (fs.existsSync(output) && fs.statSync(output).size > 1000) resolve(output);
      else reject(new Error(`No screenshot for ${route}: ${chromeError.slice(-600)}`));
    });
  });
}

async function captureViaDevTools(port, route) {
  const output = path.join(outputDir, `paper-${route}${process.argv[3] ? `-${process.argv[3]}` : ''}.png`);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `fp-paper-mobile-${route}-`));
  const child = spawn(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
    '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    const deadline = Date.now() + 12000;
    while (!fs.existsSync(portFile)) {
      if (Date.now() > deadline) throw new Error(`Chrome debugging port timed out for ${route}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const debugPort = Number(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0]);
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find((target) => target.type === 'page');
    if (!page) throw new Error(`No Chrome page target for ${route}`);
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    let nextId = 0;
    const pending = new Map();
    socket.addEventListener('message', (event) => {
      const response = JSON.parse(event.data);
      const call = pending.get(response.id);
      if (!call) return;
      pending.delete(response.id);
      if (response.error) call.reject(new Error(response.error.message));
      else call.resolve(response.result);
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    await command('Page.enable');
    await command('Emulation.setDeviceMetricsOverride', { width: mobile ? 390 : 1855, height: mobile ? 844 : 1044, deviceScaleFactor: 1, mobile });
    await command('Page.navigate', { url: `http://127.0.0.1:${port}/${route}.html` });
    await new Promise((resolve) => setTimeout(resolve, 2600));
    const viewport = await command('Runtime.evaluate', { expression: '({width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth})', returnByValue: true });
    if (viewport.result.value.width !== (mobile ? 390 : 1855)) throw new Error(`Unexpected viewport: ${JSON.stringify(viewport.result.value)}`);
    console.log(`${route} viewport: ${JSON.stringify(viewport.result.value)}`);
    if (route === 'app') {
      const modal = await command('Runtime.evaluate', { expression: '({shown: document.getElementById("settingsOverlay")?.classList.contains("show"), background: getComputedStyle(document.querySelector(".settings-window")).backgroundColor, overlay: (() => { const s=getComputedStyle(document.getElementById("settingsOverlay")); return {display:s.display,visibility:s.visibility,opacity:s.opacity,zIndex:s.zIndex} })(), rect: document.querySelector(".settings-window").getBoundingClientRect().toJSON(), hitTag: document.elementFromPoint(innerWidth/2, innerHeight/2)?.tagName, hitClass: document.elementFromPoint(innerWidth/2, innerHeight/2)?.className, hit: document.elementFromPoint(innerWidth/2, innerHeight/2)?.closest(".settings-window") !== null})', returnByValue: true });
      console.log(`settings modal: ${JSON.stringify(modal.result.value)}`);
      if (!modal.result.value.shown || modal.result.value.background !== 'rgb(255, 255, 255)' || !modal.result.value.hit) throw new Error('Settings modal failed the visible-paper check');
    }
    const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(output, Buffer.from(shot.data, 'base64'));
    return output;
  } finally {
    socket?.close();
    child.kill();
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(403); response.end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404); response.end('Not found'); return; }
      const extension = path.extname(file);
      const route = path.basename(file, '.html');
      const body = extension === '.html' && routes.includes(route) ? previewHtml(data.toString('utf8'), route) : data;
      response.writeHead(200, { 'Content-Type': types[extension] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(body);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    for (const route of routes.filter((name) => !process.argv[5] || name === process.argv[5])) {
      console.log(await ((mobile || route === 'app') ? captureViaDevTools(port, route) : capture(port, route)));
    }
  } finally {
    server.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

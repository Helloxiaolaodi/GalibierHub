import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const openNextDir = path.join(projectRoot, '.open-next');
const assetsDir = path.join(openNextDir, 'assets');
const publicDir = path.join(projectRoot, 'public');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(source, destination) {
  if (!fs.existsSync(source)) {
    return;
  }

  const stats = fs.statSync(source);
  if (stats.isDirectory()) {
    ensureDir(destination);
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }

  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
}

if (fs.existsSync(assetsDir)) {
  for (const entry of fs.readdirSync(assetsDir)) {
    const source = path.join(assetsDir, entry);
    const destination = path.join(openNextDir, entry);

    if (fs.existsSync(destination)) {
      copyRecursive(source, destination);
      fs.rmSync(source, { recursive: true, force: true });
      continue;
    }

    fs.renameSync(source, destination);
  }

  fs.rmSync(assetsDir, { recursive: true, force: true });
}

copyRecursive(publicDir, openNextDir);

const workerSource = path.join(openNextDir, 'worker.js');
const workerTarget = path.join(openNextDir, '_worker.js');
if (fs.existsSync(workerSource)) {
  fs.copyFileSync(workerSource, workerTarget);
}

const publicExcludes = fs.existsSync(publicDir)
  ? fs.readdirSync(publicDir).map((entry) => {
      const fullPath = path.join(publicDir, entry);
      return fs.statSync(fullPath).isDirectory() ? `/${entry}/*` : `/${entry}`;
    })
  : [];

const routes = {
  version: 1,
  include: ['/*'],
  exclude: ['/_next/static/*', ...publicExcludes],
};

fs.writeFileSync(path.join(openNextDir, '_routes.json'), JSON.stringify(routes));

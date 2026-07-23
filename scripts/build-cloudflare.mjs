import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const openNextDir = path.join(projectRoot, '.open-next');
const assetsDir = path.join(openNextDir, 'assets');
const publicDir = path.join(projectRoot, 'public');

function resolveWithinRoot(targetPath, rootPath = projectRoot) {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);

  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Refusing to access path outside root: ${resolvedTarget}`);
  }

  return resolvedTarget;
}

function ensureDir(dir) {
  fs.mkdirSync(resolveWithinRoot(dir), { recursive: true });
}

function copyRecursive(source, destination) {
  const safeSource = resolveWithinRoot(source);
  const safeDestination = resolveWithinRoot(destination);

  if (!fs.existsSync(safeSource)) {
    return;
  }

  const stats = fs.statSync(safeSource);
  if (stats.isDirectory()) {
    ensureDir(safeDestination);
    for (const entry of fs.readdirSync(safeSource)) {
      copyRecursive(path.join(safeSource, entry), path.join(safeDestination, entry));
    }
    return;
  }

  ensureDir(path.dirname(safeDestination));
  fs.copyFileSync(safeSource, safeDestination);
}

const safeOpenNextDir = resolveWithinRoot(openNextDir);
const safeAssetsDir = resolveWithinRoot(assetsDir);
const safePublicDir = resolveWithinRoot(publicDir);

if (fs.existsSync(safeAssetsDir)) {
  for (const entry of fs.readdirSync(safeAssetsDir)) {
    const source = resolveWithinRoot(path.join(safeAssetsDir, entry), safeAssetsDir);
    const destination = resolveWithinRoot(path.join(safeOpenNextDir, entry), safeOpenNextDir);

    if (fs.existsSync(destination)) {
      copyRecursive(source, destination);
      fs.rmSync(source, { recursive: true, force: true });
      continue;
    }

    fs.renameSync(source, destination);
  }

  fs.rmSync(safeAssetsDir, { recursive: true, force: true });
}

copyRecursive(safePublicDir, safeOpenNextDir);

const workerSource = resolveWithinRoot(path.join(safeOpenNextDir, 'worker.js'), safeOpenNextDir);
const workerTarget = resolveWithinRoot(path.join(safeOpenNextDir, '_worker.js'), safeOpenNextDir);
if (fs.existsSync(workerSource)) {
  fs.copyFileSync(workerSource, workerTarget);
}

const publicExcludes = fs.existsSync(safePublicDir)
  ? fs.readdirSync(safePublicDir).map((entry) => {
      const fullPath = resolveWithinRoot(path.join(safePublicDir, entry), safePublicDir);
      return fs.statSync(fullPath).isDirectory() ? `/${entry}/*` : `/${entry}`;
    })
  : [];

const routes = {
  version: 1,
  include: ['/*'],
  exclude: ['/_next/static/*', ...publicExcludes],
};

fs.writeFileSync(resolveWithinRoot(path.join(safeOpenNextDir, '_routes.json'), safeOpenNextDir), JSON.stringify(routes));

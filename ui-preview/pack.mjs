// Builds Lum Preview.exe: npm run pack  (optional: npm run pack -- <output folder>, default dist)
// Uses the packager API with an explicit ignore list, so build outputs and test files never end up in the app.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packager } from '@electron/packager';

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || 'dist';
const skip = /^[\\/](dist|tests|node_modules[\\/]\.cache)([\\/]|$)|^[\\/](Lum\.cmd|pack\.mjs|snap[^\\/]*\.png)$/;

const paths = await packager({
  dir,
  out: path.resolve(dir, out),
  name: 'Lum Preview',
  platform: 'win32',
  arch: 'x64',
  overwrite: true,
  prune: true,
  icon: path.resolve(dir, '../lum/branding/overlay/chrome/app/theme/chromium/win/chromium.ico'),
  appCopyright: 'Lum',
  win32metadata: { ProductName: 'Lum Preview', FileDescription: 'Lum Preview' },
  ignore: (p) => skip.test(p)
});
console.log('Wrote', paths.join(', '));

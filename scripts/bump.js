#!/usr/bin/env node
// Usage: node scripts/bump.js [major|minor|patch]
// Default: patch

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const type = process.argv[2] ?? 'patch';

if (!['major', 'minor', 'patch'].includes(type)) {
  console.error('Usage: node scripts/bump.js [major|minor|patch]');
  process.exit(1);
}

// Read files
const pkgPath = path.join(root, 'package.json');
const appPath = path.join(root, 'app.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));

// Bump semver
const [major, minor, patch] = pkg.version.split('.').map(Number);
let newVersion;
if (type === 'major') newVersion = `${major + 1}.0.0`;
else if (type === 'minor') newVersion = `${major}.${minor + 1}.0`;
else newVersion = `${major}.${minor}.${patch + 1}`;

// Increment versionCode
const oldCode = app.expo.android.versionCode;
const newCode = oldCode + 1;

// Write package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// Write app.json
app.expo.version = newVersion;
app.expo.android.versionCode = newCode;
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');

// Patch android/app/build.gradle if it exists (quick builds skip prebuild)
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionCode \d+/, `versionCode ${newCode}`);
  gradle = gradle.replace(/versionName "[^"]+"/, `versionName "${newVersion}"`);
  fs.writeFileSync(gradlePath, gradle);
}

console.log(`v${pkg.version.split('.').map(Number).join('.')} → v${newVersion}  (versionCode ${oldCode} → ${newCode})`);

// Git commit + tag (android/ is gitignored, so never add build.gradle)
execSync(`git add package.json app.json`, { cwd: root, stdio: 'inherit' });
execSync(`git commit -m "chore: bump version to v${newVersion} (build ${newCode})"`, { cwd: root, stdio: 'inherit' });
execSync(`git tag v${newVersion}`, { cwd: root, stdio: 'inherit' });

console.log(`\nTagged v${newVersion}. Jetzt bauen mit:\n  eas build --platform android --profile preview --non-interactive --message "v${newVersion}"`);

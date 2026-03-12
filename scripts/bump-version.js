#!/usr/bin/env node

/**
 * 统一更新项目版本号
 *
 * 用法: node scripts/bump-version.js <版本号> [更新类型] [更新描述...]
 * 示例:
 *   node scripts/bump-version.js 1.2.15 minor "新增 macOS 自动更新功能"
 *   node scripts/bump-version.js 1.2.15 patch "修复权限问题"
 *
 * 更新文件:
 * - package.json (根目录)
 * - website/package.json
 * - src-tauri/tauri.conf.json
 * - website/src/pages/Changelog.tsx (新增版本条目)
 *
 * 脚本会生成 git tag 消息模板，可用于 GitHub Release
 *
 * 更新类型: major | minor | patch
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ANSI 颜色
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

// 读取 JSON 文件
function readJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// 写入 JSON 文件
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// 读取 tauri.conf.json（支持注释）
function readTauriConfig(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/"version":\s*"([^"]+)"/);
  if (!match) {
    throw new Error(`无法从 ${filePath} 读取 version 字段`);
  }
  return match[1];
}

// 写入 tauri.conf.json
function writeTauriConfig(filePath, newVersion) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/("version":\s*)"[^"]+"/, `$1"${newVersion}"`);
  fs.writeFileSync(filePath, content, 'utf-8');
}

// 更新 Changelog.tsx
function updateChangelog(version, type, description) {
  const changelogPath = path.join(rootDir, 'website', 'src', 'pages', 'Changelog.tsx');

  if (!fs.existsSync(changelogPath)) {
    log(colors.yellow, `  ⚠️  Changelog.tsx 不存在，跳过更新`);
    return null;
  }

  let content = fs.readFileSync(changelogPath, 'utf-8');

  // 获取当前日期
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

  // 构建新版本条目
  const newVersionEntry = `  {
    version: '${version}',
    date: '${dateStr}',
    type: '${type}',${description ? `
    changes: [
      { type: '${getTypeChangeType(type)}', text: "${description}" }
    ]` : ''}
  },`;

  // 查找 versions 数组的开始位置
  const versionsArrayStart = content.indexOf('const versions: Version[] = [');
  if (versionsArrayStart === -1) {
    log(colors.yellow, `  ⚠️  无法找到 versions 数组，跳过 Changelog 更新`);
    return null;
  }

  // 查找第一个版本条目的位置
  const firstVersionStart = content.indexOf('{\n    version:', versionsArrayStart);
  if (firstVersionStart === -1) {
    log(colors.yellow, `  ⚠️  无法找到版本条目，跳过 Changelog 更新`);
    return null;
  }

  // 插入新版本条目
  const newContent =
    content.slice(0, firstVersionStart) +
    newVersionEntry +
    '\n' +
    content.slice(firstVersionStart);

  fs.writeFileSync(changelogPath, newContent, 'utf-8');

  return { version, date: dateStr, type, changes: description ? [{ type: getTypeChangeType(type), text: description }] : [] };
}

// 根据版本类型获取变更类型
function getTypeChangeType(releaseType) {
  switch (releaseType) {
    case 'major': return 'feature';
    case 'minor': return 'feature';
    case 'patch': return 'fix';
    default: return 'improvement';
  }
}

// 生成 Git Tag 消息模板（用于 GitHub Release）
function generateTagMessage(version, type, description) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

  let message = `v${version}\n\n`;
  message += `发布日期: ${dateStr}\n\n`;

  if (description) {
    const typeLabel = {
      major: '重大更新',
      minor: '新增功能',
      patch: '问题修复'
    }[type] || '更新';

    message += `### ${typeLabel}\n\n${description}\n\n`;
  }

  message += `### 下载说明\n`;
  message += `- **Windows**: 下载 \`.exe\` (NSIS安装包) 或 \`.msi\`\n`;
  message += `- **macOS**: 下载 \`.dmg\`\n`;
  message += `- **Linux**: 下载 \`.deb\` 或 \`.AppImage\`\n`;

  return message;
}

// 用户确认
async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${colors.cyan}${message} (y/N): ${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    log(colors.red, '错误: 请提供版本号');
    log(colors.yellow, '\n用法: node scripts/bump-version.js <版本号> [类型] [描述]');
    log(colors.yellow, '\n示例:');
    log(colors.reset, '  node scripts/bump-version.js 1.2.15 minor "新增 macOS 自动更新功能"');
    log(colors.reset, '  node scripts/bump-version.js 1.2.15 patch "修复权限问题"');
    log(colors.reset, '  node scripts/bump-version.js 1.2.16 major "重大更新"');
    log(colors.yellow, '\n更新类型:');
    log(colors.reset, '  major  - 重大更新 (不兼容的 API 变更)');
    log(colors.reset, '  minor  - 新增功能 (向后兼容的新功能)');
    log(colors.reset, '  patch  - 补丁修复 (向后兼容的问题修复)');
    process.exit(1);
  }

  const newVersion = args[0];
  const releaseType = args[1] || 'minor';
  const description = args[2] || '';

  // 验证版本号格式
  const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
  if (!versionRegex.test(newVersion)) {
    log(colors.red, `错误: 版本号格式无效 "${newVersion}"`);
    log(colors.yellow, '格式应为: x.y.z 或 x.y.z-<prerelease>');
    process.exit(1);
  }

  // 验证更新类型
  const validTypes = ['major', 'minor', 'patch'];
  if (!validTypes.includes(releaseType)) {
    log(colors.red, `错误: 更新类型无效 "${releaseType}"`);
    log(colors.yellow, `有效类型: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  log(colors.bold, '\n========================================');
  log(colors.bold, '  CCG Switch 版本号统一更新');
  log(colors.bold, '========================================\n');

  // 定义要更新的文件
  const files = [
    {
      path: path.join(rootDir, 'package.json'),
      name: 'package.json (根目录)',
      read: () => readJSON(path.join(rootDir, 'package.json')).version,
      write: (v) => {
        const data = readJSON(path.join(rootDir, 'package.json'));
        data.version = v;
        writeJSON(path.join(rootDir, 'package.json'), data);
      },
    },
    {
      path: path.join(rootDir, 'website', 'package.json'),
      name: 'website/package.json',
      read: () => readJSON(path.join(rootDir, 'website', 'package.json')).version,
      write: (v) => {
        const data = readJSON(path.join(rootDir, 'website', 'package.json'));
        data.version = v;
        writeJSON(path.join(rootDir, 'website', 'package.json'), data);
      },
    },
    {
      path: path.join(rootDir, 'src-tauri', 'tauri.conf.json'),
      name: 'src-tauri/tauri.conf.json',
      read: () => readTauriConfig(path.join(rootDir, 'src-tauri', 'tauri.conf.json')),
      write: (v) => writeTauriConfig(path.join(rootDir, 'src-tauri', 'tauri.conf.json'), v),
    },
  ];

  // 显示当前版本和将要更新的版本
  log(colors.cyan, '📋 当前版本状态:\n');

  for (const file of files) {
    try {
      const currentVersion = file.read();
      log(colors.blue, `  ${file.name}`);
      log(colors.reset, `    当前版本: ${colors.yellow}${currentVersion}${colors.reset}`);
      log(colors.reset, `    更新到:   ${colors.green}${newVersion}${colors.reset}`);
      console.log();
    } catch (error) {
      log(colors.red, `  ❌ ${file.name}: ${error.message}\n`);
    }
  }

  // 显示 Changelog 更新信息
  log(colors.cyan, '📝 Changelog 更新:\n');
  log(colors.reset, `  版本: ${colors.green}${newVersion}${colors.reset}`);
  log(colors.reset, `  类型: ${colors.yellow}${releaseType}${colors.reset}`);
  if (description) {
    log(colors.reset, `  描述: ${description}`);
  } else {
    log(colors.yellow, `  描述: (空 - 将在 Changelog 中创建空条目)`);
  }
  console.log();

  // 生成 Tag 消息模板
  const tagMessage = generateTagMessage(newVersion, releaseType, description);

  log(colors.cyan, '📦 Git Tag 消息模板 (用于 GitHub Release):\n');
  log(colors.bold, '────────────────────────────────────────────────');
  log(colors.reset, tagMessage);
  log(colors.bold, '────────────────────────────────────────────────');
  console.log();

  // 显示后续步骤
  log(colors.cyan, '📝 更新后的后续步骤:\n');
  log(colors.reset, '  1. 检查修改的文件');
  log(colors.reset, '  2. 补充 Changelog.tsx 中的更新内容（如需要）');
  log(colors.reset, `  3. 提交更改: git add . && git commit -m "chore: bump version to ${newVersion}"`);
  log(colors.reset, `  4. 创建 tag: git tag -a v${newVersion} -m "$(cat <<'EOF'\n${tagMessage}\nEOF\n)"`);
  log(colors.reset, `  5. 推送: git push origin main && git push origin v${newVersion}`);
  log(colors.reset, '');

  // 确认
  const confirmed = await confirm('\n⚠️  确认要更新以上版本号吗？');

  if (!confirmed) {
    log(colors.yellow, '\n❌ 操作已取消\n');
    process.exit(0);
  }

  // 执行更新
  log(colors.cyan, '\n🔄 正在更新版本号...\n');

  for (const file of files) {
    try {
      file.write(newVersion);
      log(colors.green, `  ✅ ${file.name} → ${newVersion}`);
    } catch (error) {
      log(colors.red, `  ❌ ${file.name}: ${error.message}`);
    }
  }

  // 更新 Changelog
  try {
    updateChangelog(newVersion, releaseType, description);
  } catch (error) {
    log(colors.yellow, `  ⚠️  Changelog 更新失败: ${error.message}`);
  }

  log(colors.green, '\n✨ 版本号更新完成！\n');
  log(colors.cyan, '📌 下一步:\n');
  log(colors.reset, '  查看修改: git diff');
  log(colors.reset, `  补充 Changelog 后提交: git add . && git commit -m "chore: bump version to ${newVersion}"\n`);
}

main().catch((error) => {
  log(colors.red, `\n❌ 错误: ${error.message}\n`);
  process.exit(1);
});

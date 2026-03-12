// 网站配置 - 自动检测仓库信息
// 在 GitHub Pages 上运行时，自动从 URL 中提取仓库信息

/**
 * 从当前环境获取仓库所有者
 * - 本地开发: 返回默认值
 * - GitHub Pages: 从 hostname 提取 (如 qincasin.github.io -> qincasin)
 */
function getRepoOwner(): string {
  // 浏览器环境
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // GitHub Pages: owner.github.io/repo -> owner
    if (hostname.endsWith('.github.io')) {
      const owner = hostname.split('.')[0];
      return owner;
    }
  }

  // 构建时环境变量（Vite）
  // 可以通过 VITE_GITHUB_OWNER 环境变量覆盖
  if (import.meta.env.VITE_GITHUB_OWNER) {
    return import.meta.env.VITE_GITHUB_OWNER;
  }

  // 默认值（原始仓库）
  return 'cus45';
}

/**
 * 仓库名称（固定）
 */
export const GITHUB_REPO = 'ccg-switch';

/**
 * GitHub Pages 基础路径
 */
export const BASE_PATH = '/ccg-switch/';

/**
 * 仓库所有者（自动检测）
 */
export const GITHUB_OWNER = getRepoOwner();

/**
 * 构建的 URLs（自动跟随当前仓库）
 */
export const REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const ISSUES_URL = `${REPO_URL}/issues`;
export const RELEASES_URL = `${REPO_URL}/releases`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

/**
 * Discussions URL
 * 注意：原始仓库可能未启用 Discussions，此链接可能 404
 * 使用前请确认目标仓库已启用 Discussions 功能
 */
export const DISCUSSIONS_URL = `${REPO_URL}/discussions`;

// 调试用：在控制台输出当前配置
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  console.log('[Site Config]', {
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    repoUrl: REPO_URL,
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'SSR',
  });
}

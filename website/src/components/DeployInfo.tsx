import { GitBranch, Globe } from 'lucide-react';
import { GITHUB_OWNER, GITHUB_REPO, REPO_URL } from '../config/site';

/**
 * 部署信息组件
 * 显示当前部署的仓库信息，让用户知道正在查看哪个 fork 的网站
 */
export function DeployInfo() {
  // 仅在开发模式或非原始仓库时显示
  const shouldShow = import.meta.env.DEV || GITHUB_OWNER !== 'cus45';

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="group relative">
        {/* 触发按钮 */}
        <button
          className="flex items-center space-x-2 px-3 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 hover:bg-white/20 transition-all opacity-50 hover:opacity-100"
          title="部署信息"
        >
          <Globe size={14} className="text-gray-400" />
          <span className="text-xs text-gray-400">部署信息</span>
        </button>

        {/* 信息卡片 */}
        <div className="absolute bottom-full left-0 mb-2 w-64 p-4 bg-slate-900/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
          <div className="flex items-center space-x-2 mb-3">
            <GitBranch size={16} className="text-orange-400" />
            <span className="text-sm font-semibold text-white">部署信息</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">仓库所有者:</span>
              <span className="text-gray-300 font-mono">{GITHUB_OWNER}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">仓库名称:</span>
              <span className="text-gray-300 font-mono">{GITHUB_REPO}</span>
            </div>
            <div className="pt-2 border-t border-white/10">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-1 text-orange-400 hover:text-orange-300 transition-colors"
              >
                <Globe size={12} />
                <span>访问仓库</span>
              </a>
            </div>
          </div>

          {GITHUB_OWNER !== 'cus45' && (
            <div className="mt-3 p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <p className="text-xs text-orange-300">
                这是 {GITHUB_OWNER} 的 fork 版本
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

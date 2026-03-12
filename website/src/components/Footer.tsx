import { Github, Heart } from 'lucide-react';
import { REPO_URL } from '../config/site';

export default function Footer() {
  const footerLinks = [
    { name: 'GitHub', url: REPO_URL, icon: Github },
  ];

  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-3 gap-8">
          {/* Logo & Description */}
          <div className="sm:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 via-pink-500 to-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
                <span className="text-white font-bold text-sm">CC</span>
              </div>
              <span className="font-semibold text-lg text-white">CCG Switch</span>
            </div>
            <p className="text-gray-500 text-sm mb-4 max-w-md">
              AI CLI 工具的统一配置管理器 - 支持 Claude、Codex、Gemini 等主流大模型
            </p>
            <div className="flex items-center space-x-6">
              {footerLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-sm text-gray-500 hover:text-white transition-colors"
                  >
                    <Icon size={16} />
                    <span>{link.name}</span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Tech Stack & Deploy Info */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">技术栈</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {['Tauri 2', 'React 19', 'Rust', 'TailwindCSS'].map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1 bg-white/5 text-gray-400 text-xs rounded-full border border-white/10"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            © 2024 CCG Switch. MIT License.
          </p>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>Made with</span>
            <Heart size={14} className="text-pink-500 fill-pink-500 animate-pulse" />
            <span>for AI developers</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

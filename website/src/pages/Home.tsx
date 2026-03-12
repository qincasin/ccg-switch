import { Link } from 'react-router-dom';
import { Download, Github, ArrowRight, Zap, Shield, Server, Globe, Activity, Cpu, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { REPO_URL, RELEASES_URL, LICENSE_URL } from '../config/site';

// Feature data with icons
const features = [
  {
    icon: Zap,
    title: '零配置切换',
    description: '一键在 Anthropic、Azure、自定义代理之间切换，无需手动修改环境变量',
    gradient: 'from-amber-500 to-orange-500'
  },
  {
    icon: Shield,
    title: '内置本地代理',
    description: 'Rust 编写的高性能 HTTP 代理，自动拦截、替换和测速 API 请求，专为国内网络设计',
    gradient: 'from-orange-500 to-red-500'
  },
  {
    icon: Server,
    title: 'MCP 服务器管理',
    description: '图形化配置 Model Context Protocol 插件，可视化管理 AI 上下文能力',
    gradient: 'from-pink-500 to-rose-500'
  },
  {
    icon: Globe,
    title: 'Prompt 预设池',
    description: '预置多种角色 Prompt 模板，支持工作区级快速分发与应用',
    gradient: 'from-rose-500 to-red-500'
  },
  {
    icon: Activity,
    title: '可视化数据面板',
    description: '统一监控 Tokens 消耗、工具调用次数与接口响应延迟',
    gradient: 'from-red-500 to-orange-500'
  },
  {
    icon: Cpu,
    title: '沙箱环境隔离',
    description: '为不同项目创建独立的配置环境，避免冲突与干扰',
    gradient: 'from-cyan-500 to-blue-500'
  }
];

// Platform-specific features
const platformFeatures = [
  {
    platform: 'Windows',
    icon: '⊞',
    gradient: 'from-blue-500 to-cyan-500',
    features: ['NSIS 安装向导', '系统集成托盘', '开机自启动支持', 'PowerShell 脚本集成']
  },
  {
    platform: 'macOS',
    icon: '',
    gradient: 'from-gray-600 to-gray-800',
    features: ['原生 dmg 安装包', '状态栏菜单集成', 'Touch ID 快捷认证', 'Apple Silicon 原生支持']
  },
  {
    platform: 'Linux',
    icon: '☼',
    gradient: 'from-orange-500 to-yellow-500',
    features: ['deb/AppImage 包', '命令行工具集成', 'systemd 服务支持', '完整的主题定制']
  }
];

const techStack = [
  { name: 'Tauri 2', color: 'bg-amber-500' },
  { name: 'React 19', color: 'bg-cyan-500' },
  { name: 'Rust', color: 'bg-orange-600' },
  { name: 'TailwindCSS', color: 'bg-teal-500' },
  { name: 'Zustand', color: 'bg-purple-500' },
];

const platforms = [
  { name: 'Windows', icon: '⊞', color: 'from-blue-500 to-cyan-500' },
  { name: 'macOS', icon: '', color: 'from-gray-600 to-gray-800' },
  { name: 'Linux', icon: '☼', color: 'from-orange-500 to-yellow-500' },
];

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Animated background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-500/15 rounded-full blur-3xl animate-pulse-slow delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl animate-pulse-slow delay-2000" />
      </div>

      {/* Noise texture overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none noise-texture" />

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center">
              {/* Badge */}
              <div className={`inline-flex items-center space-x-2 px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                <span className="text-sm text-gray-300">支持 Claude · Codex · Gemini</span>
              </div>

              {/* Main headline */}
              <h1 className={`text-5xl sm:text-7xl lg:text-8xl font-bold mb-6 transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                  CCG Switch
                </span>
              </h1>

              {/* Tagline */}
              <p className={`text-xl sm:text-2xl text-gray-400 mb-4 max-w-2xl mx-auto transition-all duration-1000 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                AI CLI 工具的统一配置管理器
              </p>

              <p className={`text-base text-gray-500 mb-12 max-w-xl mx-auto transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                无缝切换 API 密钥环境，彻底告别频繁手动修改终端环境变量的痛苦
              </p>

              {/* CTA Buttons */}
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-1000 delay-600 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative inline-flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-orange-500 via-pink-500 to-rose-500 text-white font-semibold rounded-xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/25 hover:scale-105"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-pink-600 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Download size={20} className="relative z-10" />
                  <span className="relative z-10">立即下载</span>
                  <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                </a>

                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center space-x-2 px-8 py-4 bg-white/5 backdrop-blur-sm text-white font-medium rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                >
                  <Github size={20} className="group-hover:rotate-12 transition-transform" />
                  <span>Star on GitHub</span>
                </a>
              </div>

              {/* Platform badges */}
              <div className={`mt-12 flex items-center justify-center space-x-6 transition-all duration-1000 delay-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                {platforms.map((platform) => (
                  <div key={platform.name} className="flex items-center space-x-2 text-gray-500">
                    <span className={`text-lg bg-gradient-to-r ${platform.color} bg-clip-text text-transparent font-semibold`}>
                      {platform.icon}
                    </span>
                    <span className="text-sm">{platform.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Section header */}
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  强大功能
                </span>
              </h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                为 AI 开发者精心打造的配置管理体验
              </p>
            </div>

            {/* Feature cards grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={index}
                    className="group relative p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-500 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-orange-500/5"
                    style={{
                      animationDelay: `${index * 100}ms`,
                      opacity: mounted ? 1 : 0,
                      transform: mounted ? 'translateY(0)' : 'translateY(20px)',
                      transition: 'opacity 0.6s ease, transform 0.6s ease'
                    }}
                  >
                    {/* Gradient background glow on hover */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-500`} />

                    {/* Icon */}
                    <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} p-0.5 mb-4`}>
                      <div className="w-full h-full rounded-xl bg-slate-900 flex items-center justify-center">
                        <Icon className={`bg-gradient-to-br ${feature.gradient} bg-clip-text text-transparent`} size={24} />
                      </div>
                    </div>

                    {/* Content */}
                    <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-orange-400 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Platform Features Section */}
        <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  各平台深度适配
                </span>
              </h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                充分发挥每个操作系统的原生能力
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {platformFeatures.map((platform) => (
                <div
                  key={platform.platform}
                  className="group relative p-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-500 hover:bg-white/[0.07]"
                >
                  {/* Platform icon */}
                  <div className="flex items-center space-x-4 mb-6">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${platform.gradient} flex items-center justify-center shadow-lg`}>
                      <span className="text-2xl text-white">{platform.icon}</span>
                    </div>
                    <h3 className="text-xl font-semibold text-white">{platform.platform}</h3>
                  </div>

                  {/* Feature list */}
                  <ul className="space-y-3">
                    {platform.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center space-x-3 text-gray-400 text-sm">
                        <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${platform.gradient}`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Hover gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${platform.gradient} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-500 pointer-events-none`} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Start Section */}
        <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 relative">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-500/5 to-transparent pointer-events-none" />

          <div className="max-w-4xl mx-auto relative">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  快速开始
                </span>
              </h2>
              <p className="text-gray-500 text-lg">
                三步即可完成配置，立即提升开发效率
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-6">
              {[
                { icon: Download, title: '下载安装', desc: '选择对应平台的安装包进行安装' },
                { icon: Shield, title: '添加 API Key', desc: '配置你的 Claude/Codex/Gemini API 密钥' },
                { icon: Zap, title: '开始使用', desc: '一键切换，享受流畅的 AI 开发体验' },
              ].map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={index}
                    className="group flex items-start space-x-6 p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-orange-500/30 transition-all duration-300 hover:bg-white/[0.07]"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-orange-500/25">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0 pt-2">
                      <div className="flex items-center space-x-3 mb-1">
                        <Icon size={20} className="text-orange-400" />
                        <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                      </div>
                      <p className="text-gray-400 text-sm">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <div className="mt-12 text-center">
              <Link
                to="/install"
                className="inline-flex items-center space-x-2 text-orange-400 font-medium hover:text-orange-300 transition-colors group"
              >
                <span>查看详细安装指南</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* Tech Stack Section */}
        <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  现代技术栈
                </span>
              </h2>
              <p className="text-gray-500 text-lg">
                业内最前沿的跨平台开发技术
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {techStack.map((tech) => (
                <div
                  key={tech.name}
                  className="group flex flex-col items-center p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:bg-white/[0.07]"
                >
                  <div className={`w-12 h-12 rounded-xl ${tech.color} flex items-center justify-center mb-3 shadow-lg`}>
                    <Terminal size={24} className="text-white" />
                  </div>
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{tech.name}</span>
                </div>
              ))}
            </div>

            {/* Additional info */}
            <div className="mt-12 grid sm:grid-cols-3 gap-6 text-center">
              <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                <div className="text-3xl font-bold text-orange-400 mb-2">Rust</div>
                <div className="text-sm text-gray-500">高性能后端</div>
              </div>
              <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                <div className="text-3xl font-bold text-pink-400 mb-2">&lt;5MB</div>
                <div className="text-sm text-gray-500">极小的安装包</div>
              </div>
              <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                <div className="text-3xl font-bold text-amber-400 mb-2">原生</div>
                <div className="text-sm text-gray-500">跨平台体验</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="relative p-8 sm:p-12 bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-rose-500/10 backdrop-blur-sm rounded-3xl border border-white/10 overflow-hidden">
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-pink-500/20 to-rose-500/20 animate-gradient-shift" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGM5Ljk0MSAwIDE4IDguMDU5IDE4IDE4cy04LjA1OSAxOC0xOCAxOC0xOC04LjA1OS0xOC0xOCA4LjA1OS0xOCAxOC0xOHptMCAzMmMxNy42NzMgMCAzMi0xNC4zMjcgMzItMzJTNTMuNjczIDAgMzYgMGMtMTcuNjczIDAtMzIgMTQuMzI3LTMyIDMyczE0LjMyNyAzMiAzMiAzMnoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAzIi8+PC9nPjwvc3ZnPg==')] opacity-30" />

              <div className="relative">
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 text-center">
                  准备好了吗？
                </h2>
                <p className="text-gray-300 text-center mb-8 max-w-xl mx-auto">
                  立即下载 CCG Switch，体验流畅的 AI CLI 配置管理
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <a
                    href={RELEASES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-orange-500 via-pink-500 to-rose-500 text-white font-semibold rounded-xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/25 hover:scale-105"
                  >
                    <Download size={20} />
                    <span>免费下载</span>
                  </a>

                  <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-medium rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-300"
                  >
                    <Github size={20} />
                    <span>查看文档</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">CC</span>
                </div>
                <span className="text-gray-400 text-sm">© 2024 CCG Switch</span>
              </div>

              <div className="flex items-center space-x-6 text-sm text-gray-500">
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  GitHub
                </a>
                <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  MIT License
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }

        @keyframes gradient-shift {
          0%, 100% { transform: translateX(0) translateY(0); }
          25% { transform: translateX(-2%) translateY(2%); }
          50% { transform: translateX(2%) translateY(-2%); }
          75% { transform: translateX(-2%) translateY(-2%); }
        }

        .delay-1000 { animation-delay: 1s; }
        .delay-2000 { animation-delay: 2s; }

        .noise-texture {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
      `}</style>
    </div>
  );
}

import { Shield, Server, FileText, BarChart3, Cpu, ChevronRight, Terminal, Key, Zap } from 'lucide-react';
import { ISSUES_URL } from '../config/site';

const sections = [
  {
    key: 'tokens',
    icon: Key,
    gradient: 'from-amber-500 to-orange-500',
    title: 'API Token 管理',
    description: '轻松管理多个 Claude/Codex/Gemini API Token，一键切换使用',
    features: [
      { title: '添加 Token', desc: '填写名称、API Key 和相关配置' },
      { title: '快速切换', desc: '点击「设为活跃」即可切换当前 Token' },
      { title: '模型映射', desc: '为 Sonnet、Opus、Haiku 配置默认模型' },
      { title: '自定义端点', desc: '支持 Azure、自定义代理等' }
    ]
  },
  {
    key: 'mcp',
    icon: Server,
    gradient: 'from-pink-500 to-rose-500',
    title: 'MCP 服务器管理',
    description: '图形化配置 Model Context Protocol 插件，扩展 AI 能力',
    features: [
      { title: '全局服务器', desc: '对所有 Claude Code 项目生效' },
      { title: '项目服务器', desc: '仅对特定项目生效' },
      { title: '拖拽排序', desc: '直观的配置优先级管理' },
      { title: '状态监控', desc: '实时查看服务器连接状态' }
    ]
  },
  {
    key: 'prompts',
    icon: FileText,
    gradient: 'from-purple-500 to-pink-500',
    title: 'Prompt 预设管理',
    description: '保存常用的 CLAUDE.md 内容，快速应用到项目中',
    features: [
      { title: '模板创建', desc: '保存角色设定和指令模板' },
      { title: '快速应用', desc: '一键将预设应用到项目' },
      { title: '分类管理', desc: '按用途组织预设模板' },
      { title: '变量支持', desc: '支持动态变量替换' }
    ]
  },
  {
    key: 'dashboard',
    icon: BarChart3,
    gradient: 'from-cyan-500 to-blue-500',
    title: '数据统计面板',
    description: '统一监控使用情况，了解 AI 工具消耗',
    features: [
      { title: 'Token 消耗', desc: '追踪 API 调用和 Token 使用量' },
      { title: '响应延迟', desc: '监控接口响应时间' },
      { title: '活跃度图表', desc: '按天统计会话活跃度' },
      { title: '项目概览', desc: '查看所有已配置的项目' }
    ]
  },
  {
    key: 'proxy',
    icon: Shield,
    gradient: 'from-orange-500 to-red-500',
    title: '本地代理服务',
    description: '内置 Rust 编写的 HTTP 代理，解决网络访问问题',
    features: [
      { title: '自动拦截', desc: '自动拦截并转发 API 请求' },
      { title: '智能替换', desc: '自动替换 API 端点地址' },
      { title: '测速功能', desc: '测试不同代理的响应速度' },
      { title: '系统级代理', desc: '为整个系统提供代理服务' }
    ]
  },
  {
    key: 'sandbox',
    icon: Cpu,
    gradient: 'from-emerald-500 to-teal-500',
    title: '沙箱环境隔离',
    description: '为不同项目创建独立的配置环境，避免冲突',
    features: [
      { title: '项目隔离', desc: '每个项目独立配置' },
      { title: '环境切换', desc: '快速在不同项目环境间切换' },
      { title: '配置继承', desc: '支持从全局配置继承' },
      { title: '冲突避免', desc: '避免不同项目配置干扰' }
    ]
  }
];

const quickStart = [
  {
    step: 1,
    title: '安装并启动',
    desc: '下载并安装 CCG Switch，首次启动会自动初始化配置环境',
    icon: Terminal
  },
  {
    step: 2,
    title: '添加 API Token',
    desc: '在 Token 管理页面添加你的 Claude/Codex/Gemini API 密钥',
    icon: Key
  },
  {
    step: 3,
    title: '配置代理（可选）',
    desc: '如遇网络问题，可配置本地代理或使用内置代理服务',
    icon: Shield
  },
  {
    step: 4,
    title: '添加 MCP 服务器',
    desc: '在 MCP 管理页面添加需要的服务器扩展 AI 能力',
    icon: Server
  },
  {
    step: 5,
    title: '开始使用',
    desc: '在终端中使用 Claude Code，享受无缝切换体验',
    icon: Zap
  }
];

export default function Usage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/5 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/5 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                使用文档
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              了解如何使用 CCG Switch 管理 AI CLI 工具配置，提升开发效率
            </p>
          </div>
        </div>

        {/* Quick Start */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  快速上手
                </span>
              </h2>
              <p className="text-gray-500">五步完成配置，立即开始使用</p>
            </div>

            <div className="grid md:grid-cols-5 gap-4">
              {quickStart.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={index}
                    className="relative p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-white/20 transition-all group"
                  >
                    <div className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                      {item.step}
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Icon className="text-orange-400" size={24} />
                      </div>
                      <h3 className="font-semibold text-white text-sm mb-2">{item.title}</h3>
                      <p className="text-gray-500 text-xs">{item.desc}</p>
                    </div>
                    {index < quickStart.length - 1 && (
                      <ChevronRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-gray-700" size={20} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Feature Sections */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <div
                    key={section.key}
                    className="group p-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-500 hover:bg-white/[0.07]"
                  >
                    {/* Header */}
                    <div className="flex items-start space-x-4 mb-6">
                      <div className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${section.gradient} p-0.5 shadow-lg`}>
                        <div className="w-full h-full rounded-xl bg-slate-900 flex items-center justify-center">
                          <Icon className={`bg-gradient-to-br ${section.gradient} bg-clip-text text-transparent`} size={28} />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">{section.title}</h3>
                        <p className="text-gray-500 text-sm">{section.description}</p>
                      </div>
                    </div>

                    {/* Features list */}
                    <ul className="space-y-3">
                      {section.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start space-x-3">
                          <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gradient-to-r ${section.gradient} mt-2`} />
                          <div>
                            <span className="text-white font-medium">{feature.title}:</span>
                            <span className="text-gray-400 ml-1">{feature.desc}</span>
                          </div>
                        </li>
                      ))}
                    </ul>

                    {/* Hover gradient */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${section.gradient} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-500 pointer-events-none`} />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Tips Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="p-8 bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-rose-500/10 backdrop-blur-sm rounded-2xl border border-white/10">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                <Zap className="text-orange-400 mr-3" size={28} />
                使用技巧
              </h3>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center mt-0.5">
                      <span className="text-orange-400 text-xs font-bold">1</span>
                    </div>
                    <p className="text-gray-300 text-sm">为不同项目创建独立的 Token 配置，避免混淆</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-500/20 flex items-center justify-center mt-0.5">
                      <span className="text-pink-400 text-xs font-bold">2</span>
                    </div>
                    <p className="text-gray-300 text-sm">使用 MCP 服务器扩展 AI 能力，如文件系统操作</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center mt-0.5">
                      <span className="text-rose-400 text-xs font-bold">3</span>
                    </div>
                    <p className="text-gray-300 text-sm">定期查看数据面板，了解 Token 消耗情况</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center mt-0.5">
                      <span className="text-amber-400 text-xs font-bold">4</span>
                    </div>
                    <p className="text-gray-300 text-sm">利用预设功能快速部署项目配置模板</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Need Help */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-2xl font-bold text-white mb-4">还有疑问？</h3>
            <p className="text-gray-400 mb-8">查看更多文档或提交问题</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={ISSUES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl border border-white/20 transition-all"
              >
                <span>提交 Issue</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

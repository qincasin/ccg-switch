import { Download, Apple, Monitor, Terminal, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { RELEASES_URL, ISSUES_URL } from '../config/site';

const platforms = [
  {
    name: 'Windows',
    icon: Monitor,
    gradient: 'from-blue-500 to-cyan-500',
    badge: '⊞',
    downloads: [
      { name: 'NSIS 安装包', file: 'CC.Switch-Setup-*.exe', desc: '推荐：图形化安装向导' },
      { name: 'MSI 包', file: 'CC.Switch-*.msi', desc: '适合企业部署' }
    ],
    steps: [
      '下载 .exe 安装程序',
      '双击运行安装向导',
      '选择安装路径（可选）',
      '完成安装并启动应用'
    ]
  },
  {
    name: 'macOS',
    icon: Apple,
    gradient: 'from-gray-600 to-gray-800',
    badge: '',
    downloads: [
      { name: 'DMG 镜像', file: 'CC.Switch-*.dmg', desc: '支持 Apple Silicon & Intel' },
      { name: 'Brew 安装', file: 'brew install --cask ccg-switch', desc: '命令行快速安装' }
    ],
    steps: [
      '下载 .dmg 文件',
      '双击打开并拖拽到 Applications',
      '首次启动在系统设置中允许',
      '享受原生 macOS 体验'
    ]
  },
  {
    name: 'Linux',
    icon: Terminal,
    gradient: 'from-orange-500 to-yellow-500',
    badge: '☼',
    downloads: [
      { name: 'Debian 包', file: 'cc-switch_*.deb', desc: 'Debian/Ubuntu 系统' },
      { name: 'AppImage', file: 'cc-switch-*.AppImage', desc: '通用便携版' }
    ],
    steps: [
      '下载对应平台的安装包',
      'Debian: sudo dpkg -i cc-switch_*.deb',
      'AppImage: chmod +x cc-switch-*.AppImage',
      '从应用菜单启动'
    ]
  }
];

const systemRequirements = [
  { label: '操作系统', values: ['Windows 10+', 'macOS 11+', '主流 Linux 发行版'] },
  { label: '内存', values: ['至少 4GB RAM', '推荐 8GB+'] },
  { label: '存储', values: ['约 50MB 磁盘空间'] },
  { label: '网络', values: ['需要互联网连接（使用本地代理可缓解）'] }
];

const faqs = [
  {
    question: 'CCG Switch 是否安全？',
    answer: '是的。所有 API Token 都加密存储在本地，仅用于与 AI 服务商通信。不会上传到任何第三方服务器。代码完全开源，可自行审计。',
    icon: Shield
  },
  {
    question: '需要联网才能使用吗？',
    answer: '基本配置功能可以离线使用，但切换 Token、获取可用模型列表和同步 MCP 服务器需要网络连接。内置的本地代理可帮助解决网络限制问题。',
    icon: Globe
  },
  {
    question: '支持哪些 AI 服务商？',
    answer: '支持 Anthropic 官方 API、Azure OpenAI、以及任何兼容 OpenAI 格式的第三方 API。通过自定义代理配置，可以轻松切换不同服务商。',
    icon: Server
  },
  {
    question: '如何卸载？',
    answer: 'Windows: 通过"设置 > 应用"卸载；macOS: 删除 Applications 中的应用并清理 ~/Library/Application Support/ccg-switch；Linux: 使用包管理器卸载或删除 AppImage。',
    icon: Trash
  }
];

export default function Install() {
  const [selectedPlatform, setSelectedPlatform] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                安装指南
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              选择适合你操作系统的安装方式，几分钟内即可完成 CCG Switch 的安装
            </p>
          </div>
        </div>

        {/* Download Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {/* Platform tabs */}
            <div className="flex justify-center mb-12">
              <div className="inline-flex bg-white/5 backdrop-blur-sm rounded-2xl p-1.5 border border-white/10">
                {platforms.map((platform, index) => (
                    <button
                      key={platform.name}
                      onClick={() => setSelectedPlatform(index)}
                      className={`flex items-center space-x-2 px-6 py-3 rounded-xl transition-all duration-300 ${
                        selectedPlatform === index
                          ? `bg-gradient-to-r ${platform.gradient} text-white shadow-lg`
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className="text-lg">{platform.badge}</span>
                      <span className="font-medium">{platform.name}</span>
                    </button>
                ))}
              </div>
            </div>

            {/* Selected platform content */}
            <div className="max-w-3xl mx-auto">
              {(() => {
                const platform = platforms[selectedPlatform];
                const Icon = platform.icon;
                return (
                  <div className="space-y-8">
                    {/* Downloads */}
                    <div className="p-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
                      <div className="flex items-center space-x-4 mb-6">
                        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${platform.gradient} flex items-center justify-center shadow-lg`}>
                          <Icon size={28} className="text-white" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-white">{platform.name}</h2>
                          <p className="text-gray-400">选择适合你的安装包</p>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        {platform.downloads.map((download) => (
                          <a
                            key={download.name}
                            href={RELEASES_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative p-5 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all hover:bg-white/[0.07]"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-semibold text-white group-hover:text-orange-400 transition-colors">
                                {download.name}
                              </h3>
                              <Download size={18} className="text-gray-500 group-hover:text-orange-400 transition-colors" />
                            </div>
                            <code className="text-xs text-gray-500 block mb-2">{download.file}</code>
                            <p className="text-sm text-gray-400">{download.desc}</p>
                          </a>
                        ))}
                      </div>
                    </div>

                    {/* Installation steps */}
                    <div className="p-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                        <CheckCircle2 className="text-green-400 mr-2" size={24} />
                        安装步骤
                      </h3>
                      <ol className="space-y-4">
                        {platform.steps.map((step, index) => (
                          <li key={index} className="flex items-start space-x-4">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r ${platform.gradient} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                              {index + 1}
                            </div>
                            <span className="text-gray-300 pt-1">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </section>

        {/* System Requirements */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                系统要求
              </span>
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              {systemRequirements.map((req, index) => (
                <div
                  key={index}
                  className="p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-white/20 transition-all"
                >
                  <h3 className="text-lg font-semibold text-white mb-3">{req.label}</h3>
                  <ul className="space-y-2">
                    {req.values.map((value, idx) => (
                      <li key={idx} className="flex items-center text-gray-400 text-sm">
                        <div className="w-1 h-1 rounded-full bg-orange-400 mr-2" />
                        {value}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                常见问题
              </span>
            </h2>

            <div className="space-y-4">
              {faqs.map((faq, index) => (
                  <div
                    key={index}
                    className="p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <AlertCircle size={20} className="text-orange-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-2">{faq.question}</h3>
                        <p className="text-gray-400 leading-relaxed">{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>

        {/* Need Help */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="p-8 bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-rose-500/10 backdrop-blur-sm rounded-2xl border border-white/10 text-center">
              <h3 className="text-2xl font-bold text-white mb-3">需要帮助？</h3>
              <p className="text-gray-400 mb-6">遇到问题或有疑问？我们在这里提供支持</p>
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
          </div>
        </section>
      </div>

      {/* Icons used */}
      <div className="hidden">
        <Shield size={24} />
        <Globe size={24} />
        <Server size={24} />
        <Trash size={24} />
      </div>
    </div>
  );
}

// Additional imports for icons
import { Shield, Globe, Server, Trash } from 'lucide-react';

import { Network } from 'lucide-react';
import ProxyStatus from '../components/proxy/ProxyStatus';
import ProxyConfig from '../components/proxy/ProxyConfig';
import CircuitBreakerPanel from '../components/proxy/CircuitBreakerPanel';
import FailoverQueue from '../components/proxy/FailoverQueue';

function ProxyPage() {
    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="p-6 max-w-7xl mx-auto space-y-4">
                {/* 标题栏 */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-md">
                        <Network className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-base-content">
                        Proxy 控制面板
                    </h1>
                </div>

                {/* 主体两栏布局 */}
                <div className="flex gap-5 items-start">
                    {/* 左栏 60% */}
                    <div className="flex-[3] min-w-0 space-y-4">
                        <ProxyStatus />
                        <ProxyConfig />
                    </div>

                    {/* 右栏 40% */}
                    <div className="flex-[2] min-w-0 space-y-4">
                        <CircuitBreakerPanel />
                        <FailoverQueue />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProxyPage;

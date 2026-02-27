import { Zap, Edit2, Trash2, Eye, EyeOff, GripVertical } from 'lucide-react';
import { useState } from 'react';
import { Provider } from '../../types/provider';
import { APP_LABELS } from '../../types/app';
import ProviderIcon from './ProviderIcon';

interface ProviderCardProps {
    provider: Provider;
    isDragging?: boolean;
    isDragOver?: boolean;
    onSwitch: (id: string) => void;
    onEdit: (provider: Provider) => void;
    onDelete: (id: string, name: string) => void;
    onPointerDragStart: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerOver: () => void;
}

function maskApiKey(key: string) {
    if (key.length <= 10) return '***';
    return key.substring(0, 7) + '...' + key.substring(key.length - 4);
}

export default function ProviderCard({
    provider,
    isDragging,
    isDragOver,
    onSwitch,
    onEdit,
    onDelete,
    onPointerDragStart,
    onPointerOver,
}: ProviderCardProps) {
    const [showKey, setShowKey] = useState(false);

    return (
        <div
            data-provider-id={provider.id}
            onPointerOver={onPointerOver}
            className={`bg-white dark:bg-base-100 rounded-xl shadow-sm border transition-all ${
                provider.isActive
                    ? 'border-green-400 dark:border-green-500 ring-1 ring-green-200 dark:ring-green-800'
                    : 'border-gray-100 dark:border-base-200'
            } ${isDragging ? 'opacity-50 scale-95' : ''} ${
                isDragOver ? 'ring-2 ring-info/40' : ''
            }`}
        >
            <div className="p-4">
                {/* 顶部：拖拽 + 图标 + 名称 + 状态 */}
                <div className="flex items-center gap-3 mb-3">
                    <button
                        type="button"
                        onPointerDown={onPointerDragStart}
                        onClick={(e) => e.preventDefault()}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-base-content/40 hover:bg-base-200 cursor-grab active:cursor-grabbing shrink-0"
                        title="拖拽排序"
                    >
                        <GripVertical className="w-4 h-4" />
                    </button>
                    <ProviderIcon appType={provider.appType} size="md" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">{provider.name}</span>
                            {provider.isActive && (
                                <span className="badge badge-sm bg-green-500 text-white border-none gap-1 shrink-0">
                                    <Zap className="w-3 h-3" fill="currentColor" />
                                    Active
                                </span>
                            )}
                        </div>
                        <span className="text-xs text-base-content/50">{APP_LABELS[provider.appType]}</span>
                    </div>
                </div>

                {/* API Key */}
                <div className="flex items-center gap-2 mb-2">
                    <code className="font-mono text-xs bg-base-200 px-2 py-1 rounded truncate flex-1">
                        {showKey ? provider.apiKey : maskApiKey(provider.apiKey)}
                    </code>
                    <button onClick={() => setShowKey(!showKey)} className="btn btn-ghost btn-xs">
                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                </div>

                {/* URL */}
                {provider.url && (
                    <div className="mb-2">
                        <code className="font-mono text-xs text-base-content/60 truncate block" title={provider.url}>
                            {provider.url}
                        </code>
                    </div>
                )}

                {/* 描述 */}
                {provider.description && (
                    <p className="text-xs text-base-content/50 mb-3 line-clamp-2">{provider.description}</p>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center gap-1 pt-2 border-t border-base-200">
                    <button
                        onClick={() => onSwitch(provider.id)}
                        className={`btn btn-xs gap-1 ${provider.isActive ? 'btn-disabled' : 'btn-ghost text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                        disabled={provider.isActive}
                        title="切换为活跃"
                    >
                        <Zap className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onEdit(provider)}
                        className="btn btn-ghost btn-xs gap-1"
                        title="编辑"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onDelete(provider.id, provider.name)}
                        className="btn btn-ghost btn-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 gap-1 ml-auto"
                        title="删除"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

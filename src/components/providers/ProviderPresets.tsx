import { useTranslation } from 'react-i18next';
import { AppType } from '../../types/app';

export interface PresetConfig {
    label: string;
    url: string;
    appType: AppType;
    description: string;
}

const PROVIDER_PRESETS: PresetConfig[] = [
    {
        label: 'Claude Official',
        url: 'https://api.anthropic.com',
        appType: 'claude',
        description: 'Anthropic 官方 API',
    },
    {
        label: 'OpenRouter',
        url: 'https://openrouter.ai/api',
        appType: 'claude',
        description: '多模型聚合路由',
    },
    {
        label: 'Custom',
        url: '',
        appType: 'claude',
        description: '自定义 Provider 配置',
    },
];

interface ProviderPresetsProps {
    onSelect: (preset: PresetConfig) => void;
}

export default function ProviderPresets({ onSelect }: ProviderPresetsProps) {
    const { t } = useTranslation();

    return (
        <div className="grid grid-cols-3 gap-2">
            {PROVIDER_PRESETS.map((preset) => (
                <button
                    key={preset.label}
                    type="button"
                    onClick={() => onSelect(preset)}
                    className="flex flex-col items-start p-3 rounded-lg border border-base-200 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                >
                    <span className="text-sm font-medium">{preset.label}</span>
                    <span className="text-xs text-base-content/50 mt-1">
                        {t(`providers.preset_${preset.label.toLowerCase().replace(/\s/g, '_')}`, preset.description)}
                    </span>
                </button>
            ))}
        </div>
    );
}

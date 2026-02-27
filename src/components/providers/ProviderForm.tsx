import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import ModalDialog from '../common/ModalDialog';
import { showToast } from '../common/ToastContainer';
import { useProviderStore } from '../../stores/useProviderStore';
import { Provider } from '../../types/provider';
import { AppType, APP_TYPES, APP_LABELS } from '../../types/app';

interface ProviderFormProps {
    isOpen: boolean;
    editingProvider?: Provider | null;
    onClose: () => void;
    defaultAppType?: AppType;
}

const PRESETS = [
    { label: 'Claude Official', url: 'https://api.anthropic.com', appType: 'claude' as AppType },
    { label: 'OpenRouter', url: 'https://openrouter.ai/api', appType: 'claude' as AppType },
    { label: 'Custom', url: '', appType: 'claude' as AppType },
];

export default function ProviderForm({ isOpen, editingProvider, onClose, defaultAppType = 'claude' }: ProviderFormProps) {
    const { t } = useTranslation();
    const { addProvider, updateProvider } = useProviderStore();
    const isEditing = !!editingProvider;

    const [name, setName] = useState(editingProvider?.name || '');
    const [appType, setAppType] = useState<AppType>(editingProvider?.appType || defaultAppType);
    const [apiKey, setApiKey] = useState(editingProvider?.apiKey || '');
    const [url, setUrl] = useState(editingProvider?.url || 'https://api.anthropic.com');
    const [defaultSonnetModel, setDefaultSonnetModel] = useState(editingProvider?.defaultSonnetModel || '');
    const [defaultOpusModel, setDefaultOpusModel] = useState(editingProvider?.defaultOpusModel || '');
    const [defaultHaikuModel, setDefaultHaikuModel] = useState(editingProvider?.defaultHaikuModel || '');
    const [description, setDescription] = useState(editingProvider?.description || '');
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);

    const applyPreset = (preset: typeof PRESETS[number]) => {
        if (preset.url) setUrl(preset.url);
        setAppType(preset.appType);
    };

    const handleSave = async () => {
        if (!name.trim() || !apiKey.trim()) {
            showToast(t('providers.error_required', '请填写名称和 API Key'), 'error');
            return;
        }
        setSaving(true);
        try {
            const data = {
                name: name.trim(),
                appType,
                apiKey: apiKey.trim(),
                url: url.trim() || undefined,
                defaultSonnetModel: defaultSonnetModel.trim() || undefined,
                defaultOpusModel: defaultOpusModel.trim() || undefined,
                defaultHaikuModel: defaultHaikuModel.trim() || undefined,
                description: description.trim() || undefined,
            };
            if (isEditing && editingProvider) {
                await updateProvider(editingProvider.id, data);
                showToast(t('providers.update_success', 'Provider 更新成功'), 'success');
            } else {
                await addProvider(data);
                showToast(t('providers.add_success', 'Provider 添加成功'), 'success');
            }
            onClose();
        } catch (error) {
            showToast((isEditing ? '更新失败: ' : '添加失败: ') + error, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalDialog
            isOpen={isOpen}
            title={isEditing ? t('providers.edit_title', '编辑 Provider') : t('providers.add_title', '添加 Provider')}
            onConfirm={handleSave}
            onCancel={onClose}
            onClose={onClose}
            confirmText={saving ? t('common.saving', '保存中...') : t('common.save', '保存')}
        >
            {/* 预设选择 */}
            {!isEditing && (
                <div className="flex gap-2 mb-4">
                    {PRESETS.map((preset) => (
                        <button
                            key={preset.label}
                            type="button"
                            onClick={() => applyPreset(preset)}
                            className="btn btn-xs btn-outline"
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="space-y-3">
                {/* 名称 */}
                <div>
                    <label className="label label-text text-xs font-medium">{t('providers.field_name', '名称')}</label>
                    <input
                        type="text"
                        className="input input-bordered input-sm w-full"
                        placeholder="My Provider"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>

                {/* 应用类型 */}
                <div>
                    <label className="label label-text text-xs font-medium">{t('providers.field_app_type', '应用类型')}</label>
                    <select
                        className="select select-bordered select-sm w-full"
                        value={appType}
                        onChange={(e) => setAppType(e.target.value as AppType)}
                    >
                        {APP_TYPES.map((type) => (
                            <option key={type} value={type}>{APP_LABELS[type]}</option>
                        ))}
                    </select>
                </div>

                {/* API Key */}
                <div>
                    <label className="label label-text text-xs font-medium">API Key</label>
                    <div className="relative">
                        <input
                            type={showKey ? 'text' : 'password'}
                            className="input input-bordered input-sm w-full font-mono text-xs pr-10"
                            placeholder="sk-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                        >
                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* URL */}
                <div>
                    <label className="label label-text text-xs font-medium">URL</label>
                    <input
                        type="text"
                        className="input input-bordered input-sm w-full font-mono text-xs"
                        placeholder="https://api.anthropic.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                    />
                </div>

                {/* 模型配置 */}
                <div className="grid grid-cols-3 gap-2">
                    <div>
                        <label className="label label-text text-xs font-medium">Sonnet Model</label>
                        <input
                            type="text"
                            className="input input-bordered input-sm w-full font-mono text-xs"
                            placeholder="claude-sonnet-4-..."
                            value={defaultSonnetModel}
                            onChange={(e) => setDefaultSonnetModel(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="label label-text text-xs font-medium">Opus Model</label>
                        <input
                            type="text"
                            className="input input-bordered input-sm w-full font-mono text-xs"
                            placeholder="claude-opus-4-..."
                            value={defaultOpusModel}
                            onChange={(e) => setDefaultOpusModel(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="label label-text text-xs font-medium">Haiku Model</label>
                        <input
                            type="text"
                            className="input input-bordered input-sm w-full font-mono text-xs"
                            placeholder="claude-haiku-..."
                            value={defaultHaikuModel}
                            onChange={(e) => setDefaultHaikuModel(e.target.value)}
                        />
                    </div>
                </div>

                {/* 描述 */}
                <div>
                    <label className="label label-text text-xs font-medium">{t('providers.field_description', '描述')}</label>
                    <textarea
                        className="textarea textarea-bordered textarea-sm w-full text-xs"
                        placeholder={t('providers.desc_placeholder', '可选描述...')}
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>
            </div>
        </ModalDialog>
    );
}

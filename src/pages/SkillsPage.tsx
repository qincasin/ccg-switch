import { useTranslation } from 'react-i18next';
import { Zap, Plus, RefreshCw, Trash2, Edit, Eye, FolderOpen, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSkillStore } from '../stores/useSkillStore';
import ModalDialog from '../components/common/ModalDialog';
import { showToast } from '../components/common/ToastContainer';

function SkillsPage() {
    const { t } = useTranslation();
    const { skills, loading, loadSkills, saveSkill, deleteSkill } = useSkillStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editContent, setEditContent] = useState('');
    const [previewName, setPreviewName] = useState<string | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; name: string }>({
        isOpen: false,
        name: ''
    });

    useEffect(() => {
        loadSkills();
    }, [loadSkills]);

    const handleAdd = () => {
        setEditName('');
        setEditContent('');
        setIsEditing(true);
    };

    const handleEdit = (name: string, content: string) => {
        setEditName(name);
        setEditContent(content);
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!editName.trim()) return;
        try {
            await saveSkill(editName.trim(), editContent);
            setIsEditing(false);
        } catch (error) {
            console.error('保存失败:', error);
        }
    };

    const handleDelete = async (name: string) => {
        setDeleteModal({ isOpen: true, name });
    };

    const confirmDelete = async () => {
        try {
            await deleteSkill(deleteModal.name);
            showToast(t('skills.delete_success'), 'success');
        } catch (error) {
            showToast(t('skills.delete_failed'), 'error');
        } finally {
            setDeleteModal({ isOpen: false, name: '' });
        }
    };

    if (isEditing) {
        return (
            <div className="h-full w-full overflow-y-auto">
                <div className="p-6 space-y-4 max-w-7xl mx-auto">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-base-content">
                            {editName ? t('skills.edit') : t('skills.add')}
                        </h1>
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 bg-gray-100 dark:bg-base-200 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-base-100 transition-colors">
                                {t('common.cancel')}
                            </button>
                            <button onClick={handleSave} className="px-3 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors">
                                {t('common.save')}
                            </button>
                        </div>
                    </div>
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder={t('skills.name_placeholder')}
                        className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-base-content"
                    />
                    <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={20}
                        placeholder={t('skills.content_placeholder')}
                        className="w-full px-3 py-2 bg-white dark:bg-base-200 border border-gray-300 dark:border-base-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-base-content font-mono text-sm"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="p-6 space-y-4 max-w-7xl mx-auto">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Zap className="w-6 h-6 text-purple-500" />
                        <h1 className="text-xl font-bold text-gray-900 dark:text-base-content">
                            {t('skills.title')}
                        </h1>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {skills.length} {t('skills.count')}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => loadSkills()} disabled={loading} className="px-3 py-1.5 bg-gray-100 dark:bg-base-200 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-base-100 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            {t('common.refresh')}
                        </button>
                        <button onClick={handleAdd} className="px-3 py-1.5 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-1.5">
                            <Plus className="w-4 h-4" />
                            {t('common.add')}
                        </button>
                    </div>
                </div>

                {skills.length === 0 ? (
                    <div className="bg-white dark:bg-base-100 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-base-200 text-center">
                        <Zap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">{t('skills.empty')}</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('skills.empty_hint')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {skills.map((skill) => (
                            <div key={skill.name} className="bg-white dark:bg-base-100 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-base-200">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-gray-900 dark:text-base-content">{skill.name}</h3>
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${skill.source === 'user' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                                                {skill.source === 'user' ? <><User className="w-3 h-3 inline mr-1" />{t('skills.user')}</> : <><FolderOpen className="w-3 h-3 inline mr-1" />{t('skills.project')}</>}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 font-mono">
                                            {skill.content.substring(0, 150)}...
                                        </p>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button onClick={() => setPreviewName(previewName === skill.name ? null : skill.name)} className="p-2 text-gray-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleEdit(skill.name, skill.content)} className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(skill.name)} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                {previewName === skill.name && (
                                    <pre className="mt-3 p-3 bg-gray-50 dark:bg-base-200 rounded-lg text-sm text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                                        {skill.content}
                                    </pre>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* 删除确认对话框 */}
                <ModalDialog
                    isOpen={deleteModal.isOpen}
                    title={t('skills.delete_title')}
                    message={t('skills.confirm_delete')}
                    type="confirm"
                    isDestructive={true}
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleteModal({ isOpen: false, name: '' })}
                />
            </div>
        </div>
    );
}

export default SkillsPage;

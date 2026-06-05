/**
 * 添加账号弹窗。
 * 三个模式：OAuth 浏览器登录 / 手动输入 email+token / 批量 JSON 导入。
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showToast } from '../common/ToastContainer';
import { LogIn, KeyRound, Upload } from 'lucide-react';
import ModalDialog from '../common/ModalDialog';
import { useAntigravityStore } from '../../stores/useAntigravityStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddAccountDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { addAccount, oauthLogin } = useAntigravityStore();
  const [mode, setMode] = useState<'oauth' | 'manual' | 'batch'>('oauth');
  const [email, setEmail] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [batchText, setBatchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOAuth = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await oauthLogin();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleManual = async () => {
    if (!email.trim() || !refreshToken.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      await addAccount(email.trim(), refreshToken.trim());
      setEmail('');
      setRefreshToken('');
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleBatch = async () => {
    const text = batchText.trim();
    if (!text || loading) return;

    const entries: Array<{ email: string; refreshToken: string }> = [];

    // Try parsing as JSON first
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'object' && item.refresh_token) {
            entries.push({
              email: item.email || '',
              refreshToken: item.refresh_token || item.refreshToken || '',
            });
          }
        }
      } else if (typeof parsed === 'object') {
        // Object format: { "email": "refresh_token", ... } or { accounts: [...] }
        if (parsed.accounts && Array.isArray(parsed.accounts)) {
          for (const item of parsed.accounts) {
            entries.push({
              email: item.email || '',
              refreshToken: item.refresh_token || item.refreshToken || '',
            });
          }
        } else {
          for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === 'string' && value.startsWith('1//')) {
              entries.push({ email: key, refreshToken: value });
            }
          }
        }
      }
    } catch {
      // Fallback: extract all 1// tokens via regex
      const tokenRegex = /1\/\/[a-zA-Z0-9_\-]+\.\.\.[a-zA-Z0-9_\-]+/g;
      const matches = text.match(tokenRegex) || [];
      for (const token of matches) {
        entries.push({ email: '', refreshToken: token });
      }
    }

    if (entries.length === 0) {
      setError(t('antigravity.batch_no_tokens'));
      return;
    }

    setLoading(true);
    setError('');
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      try {
        await addAccount(entry.email, entry.refreshToken);
        imported++;
      } catch (e) {
        failed++;
        if (errors.length < 3) errors.push(String(e));
      }
    }

    setLoading(false);
    setBatchText('');

    const parts: string[] = [];
    parts.push(t('antigravity.batch_imported', { count: imported }));
    if (failed > 0) {
      parts.push(t('antigravity.batch_failed', { count: failed }));
    }
    if (errors.length > 0) {
      parts.push(errors.join('\n'));
    }
    showToast(parts.join('\n'), imported > 0 ? 'success' : 'warning', 5000);

    if (imported > 0) onClose();
  };

  return (
    <ModalDialog
      isOpen={open}
      onClose={onClose}
      title={t('antigravity.add_account')}
      onConfirm={mode === 'oauth' ? handleOAuth : mode === 'manual' ? handleManual : handleBatch}
      confirmText={loading ? t('common.loading') : mode === 'oauth' ? t('antigravity.oauth_login') : t('common.add')}
      confirmClass="btn bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white border-none"
    >
      <div className="space-y-4">
        {/* Mode tabs */}
        <div className="flex gap-2">
          <button
            className={`btn btn-sm gap-1.5 ${mode === 'oauth' ? 'btn-active' : 'btn-ghost'}`}
            onClick={() => { setMode('oauth'); setError(''); }}
          >
            <LogIn className="w-4 h-4" />
            {t('antigravity.oauth_login')}
          </button>
          <button
            className={`btn btn-sm gap-1.5 ${mode === 'manual' ? 'btn-active' : 'btn-ghost'}`}
            onClick={() => { setMode('manual'); setError(''); }}
          >
            <KeyRound className="w-4 h-4" />
            {t('antigravity.manual_input')}
          </button>
          <button
            className={`btn btn-sm gap-1.5 ${mode === 'batch' ? 'btn-active' : 'btn-ghost'}`}
            onClick={() => { setMode('batch'); setError(''); }}
          >
            <Upload className="w-4 h-4" />
            {t('antigravity.batch_import')}
          </button>
        </div>

        {mode === 'oauth' ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
            <p>{t('antigravity.oauth_desc')}</p>
          </div>
        ) : mode === 'manual' ? (
          <div className="space-y-3">
            <div>
              <label className="label"><span className="label-text">{t('antigravity.email')}</span></label>
              <input
                type="email"
                className="input input-bordered w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@gmail.com"
              />
            </div>
            <div>
              <label className="label"><span className="label-text">{t('antigravity.refresh_token')}</span></label>
              <textarea
                className="textarea textarea-bordered w-full h-24"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                placeholder="1//..."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('antigravity.batch_import_desc')}
            </div>
            <textarea
              className="textarea textarea-bordered w-full h-40 font-mono text-xs"
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={`[
  { "email": "user1@gmail.com", "refresh_token": "1//..." },
  { "email": "user2@gmail.com", "refresh_token": "1//..." }
]`}
            />
          </div>
        )}

        {error && <div className="text-error text-sm whitespace-pre-wrap">{error}</div>}
      </div>
    </ModalDialog>
  );
}

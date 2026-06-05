import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogIn, KeyRound } from 'lucide-react';
import ModalDialog from '../common/ModalDialog';
import { useAntigravityStore } from '../../stores/useAntigravityStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddAccountDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { addAccount, oauthLogin } = useAntigravityStore();
  const [mode, setMode] = useState<'oauth' | 'manual'>('oauth');
  const [email, setEmail] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOAuth = async () => {
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
    if (!email.trim() || !refreshToken.trim()) return;
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

  return (
    <ModalDialog
      isOpen={open}
      onClose={onClose}
      title={t('antigravity.add_account')}
      onConfirm={mode === 'oauth' ? handleOAuth : handleManual}
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
        </div>

        {mode === 'oauth' ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
            <p>{t('antigravity.oauth_desc')}</p>
          </div>
        ) : (
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
        )}

        {error && <div className="text-error text-sm whitespace-pre-wrap">{error}</div>}
      </div>
    </ModalDialog>
  );
}

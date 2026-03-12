import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CodeBlockProps {
  children: string;
  language?: string;
  inline?: boolean;
}

export default function CodeBlock({ children, language = 'bash', inline = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (inline) {
    return (
      <code className="px-1.5 py-0.5 bg-bg-code text-accent rounded text-sm font-mono">
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between bg-bg-code px-4 py-2 rounded-t-lg border border-border border-b-0">
        <span className="text-xs text-secondary font-mono uppercase">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1.5 text-xs text-secondary hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
          aria-label={copied ? t('common.copied') : t('common.copy')}
        >
          {copied ? (
            <>
              <Check size={14} />
              <span>{t('common.copied')}</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>{t('common.copy')}</span>
            </>
          )}
        </button>
      </div>
      <pre className="bg-bg-code p-4 rounded-b-lg border border-border overflow-x-auto">
        <code className="text-sm font-mono text-primary">{children}</code>
      </pre>
    </div>
  );
}

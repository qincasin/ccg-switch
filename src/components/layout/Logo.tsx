interface LogoProps {
    size?: 'sm' | 'md';
}

export default function Logo({ size = 'md' }: LogoProps) {
    const iconSize = size === 'sm' ? 32 : 36;
    const textSize = size === 'sm' ? 'text-base' : 'text-lg';

    return (
        <div className="flex items-center gap-3 select-none">
            {/* CCG Switch SVG Icon */}
            <svg width={iconSize} height={iconSize} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="50%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <linearGradient id="switchGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                </defs>
                {/* 圆角方形背景 */}
                <rect width="40" height="40" rx="10" fill="url(#logoGrad)" opacity="0.15" />
                {/* 代码括号 { } */}
                <path d="M12 13.5C12 13.5 9.5 15 9.5 20C9.5 25 12 26.5 12 26.5" stroke="url(#logoGrad)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                <path d="M28 13.5C28 13.5 30.5 15 30.5 20C30.5 25 28 26.5 28 26.5" stroke="url(#logoGrad)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                {/* 开关/切换符号 */}
                <circle cx="20" cy="20" r="6" stroke="url(#switchGrad)" strokeWidth="2" fill="none" />
                <line x1="20" y1="12" x2="20" y2="17" stroke="url(#switchGrad)" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <span className={`${textSize} font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent`}>
                CCG Switch
            </span>
        </div>
    );
}

import { useAppStore } from '../../stores/useAppStore';
import { APP_TYPES, APP_LABELS, APP_COLORS } from '../../types/app';

function AppSwitcher() {
    const { currentApp, setCurrentApp } = useAppStore();

    return (
        <div role="tablist" className="tabs tabs-boxed bg-gray-100 dark:bg-base-200 p-1 gap-0.5">
            {APP_TYPES.map((app) => (
                <button
                    key={app}
                    role="tab"
                    onClick={() => setCurrentApp(app)}
                    className={`tab tab-sm font-medium transition-all ${
                        currentApp === app
                            ? 'tab-active !bg-white dark:!bg-base-100 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                    style={currentApp === app ? { color: APP_COLORS[app] } : undefined}
                >
                    {APP_LABELS[app]}
                </button>
            ))}
        </div>
    );
}

export default AppSwitcher;

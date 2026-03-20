import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Toast, { ToastType } from './Toast';

export interface ToastItem {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    onClick?: () => void;
}

let toastCounter = 0;
let addToastExternal: ((message: string, type: ToastType, duration?: number, onClick?: () => void) => void) | null = null;

export const showToast = (message: string, type: ToastType = 'info', duration: number = 3000, onClick?: () => void) => {
    if (addToastExternal) {
        addToastExternal(message, type, duration, onClick);
    } else {
        console.warn('ToastContainer not mounted');
    }
};

const ToastContainer = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const addToast = useCallback((message: string, type: ToastType, duration?: number, onClick?: () => void) => {
        const id = `toast-${Date.now()}-${toastCounter++}`;
        setToasts(prev => [...prev, { id, message, type, duration, onClick }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    useEffect(() => {
        addToastExternal = addToast;
        return () => {
            addToastExternal = null;
        };
    }, [addToast]);

    return createPortal(
        <div className="fixed top-24 right-8 z-[200] flex flex-col gap-3 pointer-events-none">
            <div className="flex flex-col gap-3 pointer-events-auto">
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        {...toast}
                        onClose={removeToast}
                    />
                ))}
            </div>
        </div>,
        document.body
    );
};

export default ToastContainer;

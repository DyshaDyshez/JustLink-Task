/**
 * toast.js
 * Система красивых всплывающих уведомлений
 */

let activeToast = null;
let toastTimeout = null;

export function showToast(message, type = 'success') {
    // Удаляем предыдущее уведомление, если есть
    if (activeToast) {
        clearTimeout(toastTimeout);
        activeToast.remove();
    }
    
    // Цвета для разных типов
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ff9800',
        info: '#17a2b8'
    };
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.innerHTML = `${icons[type] || icons.info} ${escapeHtml(message)}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 24px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        pointer-events: none;
        animation: toastFadeInOut 2.5s ease forwards;
        white-space: nowrap;
        max-width: 90%;
        white-space: normal;
        text-align: center;
        word-break: break-word;
    `;
    
    // Добавляем анимацию, если ещё нет
    if (!document.querySelector('#toast-style')) {
        const style = document.createElement('style');
        style.id = 'toast-style';
        style.textContent = `
            @keyframes toastFadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
                15% { opacity: 1; transform: translateX(-50%) translateY(0); }
                85% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-20px); visibility: hidden; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    activeToast = toast;
    
    toastTimeout = setTimeout(() => {
        if (toast && toast.remove) toast.remove();
        activeToast = null;
    }, 2500);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
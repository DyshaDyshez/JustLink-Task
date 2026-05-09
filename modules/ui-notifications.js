/**
 * ui-notifications.js
 * Стилизованные модалки вместо alert/confirm/prompt
 */

// Показываем модальное сообщение (alert)
export function showMessage(title, message, type = 'info') {
    // Удаляем старую модалку, если есть
    const existing = document.getElementById('custom-notification-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'custom-notification-modal';
    modal.className = 'custom-modal-overlay';
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '📢';
    const titleColor = type === 'success' ? 'var(--green-primary)' : type === 'error' ? 'var(--red-error)' : type === 'warning' ? 'var(--yellow-warning)' : 'var(--text-primary)';
    
    modal.innerHTML = `
        <div class="custom-modal-container" style="max-width: 400px;">
            <div class="custom-modal-header" style="border-bottom-color: ${titleColor}40;">
                <span style="color: ${titleColor};">${icon} ${escapeHtml(title)}</span>
                <button class="custom-modal-close">&times;</button>
            </div>
            <div class="custom-modal-body">
                <p>${escapeHtml(message)}</p>
            </div>
            <div class="custom-modal-footer">
                <button class="custom-modal-btn" id="custom-modal-ok">OK</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeBtn = modal.querySelector('.custom-modal-close');
    const okBtn = modal.querySelector('#custom-modal-ok');
    
    const close = () => modal.remove();
    closeBtn.onclick = close;
    okBtn.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };
}

// Модальный confirm (возвращает Promise<boolean>)
export function showConfirm(title, message, confirmText = 'Да', cancelText = 'Нет') {
    return new Promise((resolve) => {
        const existing = document.getElementById('custom-confirm-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'custom-confirm-modal';
        modal.className = 'custom-modal-overlay';
        
        modal.innerHTML = `
            <div class="custom-modal-container" style="max-width: 400px;">
                <div class="custom-modal-header">
                    <span>❓ ${escapeHtml(title)}</span>
                    <button class="custom-modal-close">&times;</button>
                </div>
                <div class="custom-modal-body">
                    <p>${escapeHtml(message)}</p>
                </div>
                <div class="custom-modal-footer" style="justify-content: center; gap: 12px;">
                    <button class="custom-modal-btn custom-modal-cancel">${escapeHtml(cancelText)}</button>
                    <button class="custom-modal-btn custom-modal-confirm">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeBtn = modal.querySelector('.custom-modal-close');
        const cancelBtn = modal.querySelector('.custom-modal-cancel');
        const confirmBtn = modal.querySelector('.custom-modal-confirm');
        
        const close = () => modal.remove();
        closeBtn.onclick = () => { close(); resolve(false); };
        cancelBtn.onclick = () => { close(); resolve(false); };
        confirmBtn.onclick = () => { close(); resolve(true); };
        modal.onclick = (e) => { if (e.target === modal) { close(); resolve(false); } };
    });
}

// Модальный prompt (возвращает Promise<string | null>)
export function showPrompt(title, message, defaultValue = '') {
    return new Promise((resolve) => {
        const existing = document.getElementById('custom-prompt-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'custom-prompt-modal';
        modal.className = 'custom-modal-overlay';
        
        modal.innerHTML = `
            <div class="custom-modal-container" style="max-width: 400px;">
                <div class="custom-modal-header">
                    <span>✏️ ${escapeHtml(title)}</span>
                    <button class="custom-modal-close">&times;</button>
                </div>
                <div class="custom-modal-body">
                    <p>${escapeHtml(message)}</p>
                    <input type="text" id="custom-prompt-input" class="custom-modal-input" value="${escapeHtml(defaultValue)}">
                </div>
                <div class="custom-modal-footer" style="justify-content: center; gap: 12px;">
                    <button class="custom-modal-btn custom-modal-cancel">Отмена</button>
                    <button class="custom-modal-btn custom-modal-confirm">OK</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const input = modal.querySelector('#custom-prompt-input');
        const closeBtn = modal.querySelector('.custom-modal-close');
        const cancelBtn = modal.querySelector('.custom-modal-cancel');
        const confirmBtn = modal.querySelector('.custom-modal-confirm');
        
        const close = () => modal.remove();
        const confirm = () => {
            const value = input.value;
            close();
            resolve(value);
        };
        
        closeBtn.onclick = () => { close(); resolve(null); };
        cancelBtn.onclick = () => { close(); resolve(null); };
        confirmBtn.onclick = confirm;
        input.onkeypress = (e) => { if (e.key === 'Enter') confirm(); };
        modal.onclick = (e) => { if (e.target === modal) { close(); resolve(null); } };
        input.focus();
    });
}

// Модалка с формой (для сложного ввода)
// Показывает модалку с формой (поддерживает text, textarea, datetime-local, select)
export async function showFormModal(title, fields, submitText = 'Сохранить') {
    return new Promise((resolve) => {
        const existing = document.getElementById('custom-form-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'custom-form-modal';
        modal.className = 'custom-modal-overlay';
        
        let fieldsHtml = '';
        fields.forEach(field => {
            if (field.type === 'select' && field.options) {
                // Генерация выпадающего списка
                let optionsHtml = '';
                field.options.forEach(opt => {
                    const selected = field.value === opt.id ? 'selected' : '';
                    optionsHtml += `<option value="${escapeHtml(opt.id)}" ${selected}>${escapeHtml(opt.name)}</option>`;
                });
                fieldsHtml += `
                    <div class="custom-modal-field">
                        <label>${escapeHtml(field.label)}</label>
                        <select id="field_${field.name}" class="custom-modal-input">
                            ${optionsHtml}
                        </select>
                    </div>
                `;
            } else if (field.type === 'textarea') {
                fieldsHtml += `
                    <div class="custom-modal-field">
                        <label>${escapeHtml(field.label)}</label>
                        <textarea id="field_${field.name}" class="custom-modal-input" placeholder="${escapeHtml(field.placeholder || '')}" rows="${field.rows || 3}">${escapeHtml(field.value || '')}</textarea>
                    </div>
                `;
            } else if (field.type === 'datetime-local') {
                fieldsHtml += `
                    <div class="custom-modal-field">
                        <label>${escapeHtml(field.label)}</label>
                        <input type="datetime-local" id="field_${field.name}" class="custom-modal-input" value="${escapeHtml(field.value || '')}">
                    </div>
                `;
            } else {
                fieldsHtml += `
                    <div class="custom-modal-field">
                        <label>${escapeHtml(field.label)}</label>
                        <input type="${field.type || 'text'}" id="field_${field.name}" class="custom-modal-input" placeholder="${escapeHtml(field.placeholder || '')}" value="${escapeHtml(field.value || '')}">
                    </div>
                `;
            }
        });
        
        modal.innerHTML = `
            <div class="custom-modal-container" style="max-width: 500px;">
                <div class="custom-modal-header">
                    <span>📝 ${escapeHtml(title)}</span>
                    <button class="custom-modal-close">&times;</button>
                </div>
                <div class="custom-modal-body">
                    <form id="custom-modal-form">
                        ${fieldsHtml}
                    </form>
                </div>
                <div class="custom-modal-footer" style="justify-content: center; gap: 12px;">
                    <button class="custom-modal-btn custom-modal-cancel">Отмена</button>
                    <button class="custom-modal-btn custom-modal-confirm" type="submit" form="custom-modal-form">${escapeHtml(submitText)}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const form = modal.querySelector('#custom-modal-form');
        const closeBtn = modal.querySelector('.custom-modal-close');
        const cancelBtn = modal.querySelector('.custom-modal-cancel');
        
        const close = () => modal.remove();
        
        form.onsubmit = (e) => {
            e.preventDefault();
            const result = {};
            fields.forEach(field => {
                result[field.name] = document.getElementById(`field_${field.name}`).value;
            });
            close();
            resolve(result);
        };
        
        closeBtn.onclick = () => { close(); resolve(null); };
        cancelBtn.onclick = () => { close(); resolve(null); };
        modal.onclick = (e) => { if (e.target === modal) { close(); resolve(null); } };
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
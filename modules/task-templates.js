/**
 * task-templates.js
 * Шаблоны задач для быстрого создания
 */

import { auth, db } from './firebase-init.js';
import { collection, addDoc, deleteDoc, doc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { showMessage, showConfirm, showFormModal } from './ui-notifications.js';

let currentAdminId = null;

export function initTaskTemplates() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentAdminId = user.uid;
            loadTemplates();
        }
    });
}

function loadTemplates() {
    if (!currentAdminId) return;
    
    const q = query(collection(db, 'taskTemplates'), where('adminId', '==', currentAdminId));
    
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('taskTemplatesList');
        if (!container) return;
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-message">Нет шаблонов. Создайте первый!</div>';
            return;
        }
        
        container.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const template = docSnap.data();
            const templateId = docSnap.id;
            
            const item = document.createElement('div');
            item.className = 'template-item';
            item.innerHTML = `
                <div class="template-info">
                    <strong>📋 ${escapeHtml(template.title)}</strong>
                    ${template.description ? `<div class="template-desc">${escapeHtml(template.description)}</div>` : ''}
                </div>
                <div class="template-actions">
                    <button class="template-use-btn" data-id="${templateId}">📝 Использовать</button>
                    <button class="template-delete-btn" data-id="${templateId}">🗑️</button>
                </div>
            `;
            
            item.querySelector('.template-use-btn').onclick = () => useTemplate(template.title, template.description);
            item.querySelector('.template-delete-btn').onclick = () => deleteTemplate(templateId);
            container.appendChild(item);
        });
    });
}

// Создать новый шаблон
export async function createTemplate() {
    const result = await showFormModal('Новый шаблон задачи', [
        { name: 'title', label: 'Название шаблона', type: 'text', placeholder: 'Например: Еженедельный отчёт' },
        { name: 'description', label: 'Описание (необязательно)', type: 'textarea', placeholder: 'Подробное описание задачи...' }
    ], 'Создать шаблон');
    
    if (!result || !result.title?.trim()) return;
    
    try {
        await addDoc(collection(db, 'taskTemplates'), {
            adminId: currentAdminId,
            title: result.title.trim(),
            description: result.description?.trim() || '',
            createdAt: new Date()
        });
        await showMessage('Успех', `Шаблон "${result.title}" создан`, 'success');
    } catch (error) {
        await showMessage('Ошибка', error.message, 'error');
    }
}

// Использовать шаблон (заполнить поля создания задачи)
function useTemplate(title, description) {
    const titleInput = document.getElementById('taskTitleInput');
    const descInput = document.getElementById('taskDescInput');
    
    if (titleInput) titleInput.value = title;
    if (descInput) descInput.value = description || '';
    
    showMessage('Шаблон применён', 'Данные заполнены, выберите исполнителя и дедлайн', 'success');
}

// Удалить шаблон
async function deleteTemplate(templateId) {
    const confirmed = await showConfirm('Удаление', 'Удалить этот шаблон?');
    if (!confirmed) return;
    
    try {
        await deleteDoc(doc(db, 'taskTemplates', templateId));
        await showMessage('Успех', 'Шаблон удалён', 'success');
    } catch (error) {
        await showMessage('Ошибка', error.message, 'error');
    }
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
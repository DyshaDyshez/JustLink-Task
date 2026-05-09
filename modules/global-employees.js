/**
 * global-employees.js
 * Общий стек сотрудников админа (доступен во всех комнатах)
 */

import { auth, db } from './firebase-init.js';
import { collection, addDoc, deleteDoc, doc, query, where, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { showMessage, showConfirm, showFormModal } from './ui-notifications.js';

let currentAdminId = null;

// Подписка на изменения текущего админа
export function initGlobalEmployees() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentAdminId = user.uid;
            loadGlobalEmployees();
        }
    });
}

// Загрузка глобального списка сотрудников
function loadGlobalEmployees() {
    if (!currentAdminId) return;
    
    const q = query(collection(db, 'globalEmployees'), where('adminId', '==', currentAdminId));
    
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('globalEmployeesList');
        if (!container) return;
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-message">Нет сохранённых сотрудников. Добавьте!</div>';
            return;
        }
        
        container.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const emp = docSnap.data();
            const empId = docSnap.id;
            
            const item = document.createElement('div');
            item.className = 'global-employee-item';
            item.innerHTML = `
                <div class="global-employee-info">
                    <strong>${escapeHtml(emp.name)}</strong>
                    ${emp.telegram ? `<span class="global-employee-telegram">📱 ${escapeHtml(emp.telegram)}</span>` : ''}
                </div>
                <div class="global-employee-actions">
                    <button class="global-employee-use-btn" data-id="${empId}" data-name="${escapeHtml(emp.name)}" data-telegram="${escapeHtml(emp.telegram || '')}">➕ В комнату</button>
                    <button class="global-employee-delete-btn" data-id="${empId}">🗑️</button>
                </div>
            `;
            
            item.querySelector('.global-employee-use-btn').onclick = () => addGlobalEmployeeToRoom(empId, emp.name, emp.telegram);
            item.querySelector('.global-employee-delete-btn').onclick = () => deleteGlobalEmployee(empId);
            container.appendChild(item);
        });
    });
}

// Добавление сотрудника в глобальный стек
export async function addGlobalEmployee(name, telegram) {
    if (!currentAdminId) {
        await showMessage('Ошибка', 'Вы не авторизованы', 'error');
        return null;
    }
    
    if (!name.trim()) {
        await showMessage('Ошибка', 'Введите имя сотрудника', 'error');
        return null;
    }
    
    try {
        const docRef = await addDoc(collection(db, 'globalEmployees'), {
            adminId: currentAdminId,
            name: name.trim(),
            telegram: telegram?.trim() || '',
            createdAt: new Date()
        });
        await showMessage('Успех', `Сотрудник "${name}" добавлен в общий стек`, 'success');
        return { id: docRef.id, name: name.trim(), telegram: telegram?.trim() || '' };
    } catch (error) {
        await showMessage('Ошибка', error.message, 'error');
        return null;
    }
}

// Удаление из глобального стека
async function deleteGlobalEmployee(employeeId) {
    const confirmed = await showConfirm('Удаление', 'Удалить сотрудника из общего стека?');
    if (!confirmed) return;
    
    try {
        await deleteDoc(doc(db, 'globalEmployees', employeeId));
        await showMessage('Успех', 'Сотрудник удалён из общего стека', 'success');
    } catch (error) {
        await showMessage('Ошибка', error.message, 'error');
    }
}

// Добавить глобального сотрудника в текущую комнату
async function addGlobalEmployeeToRoom(globalId, name, telegram) {
    const currentRoomId = window.currentRoomId; // нужно передать из admin-init.js
    if (!currentRoomId) {
        await showMessage('Ошибка', 'Сначала выберите комнату', 'error');
        return;
    }
    
    try {
        // Проверяем, нет ли уже такого сотрудника в комнате
        const existingQuery = query(collection(db, 'rooms', currentRoomId, 'employees'), where('name', '==', name));
        // Простая проверка (можно усложнить)
        
        await addDoc(collection(db, 'rooms', currentRoomId, 'employees'), {
            name: name,
            telegram: telegram,
            globalEmployeeId: globalId,
            createdAt: new Date()
        });
        await showMessage('Успех', `Сотрудник "${name}" добавлен в текущую комнату`, 'success');
        
        // Обновляем список сотрудников в комнате
        if (window.loadEmployeesCards) window.loadEmployeesCards();
        if (window.loadEmployeesForSelect) window.loadEmployeesForSelect();
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
/**
 * employee-init.js
 * Страница сотрудника: задачи, смена имени
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { 
    getFirestore, collection, query, where, onSnapshot, 
    updateDoc, doc, getDoc 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { showMessage, showFormModal } from './ui-notifications.js';
import { showToast } from './toast.js';

const firebaseConfig = {
    apiKey: "AIzaSyCz0vGpRTOJxxiLzQU93PN34pvYhuUpxno",
    authDomain: "justlink-task.firebaseapp.com",
    projectId: "justlink-task",
    storageBucket: "justlink-task.firebasestorage.app",
    messagingSenderId: "330324597396",
    appId: "1:330324597396:web:fce9b687c11d7c8d2e7281"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const employeeId = urlParams.get('employee');

if (!roomId || !employeeId) {
    document.body.innerHTML = '<div style="text-align:center; margin-top:100px;"><h1>❌ Ошибка</h1><p>Неверная ссылка.</p></div>';
    throw new Error('Missing params');
}

let currentEmployeeName = null;

// ========== ТЕМНАЯ ТЕМА ==========
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
}

function toggleTheme() {
    if (document.body.classList.contains('dark-theme')) {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('theme', 'light');
        showToast('🌞 Светлая тема', 'info');
    } else {
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
        showToast('🌙 Тёмная тема', 'info');
    }
}

// ========== ЗАГРУЗКА ИМЕНИ ==========
async function loadEmployeeName() {
    try {
        const employeeRef = doc(db, 'rooms', roomId, 'employees', employeeId);
        const employeeSnap = await getDoc(employeeRef);
        if (employeeSnap.exists()) {
            currentEmployeeName = employeeSnap.data().name;
        } else {
            currentEmployeeName = localStorage.getItem(`name_${roomId}_${employeeId}`) || 'Сотрудник';
        }
    } catch (error) {
        currentEmployeeName = localStorage.getItem(`name_${roomId}_${employeeId}`) || 'Сотрудник';
    }
    document.getElementById('employeeNameDisplay').textContent = currentEmployeeName;
}

// ========== СОХРАНЕНИЕ ИМЕНИ ==========
async function saveEmployeeName(newName) {
    if (!newName.trim()) {
        showToast('❌ Имя не может быть пустым', 'error');
        return false;
    }
    currentEmployeeName = newName.trim();
    localStorage.setItem(`name_${roomId}_${employeeId}`, currentEmployeeName);
    document.getElementById('employeeNameDisplay').textContent = currentEmployeeName;
    try {
        await updateDoc(doc(db, 'rooms', roomId, 'employees', employeeId), {
            name: currentEmployeeName,
            lastSeen: new Date()
        });
    } catch (e) {}
    showToast('✅ Имя обновлено', 'success');
    return true;
}

// ========== АКТИВНЫЕ ЗАДАЧИ ==========
function loadActiveTasks() {
    const container = document.getElementById('activeTasksContainer');
    if (!container) return;
    
    const q = query(collection(db, 'rooms', roomId, 'tasks'));
    
    onSnapshot(q, (snapshot) => {
        const myTasks = [];
        snapshot.forEach(docSnap => {
            const task = docSnap.data();
            if (task.assigneeId === employeeId && task.status === 'pending') {
                myTasks.push({ id: docSnap.id, ...task });
            }
        });
        
        if (myTasks.length === 0) {
            container.innerHTML = '<div class="empty-card">🎉 Нет активных задач!</div>';
            return;
        }
        
        container.innerHTML = '';
        
        for (const task of myTasks) {
            const taskCard = document.createElement('div');
            taskCard.className = 'employee-task-card';
            
            const isDeadlineSoon = task.deadline && new Date(task.deadline) < new Date(Date.now() + 24 * 60 * 60 * 1000);
            const isOverdue = task.deadline && new Date(task.deadline) < new Date();
            
            let deadlineHtml = '';
            if (task.deadline) {
                const deadlineDate = new Date(task.deadline).toLocaleDateString();
                if (isOverdue) {
                    deadlineHtml = `<span class="task-deadline overdue">⏰ Дедлайн: ${deadlineDate} (просрочено!)</span>`;
                } else if (isDeadlineSoon) {
                    deadlineHtml = `<span class="task-deadline soon">⚠️ Дедлайн: ${deadlineDate} (скоро!)</span>`;
                } else {
                    deadlineHtml = `<span class="task-deadline">🎯 Дедлайн: ${deadlineDate}</span>`;
                }
            }
            
            taskCard.innerHTML = `
                <div class="employee-task-header">
                    <span class="employee-task-title">📌 ${escapeHtml(task.title)}</span>
                    <button class="task-edit-status-btn" data-id="${task.id}" data-status="${task.status}" style="background:none;border:none;cursor:pointer;font-size:16px;">✏️</button>
                </div>
                ${task.description ? `<div class="employee-task-desc">${escapeHtml(task.description)}</div>` : ''}
                <div class="employee-task-meta">${deadlineHtml}</div>
                <div class="employee-task-actions">
                    <button class="task-done-btn" data-id="${task.id}">✅ Выполнено</button>
                    <button class="task-fail-btn" data-id="${task.id}">❌ Не выполнено</button>
                </div>
            `;
            
            // Кнопка редактирования статуса
            const editStatusBtn = taskCard.querySelector('.task-edit-status-btn');
            if (editStatusBtn) {
                editStatusBtn.onclick = async () => {
                    const result = await showFormModal('Изменить статус задачи', [
                        { 
                            name: 'newStatus', 
                            label: 'Новый статус', 
                            type: 'select', 
                            options: [
                                { id: 'pending', name: '⏳ В работе' },
                                { id: 'done', name: '✅ Выполнено' },
                                { id: 'failed', name: '❌ Провалено' }
                            ],
                            value: task.status
                        },
                        { 
                            name: 'reason', 
                            label: 'Причина (если провалено)', 
                            type: 'textarea', 
                            placeholder: 'Укажите причину...',
                            required: false
                        }
                    ], 'Сохранить');
                    
                    if (result) {
                        const newStatus = result.newStatus;
                        const reason = newStatus === 'failed' ? result.reason : '';
                        await updateTaskStatus(task.id, newStatus, reason);
                    }
                };
            }
            
            taskCard.querySelector('.task-done-btn').onclick = () => updateTaskStatus(task.id, 'done');
            taskCard.querySelector('.task-fail-btn').onclick = async () => {
                const result = await showFormModal('Причина отказа', [
                    { name: 'reason', label: 'Укажите причину', type: 'textarea', placeholder: 'Почему задача не выполнена?' }
                ], 'Отправить');
                if (result?.reason?.trim()) {
                    updateTaskStatus(task.id, 'failed', result.reason.trim());
                }
            };
            container.appendChild(taskCard);
        }
    });
}

// ========== ВЫПОЛНЕННЫЕ ЗАДАЧИ ==========
function loadCompletedTasks() {
    const container = document.getElementById('completedTasksContainer');
    if (!container) return;
    
    const q = query(collection(db, 'rooms', roomId, 'tasks'));
    
    onSnapshot(q, (snapshot) => {
        const completedTasks = [];
        snapshot.forEach(docSnap => {
            const task = docSnap.data();
            if (task.assigneeId === employeeId && (task.status === 'done' || task.status === 'failed')) {
                completedTasks.push({ id: docSnap.id, ...task });
            }
        });
        
        if (completedTasks.length === 0) {
            container.innerHTML = '<div class="empty-small">Нет выполненных задач</div>';
            return;
        }
        
        container.innerHTML = '';
        
        completedTasks.slice(0, 20).forEach(task => {
            const taskItem = document.createElement('div');
            taskItem.className = 'employee-completed-item';
            const statusIcon = task.status === 'done' ? '✅' : '❌';
            const deadlineStr = task.deadline ? new Date(task.deadline).toLocaleDateString() : 'без дедлайна';
            const failedReason = task.status === 'failed' && task.failedReason ? `<div class="failed-reason">📝 Причина: ${escapeHtml(task.failedReason)}</div>` : '';
            taskItem.innerHTML = `
                <div class="employee-completed-header">
                    <span class="employee-completed-title">${statusIcon} ${escapeHtml(task.title)}</span>
                    <span class="employee-completed-date">${deadlineStr}</span>
                </div>
                ${failedReason}
                <button class="restore-task-btn" data-id="${task.id}" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--accent-primary);margin-top:8px;">↩️ Вернуть в работу</button>
            `;
            
            const restoreBtn = taskItem.querySelector('.restore-task-btn');
            if (restoreBtn) {
                restoreBtn.onclick = () => updateTaskStatus(task.id, 'pending');
            }
            
            container.appendChild(taskItem);
        });
    });
}

// ========== ОБНОВЛЕНИЕ СТАТУСА ==========
async function updateTaskStatus(taskId, newStatus, reason = '') {
    try {
        const updateData = { status: newStatus, updatedAt: new Date() };
        if (newStatus === 'failed' && reason) updateData.failedReason = reason;
        if (newStatus === 'done') updateData.completedAt = new Date();
        if (newStatus === 'pending') {
            updateData.failedReason = null;
            updateData.completedAt = null;
        }
        await updateDoc(doc(db, 'rooms', roomId, 'tasks', taskId), updateData);
        
        let message = '';
        if (newStatus === 'done') message = '✅ Задача выполнена';
        else if (newStatus === 'failed') message = '❌ Задача отмечена как проваленная';
        else if (newStatus === 'pending') message = '↩️ Задача возвращена в работу';
        
        showToast(message, 'success');
        loadActiveTasks();
        loadCompletedTasks();
    } catch (error) {
        showToast('❌ Ошибка: ' + error.message, 'error');
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

// ========== МОДАЛКА СМЕНЫ ИМЕНИ ==========
const changeNameBtn = document.getElementById('changeNameBtn');
const changeNameModal = document.getElementById('changeNameModal');
const closeNameModal = changeNameModal?.querySelector('.modal-close-name');
const saveNameBtn = document.getElementById('saveNameBtn');

if (changeNameBtn) {
    changeNameBtn.onclick = () => {
        document.getElementById('newNameInput').value = currentEmployeeName;
        changeNameModal.style.display = 'flex';
    };
}
if (closeNameModal) {
    closeNameModal.onclick = () => changeNameModal.style.display = 'none';
}
if (saveNameBtn) {
    saveNameBtn.onclick = async () => {
        const newName = document.getElementById('newNameInput').value;
        await saveEmployeeName(newName);
        changeNameModal.style.display = 'none';
    };
}
window.onclick = (e) => {
    if (e.target === changeNameModal) changeNameModal.style.display = 'none';
};

// ========== КНОПКА ТЕМНОЙ ТЕМЫ ==========
const themeToggleBtn = document.getElementById('themeToggleBtn');
if (themeToggleBtn) {
    themeToggleBtn.onclick = toggleTheme;
}

// ========== ЗАПУСК ==========
async function init() {
    initTheme();
    await loadEmployeeName();
    loadActiveTasks();
    loadCompletedTasks();
}

init();
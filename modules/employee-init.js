/**
 * employee-init.js
 * Страница сотрудника: задачи, смена имени
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { 
    getFirestore, collection, query, where, onSnapshot, 
    updateDoc, doc, getDoc 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { showMessage } from './ui-notifications.js';

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

async function saveEmployeeName(newName) {
    if (!newName.trim()) {
        await showMessage('Ошибка', 'Имя не может быть пустым', 'error');
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
    await showMessage('Успех', 'Имя обновлено', 'success');
    return true;
}

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
                </div>
                ${task.description ? `<div class="employee-task-desc">${escapeHtml(task.description)}</div>` : ''}
                <div class="employee-task-meta">${deadlineHtml}</div>
                <div class="employee-task-actions">
                    <button class="task-done-btn" data-id="${task.id}">✅ Выполнено</button>
                    <button class="task-fail-btn" data-id="${task.id}">❌ Не выполнено</button>
                </div>
            `;
            
            taskCard.querySelector('.task-done-btn').onclick = () => updateTaskStatus(task.id, 'done');
            taskCard.querySelector('.task-fail-btn').onclick = async () => {
                const reason = prompt('Причина отказа:');
                if (reason?.trim()) updateTaskStatus(task.id, 'failed', reason.trim());
            };
            container.appendChild(taskCard);
        }
    });
}

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
            `;
            container.appendChild(taskItem);
        });
    });
}

async function updateTaskStatus(taskId, newStatus, reason = '') {
    try {
        const updateData = { status: newStatus, updatedAt: new Date() };
        if (newStatus === 'failed' && reason) updateData.failedReason = reason;
        if (newStatus === 'done') updateData.completedAt = new Date();
        await updateDoc(doc(db, 'rooms', roomId, 'tasks', taskId), updateData);
        await showMessage('Успех', `Задача ${newStatus === 'done' ? 'выполнена' : 'отмечена'}`, 'success');
        loadActiveTasks();
        loadCompletedTasks();
    } catch (error) {
        await showMessage('Ошибка', error.message, 'error');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

// Модалка смены имени
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

async function init() {
    await loadEmployeeName();
    loadActiveTasks();
    loadCompletedTasks();
}

init();
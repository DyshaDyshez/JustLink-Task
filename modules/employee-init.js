/**
 * employee-init.js
 * Страница сотрудника: показывает только его задачи, позволяет отметить выполнение/отказ
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, collection, query, where, onSnapshot, updateDoc, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { showMessage } from './ui-notifications.js';

// ========== FIREBASE КОНФИГ ==========
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

// ========== ПАРАМЕТРЫ ИЗ URL ==========
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const urlEmployeeId = urlParams.get('employee');

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let currentEmployeeId = null;
let currentEmployeeName = null;

// ========== ПРОВЕРКА ПАРАМЕТРОВ ==========
if (!roomId) {
    document.body.innerHTML = '<div style="text-align:center; margin-top:100px;"><h1>❌ Ошибка</h1><p>Не указана комната. Обратитесь к руководителю.</p></div>';
    throw new Error('roomId не указан');
}

if (!urlEmployeeId) {
    document.body.innerHTML = '<div style="text-align:center; margin-top:100px;"><h1>❌ Ошибка</h1><p>Не указан идентификатор сотрудника. Обратитесь к руководителю.</p></div>';
    throw new Error('employeeId не указан');
}

currentEmployeeId = urlEmployeeId;

// ========== ЗАГРУЗКА ИМЕНИ СОТРУДНИКА (из Firestore или localStorage) ==========
async function loadEmployeeName() {
    try {
        // Пробуем получить имя из Firestore
        const employeeRef = doc(db, 'rooms', roomId, 'employees', currentEmployeeId);
        const employeeSnap = await getDoc(employeeRef);
        
        if (employeeSnap.exists()) {
            currentEmployeeName = employeeSnap.data().name;
            localStorage.setItem(`justtask_name_${roomId}_${currentEmployeeId}`, currentEmployeeName);
        } else {
            // Если сотрудник не найден в БД, пробуем взять из localStorage
            const savedName = localStorage.getItem(`justtask_name_${roomId}_${currentEmployeeId}`);
            if (savedName) {
                currentEmployeeName = savedName;
            } else {
                currentEmployeeName = 'Сотрудник';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки имени:', error);
        const savedName = localStorage.getItem(`justtask_name_${roomId}_${currentEmployeeId}`);
        currentEmployeeName = savedName || 'Сотрудник';
    }
    
    document.getElementById('employeeNameDisplay').textContent = currentEmployeeName;
}

// ========== СОХРАНЕНИЕ НОВОГО ИМЕНИ ==========
async function saveEmployeeName(newName) {
    if (!newName.trim()) {
        alert('Имя не может быть пустым');
        return false;
    }
    
    currentEmployeeName = newName.trim();
    
    // Сохраняем в localStorage
    localStorage.setItem(`justtask_name_${roomId}_${currentEmployeeId}`, currentEmployeeName);
    
    // Пытаемся сохранить в Firestore (если есть доступ)
    try {
        const employeeRef = doc(db, 'rooms', roomId, 'employees', currentEmployeeId);
        await updateDoc(employeeRef, {
            name: currentEmployeeName,
            lastSeen: new Date()
        });
    } catch (error) {
        // Если нет прав на запись (обычно у сотрудника их нет) — просто игнорируем
        console.log('Не удалось сохранить имя в БД, сохранено локально');
    }
    
    document.getElementById('employeeNameDisplay').textContent = currentEmployeeName;
    return true;
}

// ========== ЗАГРУЗКА АКТИВНЫХ ЗАДАЧ ==========
function loadActiveTasks() {
    const container = document.getElementById('activeTasksContainer');
    if (!container) return;
    
    const q = query(collection(db, 'rooms', roomId, 'tasks'));
    
    onSnapshot(q, async (snapshot) => {
        // Фильтруем задачи текущего сотрудника
        const myTasks = [];
        snapshot.forEach(docSnap => {
            const task = docSnap.data();
            if (task.assigneeId === currentEmployeeId && task.status === 'pending') {
                myTasks.push({ id: docSnap.id, ...task });
            }
        });
        
        if (myTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-card">
                    🎉 У вас нет активных задач!
                    <br><small>Отдыхайте или спросите у руководителя</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        for (const task of myTasks) {
            const taskCard = document.createElement('div');
            taskCard.className = 'employee-task-card';
            
            // Проверяем, скоро ли дедлайн (менее 24 часов)
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
                <div class="employee-task-meta">
                    ${deadlineHtml}
                </div>
                <div class="employee-task-actions">
                    <button class="task-done-btn" data-id="${task.id}">✅ Выполнено</button>
                    <button class="task-fail-btn" data-id="${task.id}">❌ Не выполнено</button>
                </div>
            `;
            
            // Кнопка "Выполнено"
            const doneBtn = taskCard.querySelector('.task-done-btn');
            doneBtn.onclick = () => updateTaskStatus(task.id, 'done');
            
            // Кнопка "Не выполнено"
            const failBtn = taskCard.querySelector('.task-fail-btn');
            failBtn.onclick = () => {
                const reason = prompt('Укажите причину, почему задача не выполнена:');
                if (reason && reason.trim()) {
                    updateTaskStatus(task.id, 'failed', reason.trim());
                } else if (reason === '') {
                    alert('Пожалуйста, укажите причину');
                }
            };
            
            container.appendChild(taskCard);
        }
    });
}

// ========== ЗАГРУЗКА ВЫПОЛНЕННЫХ И ОТКЛОНЁННЫХ ЗАДАЧ ==========
function loadCompletedTasks() {
    const container = document.getElementById('completedTasksContainer');
    if (!container) return;
    
    const q = query(collection(db, 'rooms', roomId, 'tasks'));
    
    onSnapshot(q, (snapshot) => {
        const completedTasks = [];
        snapshot.forEach(docSnap => {
            const task = docSnap.data();
            if (task.assigneeId === currentEmployeeId && (task.status === 'done' || task.status === 'failed')) {
                completedTasks.push({ id: docSnap.id, ...task });
            }
        });
        
        if (completedTasks.length === 0) {
            container.innerHTML = '<div class="empty-small">Пока нет выполненных или отклонённых задач</div>';
            return;
        }
        
        container.innerHTML = '';
        // Показываем последние 20, сортируем по дате обновления (новые сверху)
        completedTasks.sort((a, b) => {
            const dateA = a.updatedAt?.toDate?.() || new Date(0);
            const dateB = b.updatedAt?.toDate?.() || new Date(0);
            return dateB - dateA;
        }).slice(0, 20).forEach(task => {
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
        
        if (completedTasks.length > 20) {
            const more = document.createElement('div');
            more.className = 'completed-more';
            more.textContent = `+ ещё ${completedTasks.length - 20} задач`;
            container.appendChild(more);
        }
    });
}

// ========== ОБНОВЛЕНИЕ СТАТУСА ЗАДАЧИ ==========
async function updateTaskStatus(taskId, newStatus, reason = '') {
    try {
        const updateData = {
            status: newStatus,
            updatedAt: new Date()
        };
        
        if (newStatus === 'failed' && reason) {
            updateData.failedReason = reason;
        }
        
        if (newStatus === 'done') {
            updateData.completedAt = new Date();
        }
        
        await updateDoc(doc(db, 'rooms', roomId, 'tasks', taskId), updateData);
        
        if (newStatus === 'done') {
            alert('✅ Задача отмечена как выполненная!');
        } else {
            alert('❌ Задача отмечена как невыполненная');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка при обновлении статуса: ' + error.message);
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ========== ИНИЦИАЛИЗАЦИЯ МОДАЛКИ СМЕНЫ ИМЕНИ ==========
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
    closeNameModal.onclick = () => {
        changeNameModal.style.display = 'none';
    };
}

if (saveNameBtn) {
    saveNameBtn.onclick = async () => {
        const newName = document.getElementById('newNameInput').value;
        await saveEmployeeName(newName);
        changeNameModal.style.display = 'none';
    };
}

// Закрытие модалки по клику вне
window.onclick = (e) => {
    if (e.target === changeNameModal) {
        changeNameModal.style.display = 'none';
    }
};

// ========== ЗАПУСК ==========
async function init() {
    await loadEmployeeName();
    loadActiveTasks();
    loadCompletedTasks();
}

init();

// ========== ПРОВЕРКА ДЕДЛАЙНОВ И УВЕДОМЛЕНИЯ ==========
let notifiedTasks = new Set(); // чтобы не спамить повторно

function checkDeadlinesAndNotify(tasks) {
    const now = new Date();
    const soonTasks = [];
    
    tasks.forEach(task => {
        if (task.status !== 'pending') return;
        if (!task.deadline) return;
        
        const deadline = new Date(task.deadline);
        const hoursLeft = (deadline - now) / (1000 * 60 * 60);
        const taskKey = `${task.id}_${task.assigneeId}`;
        
        // Уведомляем за 24 часа и за 1 час
        if ((hoursLeft <= 24 && hoursLeft > 23) || (hoursLeft <= 1 && hoursLeft > 0)) {
            if (!notifiedTasks.has(taskKey)) {
                notifiedTasks.add(taskKey);
                soonTasks.push({ title: task.title, deadline: deadline, hoursLeft: hoursLeft });
            }
        }
        
        // Если дедлайн прошёл и задача не выполнена
        if (deadline < now && !notifiedTasks.has(`overdue_${task.id}`)) {
            notifiedTasks.add(`overdue_${task.id}`);
            soonTasks.push({ title: task.title, deadline: deadline, isOverdue: true });
        }
    });
    
    if (soonTasks.length > 0) {
        const message = soonTasks.map(t => {
            if (t.isOverdue) return `⚠️ ПРОСРОЧЕНО: "${t.title}"`;
            const hours = Math.round(t.hoursLeft);
            return `⚠️ "${t.title}" — дедлайн через ${hours} ${declensionHours(hours)}`;
        }).join('\n');
        
        showMessage('⏰ Внимание! Дедлайны', message, 'warning');
    }
}

function declensionHours(hours) {
    if (hours % 10 === 1 && hours % 100 !== 11) return 'час';
    if ([2,3,4].includes(hours % 10) && ![12,13,14].includes(hours % 100)) return 'часа';
    return 'часов';
}
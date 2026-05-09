/**
 * admin-init.js
 * Админ-панель для управления задачами и командой
 */

// ========== ИМПОРТЫ ==========
import { auth, logout } from './auth.js';
import { db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { 
    collection, addDoc, deleteDoc, doc, query, where, 
    onSnapshot, updateDoc, getDocs, getDoc   // ← добавить getDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { showMessage, showConfirm, showFormModal } from './ui-notifications.js';
import { initGlobalEmployees, addGlobalEmployee } from './global-employees.js';
import { initTaskTemplates, createTemplate } from './task-templates.js';
import { notifyNewTask } from './telegram.js'; 


// ========== ПЕРЕМЕННЫЕ ==========
let currentRoomId = null;
let currentRoomName = null;
let notifiedTasks = new Set();

// ========== ПРОВЕРКА АВТОРИЗАЦИИ ==========
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        loadRooms();
        initGlobalEmployees();
        initTaskTemplates();
    }
});

// ========== ЗАГРУЗКА КОМНАТ ==========
function loadRooms() {
    const user = auth.currentUser;
    if (!user) return;
    
    const q = query(collection(db, 'rooms'), where('adminId', '==', user.uid));
    
    onSnapshot(q, (snapshot) => {
        const roomsList = document.getElementById('roomsList');
        if (!roomsList) return;
        
        if (snapshot.empty) {
            roomsList.innerHTML = '<div class="empty-message">Нет комнат.<br>Создайте первую!</div>';
            return;
        }
        
        roomsList.innerHTML = '';
        snapshot.forEach((doc) => {
            const room = doc.data();
            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            if (currentRoomId === doc.id) roomDiv.classList.add('active');
            roomDiv.textContent = room.name;
            roomDiv.onclick = () => selectRoom(doc.id, room.name);
            roomsList.appendChild(roomDiv);
        });
    });
}

// ========== СОЗДАНИЕ КОМНАТЫ ==========
async function createRoom(name) {
    const user = auth.currentUser;
    if (!user || !name?.trim()) return false;
    
    try {
        await addDoc(collection(db, 'rooms'), {
            name: name.trim(),
            adminId: user.uid,
            createdAt: new Date()
        });
        await showMessage('Успех', '✅ Комната создана', 'success');
        return true;
    } catch (error) {
        await showMessage('Ошибка', '❌ Ошибка: ' + error.message, 'error');
        return false;
    }
}

// ========== БЫСТРЫЙ ВЫБОР ДЕДЛАЙНА ==========
function initQuickDeadlineButtons() {
    const quickBtns = document.querySelectorAll('.quick-deadline-btn');
    const deadlineInput = document.getElementById('taskDeadlineInput');
    
    if (!deadlineInput) return;
    
    quickBtns.forEach(btn => {
        btn.onclick = () => {
            const hours = btn.dataset.hours;
            const isCustom = btn.dataset.custom === 'true';
            
            if (isCustom) {
                deadlineInput.style.display = 'block';
                deadlineInput.value = '';
                deadlineInput.focus();
                quickBtns.forEach(b => b.classList.remove('active'));
            } else if (hours) {
                deadlineInput.style.display = 'block';
                const date = new Date();
                date.setTime(date.getTime() + (parseInt(hours) * 60 * 60 * 1000));
                deadlineInput.value = date.toISOString().slice(0, 16);
                quickBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        };
    });
}

// ========== ГЛАВНАЯ СТРАНИЦА КОМНАТЫ ==========
async function selectRoom(roomId, roomName) {
    currentRoomId = roomId;
    currentRoomName = roomName;
    window.currentRoomId = currentRoomId;
    
    const roomContent = document.getElementById('roomContent');
    if (!roomContent) return;
    
    roomContent.innerHTML = `
        <!-- Шапка комнаты -->
        <div class="room-header">
            <div>
                <h1 class="room-title">📁 ${escapeHtml(roomName)}</h1>
                <p class="room-subtitle">Управление задачами и командой</p>
            </div>
            <button id="addTaskGlobalBtn" class="btn-primary">➕ Новая задача</button>
        </div>
        
        <!-- Модалка создания задачи -->
        <div id="taskModal" class="modal-task" style="display: none;">
            <div class="modal-task-content" style="max-width: 600px;">
                <div class="modal-task-header">
                    <h3>➕ Новая задача</h3>
                    <span class="modal-close-task">&times;</span>
                </div>
                <div class="modal-task-body">
                    <input type="text" id="taskTitleInput" placeholder="Название задачи *" class="task-input">
                    <textarea id="taskDescInput" placeholder="Описание (необязательно)" rows="3" class="task-textarea"></textarea>
                    
                    <label style="display: block; margin-bottom: 8px; font-size: 13px; color: var(--text-gray, #666);">⏰ Дедлайн</label>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
                        <button type="button" class="quick-deadline-btn" data-hours="6">6 часов</button>
                        <button type="button" class="quick-deadline-btn" data-hours="24">1 день</button>
                        <button type="button" class="quick-deadline-btn" data-hours="72">3 дня</button>
                        <button type="button" class="quick-deadline-btn" data-hours="168">Неделя</button>
                        <button type="button" class="quick-deadline-btn" data-custom="true">Кастомный</button>
                    </div>
                    <input type="datetime-local" id="taskDeadlineInput" class="task-input" style="display: none;">
                    
                    <select id="taskAssigneeSelect" class="task-select">
                        <option value="">Выберите сотрудника</option>
                    </select>
                    <button id="createTaskBtn" class="btn-primary btn-block">✅ Создать задачу</button>
                </div>
            </div>
        </div>
        
        <!-- Вкладки -->
        <div class="room-tabs">
            <button class="room-tab active" data-tab="tasks">📋 Задачи</button>
            <button class="room-tab" data-tab="global">🌍 Общий стек</button>
            <button class="room-tab" data-tab="templates">📝 Шаблоны</button>
            <button class="room-tab" data-tab="statistics">📊 Статистика</button>
        </div>
        
        <!-- Контент вкладки Задачи -->
        <div id="tab-tasks" class="tab-content active">
            <div class="room-two-columns">
                <div class="column-employees">
                    <div class="column-header">
                        <h3>👥 Команда</h3>
                        <button id="addEmployeeBtn" class="btn-icon">+ Добавить</button>
                    </div>
                    <div id="employeesContainer" class="employees-grid">
                        <div class="loading-spinner">Загрузка...</div>
                    </div>
                </div>
                <div class="column-tasks">
                    <div class="column-header">
                        <h3>📋 Активные задачи</h3>
                    </div>
                    <div id="activeTasksContainer" class="tasks-list">
                        <div class="loading-spinner">Загрузка...</div>
                    </div>
                    <details class="completed-section">
                        <summary class="completed-summary">✅ Выполненные задачи</summary>
                        <div id="completedTasksContainer" class="completed-tasks-list"></div>
                    </details>
                </div>
            </div>
        </div>
        
        <!-- Контент вкладки Общий стек -->
        <div id="tab-global" class="tab-content" style="display: none;">
            <div class="tab-header">
                <h3>🌍 Общий стек сотрудников</h3>
                <button id="addGlobalEmployeeBtn" class="btn-primary">+ Добавить в стек</button>
            </div>
            <div id="globalEmployeesList" class="global-employees-list">
                <div class="loading-spinner">Загрузка...</div>
            </div>
        </div>
        
        <!-- Контент вкладки Шаблоны -->
        <div id="tab-templates" class="tab-content" style="display: none;">
            <div class="tab-header">
                <h3>📝 Шаблоны задач</h3>
                <button id="createTemplateBtn" class="btn-primary">+ Новый шаблон</button>
            </div>
            <div id="taskTemplatesList" class="templates-list">
                <div class="loading-spinner">Загрузка...</div>
            </div>
        </div>
        
        <!-- Контент вкладки Статистика -->
        <div id="tab-statistics" class="tab-content" style="display: none;">
            <div id="statisticsContainer">
                <div class="loading-spinner">Загрузка статистики...</div>
            </div>
        </div>
        
        <!-- Модалка добавления сотрудника -->
        <div id="employeeModal" class="modal-task" style="display: none;">
            <div class="modal-task-content">
                <div class="modal-task-header">
                    <h3>👤 Новый сотрудник</h3>
                    <span class="modal-close-employee">&times;</span>
                </div>
                <div class="modal-task-body">
                    <input type="text" id="employeeNameInput" placeholder="Имя сотрудника *" class="task-input">
                    <input type="text" id="employeeTelegramInput" placeholder="Telegram (опционально)" class="task-input">
                    <button id="saveEmployeeBtn" class="btn-primary btn-block">➕ Добавить</button>
                </div>
            </div>
        </div>
    `;
    
    // Загружаем данные
    loadEmployeesCards();
    loadActiveTasks();
    loadCompletedTasks();
    loadEmployeesForSelect();
    initQuickDeadlineButtons();
    
    // ========== НАСТРОЙКА КНОПОК ==========
    
    // Кнопка "Новая задача"
    const addTaskGlobalBtn = document.getElementById('addTaskGlobalBtn');
    const taskModal = document.getElementById('taskModal');
    const closeTaskModal = document.querySelector('.modal-close-task');
    
    if (addTaskGlobalBtn) addTaskGlobalBtn.onclick = () => taskModal.style.display = 'flex';
    if (closeTaskModal) closeTaskModal.onclick = () => taskModal.style.display = 'none';
    
    // Кнопка добавления сотрудника
    const addEmployeeBtn = document.getElementById('addEmployeeBtn');
    const employeeModal = document.getElementById('employeeModal');
    const closeEmployeeModal = document.querySelector('.modal-close-employee');
    const saveEmployeeBtn = document.getElementById('saveEmployeeBtn');
    
    if (addEmployeeBtn) addEmployeeBtn.onclick = () => employeeModal.style.display = 'flex';
    if (closeEmployeeModal) closeEmployeeModal.onclick = () => employeeModal.style.display = 'none';
    
    if (saveEmployeeBtn) {
        saveEmployeeBtn.onclick = async () => {
            const name = document.getElementById('employeeNameInput').value;
            const telegram = document.getElementById('employeeTelegramInput').value;
            if (!name.trim()) {
                await showMessage('Ошибка', 'Введите имя', 'error');
                return;
            }
            await addEmployeeToRoom(name, telegram);
            employeeModal.style.display = 'none';
            document.getElementById('employeeNameInput').value = '';
            document.getElementById('employeeTelegramInput').value = '';
            loadEmployeesCards();
            loadEmployeesForSelect();
        };
    }
    
    // Создание задачи
    const createTaskBtn = document.getElementById('createTaskBtn');
    if (createTaskBtn) {
        createTaskBtn.onclick = async () => {
            const title = document.getElementById('taskTitleInput').value;
            const description = document.getElementById('taskDescInput').value;
            const deadline = document.getElementById('taskDeadlineInput').value;
            const assigneeId = document.getElementById('taskAssigneeSelect').value;
            
            if (!title.trim()) {
                await showMessage('Ошибка', 'Введите название задачи', 'error');
                return;
            }
            if (!assigneeId) {
                await showMessage('Ошибка', 'Выберите сотрудника', 'error');
                return;
            }
            
            await createTask(title, description, deadline, assigneeId);
            taskModal.style.display = 'none';
            document.getElementById('taskTitleInput').value = '';
            document.getElementById('taskDescInput').value = '';
            document.getElementById('taskDeadlineInput').value = '';
            loadActiveTasks();
            loadCompletedTasks();
            loadEmployeesCards();
        };
    }
    
    // Закрытие модалок по клику вне
    window.onclick = (e) => {
        if (e.target === taskModal) taskModal.style.display = 'none';
        if (e.target === employeeModal) employeeModal.style.display = 'none';
    };
    
    // ========== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ==========
    const tabs = document.querySelectorAll('.room-tab');
    const contentsIds = ['tasks', 'global', 'templates', 'statistics'];
    
    tabs.forEach(tab => {
        tab.onclick = () => {
            const tabName = tab.dataset.tab;
            
            contentsIds.forEach(id => {
                const el = document.getElementById(`tab-${id}`);
                if (el) el.style.display = 'none';
            });
            
            const activeTab = document.getElementById(`tab-${tabName}`);
            if (activeTab) activeTab.style.display = 'block';
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            if (tabName === 'statistics') {
                import('./statistics.js').then(module => {
                    module.setCurrentRoomForStats(currentRoomId);
                    module.loadStatistics();
                }).catch(err => {
                    console.error('Ошибка загрузки статистики:', err);
                    const statsContainer = document.getElementById('statisticsContainer');
                    if (statsContainer) {
                        statsContainer.innerHTML = '<div class="empty-card">Ошибка загрузки модуля статистики</div>';
                    }
                });
            }
        };
    });
    
    // Кнопка добавления в глобальный стек
    const addGlobalEmployeeBtn = document.getElementById('addGlobalEmployeeBtn');
    if (addGlobalEmployeeBtn) {
        addGlobalEmployeeBtn.onclick = async () => {
            const result = await showFormModal('Добавить в общий стек', [
                { name: 'name', label: 'Имя сотрудника', type: 'text', placeholder: 'Иван Иванов' },
                { name: 'telegram', label: 'Telegram', type: 'text', placeholder: '@ivan' }
            ], 'Добавить');
            if (result && result.name) {
                await addGlobalEmployee(result.name, result.telegram);
            }
        };
    }
    
    // Кнопка создания шаблона
    const createTemplateBtn = document.getElementById('createTemplateBtn');
    if (createTemplateBtn) {
        createTemplateBtn.onclick = () => createTemplate();
    }
}

// ========== КАРТОЧКИ СОТРУДНИКОВ ==========
function loadEmployeesCards() {
    if (!currentRoomId) return;
    
    const container = document.getElementById('employeesContainer');
    if (!container) return;
    
    const q = query(collection(db, 'rooms', currentRoomId, 'employees'));
    
    onSnapshot(q, async (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-card">👥 Нет сотрудников<br><small>Нажмите «+ Добавить»</small></div>';
            return;
        }
        
        const tasksSnap = await getDocs(collection(db, 'rooms', currentRoomId, 'tasks'));
        const tasksByEmployee = {};
        tasksSnap.forEach(doc => {
            const task = doc.data();
            if (task.assigneeId && task.status === 'pending') {
                tasksByEmployee[task.assigneeId] = (tasksByEmployee[task.assigneeId] || 0) + 1;
            }
        });
        
        container.innerHTML = '';
        for (const docSnap of snapshot.docs) {
            const emp = docSnap.data();
            const empId = docSnap.id;
            const pendingCount = tasksByEmployee[empId] || 0;
            
            const card = document.createElement('div');
            card.className = 'employee-card';
            card.innerHTML = `
                <div class="employee-avatar">👤</div>
                <div class="employee-info">
                    <div class="employee-name">${escapeHtml(emp.name)}</div>
                    <div class="employee-tasks-count">📋 ${pendingCount} задача${getDeclension(pendingCount)}</div>
                    ${emp.telegram ? `<div class="employee-telegram">📱 ${escapeHtml(emp.telegram)}</div>` : ''}
                </div>
                <div class="employee-actions">
                    <button class="employee-edit-btn" data-id="${empId}" title="Редактировать">✏️</button>
                    <button class="employee-link-btn" data-id="${empId}" title="Ссылка">🔗</button>
                    <button class="employee-delete-btn" data-id="${empId}" title="Удалить">🗑️</button>
                </div>
            `;
            
            card.querySelector('.employee-edit-btn').onclick = () => editEmployee(empId, emp.name, emp.telegram);
            card.querySelector('.employee-link-btn').onclick = () => showEmployeeLink(empId, emp.name);
            card.querySelector('.employee-delete-btn').onclick = () => deleteEmployeeFromRoom(empId);
            container.appendChild(card);
        }
    });
}

// ========== АКТИВНЫЕ ЗАДАЧИ ==========
function loadActiveTasks() {
    if (!currentRoomId) return;
    
    const container = document.getElementById('activeTasksContainer');
    if (!container) return;
    
    const q = query(collection(db, 'rooms', currentRoomId, 'tasks'));
    
    onSnapshot(q, async (snapshot) => {
        const employeesSnap = await getDocs(collection(db, 'rooms', currentRoomId, 'employees'));
        const employeeNames = {};
        employeesSnap.forEach(doc => {
            employeeNames[doc.id] = doc.data().name;
        });
        
        const activeTasks = [];
        snapshot.forEach(doc => {
            const task = doc.data();
            if (task.status === 'pending') {
                activeTasks.push({ id: doc.id, ...task });
            }
        });
        
        if (activeTasks.length === 0) {
            container.innerHTML = '<div class="empty-card">📭 Нет активных задач<br><small>Нажмите «Новая задача»</small></div>';
            return;
        }
        
        container.innerHTML = '';
        activeTasks.forEach(task => {
            const taskCard = document.createElement('div');
            taskCard.className = 'task-card';
            
            const deadlineStr = task.deadline ? new Date(task.deadline).toLocaleDateString() : 'без дедлайна';
            const employeeName = employeeNames[task.assigneeId] || 'Неизвестный';
            const isDeadlineSoon = task.deadline && new Date(task.deadline) < new Date(Date.now() + 24*60*60*1000);
            const isOverdue = task.deadline && new Date(task.deadline) < new Date();
            
            let deadlineClass = '';
            if (isOverdue) deadlineClass = 'overdue';
            else if (isDeadlineSoon) deadlineClass = 'soon';
            
            taskCard.innerHTML = `
                <div class="task-card-header">
                    <span class="task-title">📌 ${escapeHtml(task.title)}</span>
                    <div style="display: flex; gap: 8px;">
                        ${isDeadlineSoon ? '<span class="task-urgent">⚠️ Скоро</span>' : ''}
                        <button class="task-edit-btn" data-id="${task.id}" style="background: none; border: none; cursor: pointer; font-size: 16px;" title="Редактировать">✏️</button>
                    </div>
                </div>
                ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
                <div class="task-meta">
                    <span class="task-deadline ${deadlineClass}">🎯 ${deadlineStr}</span>
                    <span>👤 ${escapeHtml(employeeName)}</span>
                </div>
                <div class="task-actions">
                    <button class="task-done-btn" data-id="${task.id}">✅ Выполнить</button>
                    <button class="task-fail-btn" data-id="${task.id}">❌ Отказ</button>
                </div>
            `;
            
            taskCard.querySelector('.task-edit-btn').onclick = () => editTask(task.id, task.title, task.description, task.deadline, task.assigneeId);
            taskCard.querySelector('.task-done-btn').onclick = () => updateTaskStatus(task.id, 'done');
            taskCard.querySelector('.task-fail-btn').onclick = async () => {
                const reason = await showFormModal('Причина отказа', [
                    { name: 'reason', label: 'Укажите причину', type: 'textarea', placeholder: 'Почему задача не выполнена?' }
                ], 'Отправить');
                if (reason && reason.reason) updateTaskStatus(task.id, 'failed', reason.reason);
            };
            container.appendChild(taskCard);
        });
        
        checkDeadlinesAndNotify(activeTasks);
    });
}

// ========== ВЫПОЛНЕННЫЕ ЗАДАЧИ ==========
function loadCompletedTasks() {
    if (!currentRoomId) return;
    
    const container = document.getElementById('completedTasksContainer');
    if (!container) return;
    
    const q = query(collection(db, 'rooms', currentRoomId, 'tasks'));
    
    onSnapshot(q, async (snapshot) => {
        const employeesSnap = await getDocs(collection(db, 'rooms', currentRoomId, 'employees'));
        const employeeNames = {};
        employeesSnap.forEach(doc => {
            employeeNames[doc.id] = doc.data().name;
        });
        
        const completedTasks = [];
        snapshot.forEach(doc => {
            const task = doc.data();
            if (task.status === 'done' || task.status === 'failed') {
                completedTasks.push({ id: doc.id, ...task });
            }
        });
        
        if (completedTasks.length === 0) {
            container.innerHTML = '<div class="empty-small">Пока нет выполненных задач</div>';
            return;
        }
        
        container.innerHTML = '';
        completedTasks.slice(0, 10).forEach(task => {
            const taskItem = document.createElement('div');
            taskItem.className = 'completed-task-item';
            const statusIcon = task.status === 'done' ? '✅' : '❌';
            const employeeName = employeeNames[task.assigneeId] || 'Неизвестный';
            const deadlineStr = task.deadline ? new Date(task.deadline).toLocaleDateString() : 'без дедлайна';
            
            taskItem.innerHTML = `
                <span>${statusIcon} ${escapeHtml(task.title)}</span>
                <span class="completed-meta">${deadlineStr} · ${escapeHtml(employeeName)}</span>
            `;
            container.appendChild(taskItem);
        });
        
        if (completedTasks.length > 10) {
            const more = document.createElement('div');
            more.className = 'completed-more';
            more.textContent = `+ ещё ${completedTasks.length - 10}`;
            container.appendChild(more);
        }
    });
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function loadEmployeesForSelect() {
    if (!currentRoomId) return;
    const select = document.getElementById('taskAssigneeSelect');
    if (!select) return;
    
    const q = query(collection(db, 'rooms', currentRoomId, 'employees'));
    onSnapshot(q, (snapshot) => {
        select.innerHTML = '<option value="">Выберите сотрудника</option>';
        snapshot.forEach(doc => {
            const emp = doc.data();
            select.innerHTML += `<option value="${doc.id}">${escapeHtml(emp.name)}</option>`;
        });
    });
}

async function addEmployeeToRoom(name, telegram) {
    if (!currentRoomId) return;
    try {
        await addDoc(collection(db, 'rooms', currentRoomId, 'employees'), {
            name: name.trim(),
            telegram: telegram?.trim() || '',
            createdAt: new Date()
        });
        await showMessage('Успех', '✅ Сотрудник добавлен', 'success');
    } catch (error) {
        await showMessage('Ошибка', '❌ Ошибка: ' + error.message, 'error');
    }
}

async function deleteEmployeeFromRoom(employeeId) {
    const confirmed = await showConfirm('Удаление', 'Удалить сотрудника? Все его задачи останутся, но он не сможет их отмечать.');
    if (!confirmed) return;
    
    try {
        await deleteDoc(doc(db, 'rooms', currentRoomId, 'employees', employeeId));
        await showMessage('Успех', '✅ Сотрудник удалён', 'success');
        loadActiveTasks();
        loadCompletedTasks();
        loadEmployeesCards();
    } catch (error) {
        await showMessage('Ошибка', '❌ Ошибка: ' + error.message, 'error');
    }
}

function showEmployeeLink(employeeId, employeeName) {
    const link = `${window.location.origin}/employee.html?room=${currentRoomId}&employee=${employeeId}`;
    navigator.clipboard.writeText(link);
    showMessage('Ссылка скопирована', `🔗 Ссылка для ${employeeName} скопирована!\nОтправьте её сотруднику.`, 'success');
}

async function createTask(title, description, deadline, assigneeId) {
    if (!currentRoomId) return;
    try {
        await addDoc(collection(db, 'rooms', currentRoomId, 'tasks'), {
            title: title.trim(),
            description: description?.trim() || '',
            deadline: deadline || null,
            assigneeId: assigneeId,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        await showMessage('Успех', '✅ Задача создана', 'success');
        
        // ========== ОТПРАВКА УВЕДОМЛЕНИЯ В TELEGRAM ==========
        try {
            // Получаем название комнаты
            const roomDoc = await getDoc(doc(db, 'rooms', currentRoomId));
            const roomName = roomDoc.exists() ? roomDoc.data().name : 'Без названия';
            
            // Получаем Telegram ID сотрудника
            const employeeDoc = await getDoc(doc(db, 'rooms', currentRoomId, 'employees', assigneeId));
            const telegramId = employeeDoc.exists() ? employeeDoc.data().telegramId : null;
            
            // Если есть Telegram ID, отправляем уведомление
            if (telegramId) {
                await notifyNewTask({
                    title: title.trim(),
                    description: description?.trim() || '',
                    deadline: deadline,
                    assigneeId: assigneeId,
                    roomId: currentRoomId
                }, telegramId, roomName);
            }
        } catch (telegramError) {
            console.warn('Telegram уведомление не отправлено:', telegramError.message);
        }
        // ========== КОНЕЦ БЛОКА TELEGRAM ==========
        
    } catch (error) {
        await showMessage('Ошибка', '❌ Ошибка: ' + error.message, 'error');
    }
}
async function updateTaskStatus(taskId, newStatus, reason = '') {
    try {
        const updateData = { status: newStatus, updatedAt: new Date() };
        if (newStatus === 'failed' && reason) updateData.failedReason = reason;
        if (newStatus === 'done') updateData.completedAt = new Date();
        
        await updateDoc(doc(db, 'rooms', currentRoomId, 'tasks', taskId), updateData);
        await showMessage('Успех', `✅ Задача ${newStatus === 'done' ? 'выполнена' : 'отмечена как проваленная'}`, 'success');
        loadActiveTasks();
        loadCompletedTasks();
        loadEmployeesCards();
    } catch (error) {
        await showMessage('Ошибка', '❌ Ошибка: ' + error.message, 'error');
    }
}

async function editEmployee(employeeId, currentName, currentTelegram) {
    const result = await showFormModal('Редактировать сотрудника', [
        { name: 'name', label: 'Имя', type: 'text', value: currentName },
        { name: 'telegram', label: 'Telegram', type: 'text', value: currentTelegram || '' }
    ], 'Сохранить');
    
    if (!result) return;
    
    try {
        await updateDoc(doc(db, 'rooms', currentRoomId, 'employees', employeeId), {
            name: result.name.trim(),
            telegram: result.telegram?.trim() || '',
            updatedAt: new Date()
        });
        await showMessage('Успех', 'Данные сотрудника обновлены', 'success');
        loadEmployeesCards();
        loadEmployeesForSelect();
    } catch (error) {
        await showMessage('Ошибка', error.message, 'error');
    }
}

async function editTask(taskId, currentTitle, currentDescription, currentDeadline, currentAssigneeId) {
    const employeesSnap = await getDocs(collection(db, 'rooms', currentRoomId, 'employees'));
    const employeeOptions = employeesSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
    
    if (employeeOptions.length === 0) {
        await showMessage('Ошибка', 'Нет сотрудников в комнате.', 'error');
        return;
    }
    
    let formattedDeadline = '';
    if (currentDeadline) {
        const date = new Date(currentDeadline);
        if (!isNaN(date.getTime())) formattedDeadline = date.toISOString().slice(0, 16);
    }
    
    const result = await showFormModal('Редактировать задачу', [
        { name: 'title', label: 'Название задачи *', type: 'text', value: currentTitle },
        { name: 'description', label: 'Описание', type: 'textarea', value: currentDescription || '' },
        { name: 'deadline', label: 'Дедлайн', type: 'datetime-local', value: formattedDeadline },
        { name: 'assigneeId', label: 'Ответственный сотрудник *', type: 'select', options: employeeOptions, value: currentAssigneeId }
    ], '💾 Сохранить');
    
    if (!result) return;
    if (!result.title.trim()) {
        await showMessage('Ошибка', 'Название не может быть пустым', 'error');
        return;
    }
    if (!result.assigneeId) {
        await showMessage('Ошибка', 'Выберите сотрудника', 'error');
        return;
    }
    
    try {
        await updateDoc(doc(db, 'rooms', currentRoomId, 'tasks', taskId), {
            title: result.title.trim(),
            description: result.description?.trim() || '',
            deadline: result.deadline || null,
            assigneeId: result.assigneeId,
            updatedAt: new Date()
        });
        await showMessage('Успех', '✅ Задача обновлена', 'success');
        loadActiveTasks();
        loadCompletedTasks();
    } catch (error) {
        await showMessage('Ошибка', '❌ Ошибка: ' + error.message, 'error');
    }
}

function checkDeadlinesAndNotify(tasks) {
    const now = new Date();
    const soonTasks = [];
    
    tasks.forEach(task => {
        if (task.status !== 'pending') return;
        if (!task.deadline) return;
        
        const deadline = new Date(task.deadline);
        const hoursLeft = (deadline - now) / (1000 * 60 * 60);
        const taskKey = `${task.id}_${task.assigneeId}`;
        
        if ((hoursLeft <= 24 && hoursLeft > 23) || (hoursLeft <= 1 && hoursLeft > 0)) {
            if (!notifiedTasks.has(taskKey)) {
                notifiedTasks.add(taskKey);
                soonTasks.push({ title: task.title, hoursLeft: hoursLeft });
            }
        }
        
        if (deadline < now && !notifiedTasks.has(`overdue_${task.id}`)) {
            notifiedTasks.add(`overdue_${task.id}`);
            soonTasks.push({ title: task.title, isOverdue: true });
        }
    });
    
    if (soonTasks.length > 0) {
        const message = soonTasks.map(t => {
            if (t.isOverdue) return `⚠️ ПРОСРОЧЕНО: "${t.title}"`;
            return `⚠️ "${t.title}" — дедлайн через ${Math.round(t.hoursLeft)} ${declensionHours(Math.round(t.hoursLeft))}`;
        }).join('\n');
        showMessage('⏰ Внимание! Дедлайны', message, 'warning');
    }
}

function declensionHours(hours) {
    if (hours % 10 === 1 && hours % 100 !== 11) return 'час';
    if ([2,3,4].includes(hours % 10) && ![12,13,14].includes(hours % 100)) return 'часа';
    return 'часов';
}

function getDeclension(count) {
    if (count % 10 === 1 && count % 100 !== 11) return 'а';
    if ([2,3,4].includes(count % 10) && ![12,13,14].includes(count % 100)) return 'и';
    return '';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

// ========== КНОПКИ ВЫХОДА И СОЗДАНИЯ КОМНАТЫ ==========
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.onclick = () => logout();

const createRoomBtn = document.getElementById('createRoomBtn');
const createRoomModal = document.getElementById('createRoomModal');
const createRoomForm = document.getElementById('createRoomForm');

if (createRoomBtn && createRoomModal) {
    createRoomBtn.onclick = () => createRoomModal.style.display = 'flex';
    const closeModal = createRoomModal.querySelector('.modal-close');
    if (closeModal) closeModal.onclick = () => createRoomModal.style.display = 'none';
    if (createRoomForm) {
        createRoomForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('roomName').value;
            if (await createRoom(name)) {
                createRoomModal.style.display = 'none';
                createRoomForm.reset();
            }
        };
    }
    window.onclick = (e) => { if (e.target === createRoomModal) createRoomModal.style.display = 'none'; };
}

window.currentRoomId = currentRoomId;
window.loadEmployeesCards = loadEmployeesCards;
window.loadEmployeesForSelect = loadEmployeesForSelect;
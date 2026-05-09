/**
 * statistics.js
 * Модуль статистики: графики выполнения задач
 */

import { db } from './firebase-init.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

let currentRoomId = null;

export function setCurrentRoomForStats(roomId) {
    currentRoomId = roomId;
}

export async function loadStatistics() {
    if (!currentRoomId) return;
    
    const container = document.getElementById('statisticsContainer');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner">Загрузка статистики...</div>';
    
    try {
        // Получаем все задачи комнаты
        const tasksSnap = await getDocs(collection(db, 'rooms', currentRoomId, 'tasks'));
        const employeesSnap = await getDocs(collection(db, 'rooms', currentRoomId, 'employees'));
        
        const employees = {};
        employeesSnap.forEach(doc => {
            employees[doc.id] = doc.data().name;
        });
        
        let total = 0;
        let done = 0;
        let failed = 0;
        let pending = 0;
        let overdue = 0;
        
        const employeeStats = {};
        const now = new Date();
        
        tasksSnap.forEach(doc => {
            const task = doc.data();
            total++;
            
            if (task.status === 'done') done++;
            else if (task.status === 'failed') failed++;
            else if (task.status === 'pending') {
                pending++;
                if (task.deadline && new Date(task.deadline) < now) {
                    overdue++;
                }
            }
            
            // Статистика по сотрудникам
            if (task.assigneeId) {
                if (!employeeStats[task.assigneeId]) {
                    employeeStats[task.assigneeId] = { total: 0, done: 0, failed: 0, pending: 0 };
                }
                employeeStats[task.assigneeId].total++;
                if (task.status === 'done') employeeStats[task.assigneeId].done++;
                else if (task.status === 'failed') employeeStats[task.assigneeId].failed++;
                else employeeStats[task.assigneeId].pending++;
            }
        });
        
        const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
        
        // Рендер статистики
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${total}</div>
                    <div class="stat-label">Всего задач</div>
                </div>
                <div class="stat-card stat-done">
                    <div class="stat-value">${done}</div>
                    <div class="stat-label">✅ Выполнено</div>
                </div>
                <div class="stat-card stat-failed">
                    <div class="stat-value">${failed}</div>
                    <div class="stat-label">❌ Провалено</div>
                </div>
                <div class="stat-card stat-pending">
                    <div class="stat-value">${pending}</div>
                    <div class="stat-label">⏳ В работе</div>
                </div>
                <div class="stat-card stat-overdue">
                    <div class="stat-value">${overdue}</div>
                    <div class="stat-label">⚠️ Просрочено</div>
                </div>
            </div>
            
            <div class="stats-progress">
                <div class="stats-progress-label">Прогресс выполнения</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${completionRate}%;"></div>
                </div>
                <div class="stats-progress-value">${completionRate}%</div>
            </div>
            
            <div class="stats-employees">
                <h4>📊 Статистика по сотрудникам</h4>
                <div class="employee-stats-list">
                    ${Object.entries(employeeStats).map(([empId, stats]) => `
                        <div class="employee-stat-item">
                            <span class="employee-stat-name">${escapeHtml(employees[empId] || 'Неизвестный')}</span>
                            <div class="employee-stat-bars">
                                <div class="employee-stat-bar done" style="width: ${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%"></div>
                                <div class="employee-stat-bar failed" style="width: ${stats.total > 0 ? (stats.failed / stats.total) * 100 : 0}%"></div>
                                <div class="employee-stat-bar pending" style="width: ${stats.total > 0 ? (stats.pending / stats.total) * 100 : 0}%"></div>
                            </div>
                            <div class="employee-stat-numbers">
                                <span class="done">✅ ${stats.done}</span>
                                <span class="failed">❌ ${stats.failed}</span>
                                <span class="pending">⏳ ${stats.pending}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        container.innerHTML = '<div class="empty-card">Ошибка загрузки статистики</div>';
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
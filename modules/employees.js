import { auth, db } from './firebase-init.js';
import { collection, addDoc, deleteDoc, doc, query, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

let currentRoomId = null;

// Установить текущую комнату
export function setCurrentRoom(roomId) {
    currentRoomId = roomId;
    loadEmployees();
}

// Загрузить сотрудников
export function loadEmployees() {
    if (!currentRoomId) return;
    
    const q = query(collection(db, 'rooms', currentRoomId, 'employees'));
    const employeesList = document.getElementById('employeesList');
    
    if (!employeesList) return;
    
    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            employeesList.innerHTML = '<div class="empty-message">Нет сотрудников. Добавьте первого!</div>';
            return;
        }
        
        employeesList.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const employee = docSnap.data();
            const employeeId = docSnap.id;
            
            const empDiv = document.createElement('div');
            empDiv.className = 'employee-card';
            empDiv.innerHTML = `
                <div class="employee-info">
                    <strong>${escapeHtml(employee.name)}</strong>
                    ${employee.telegram ? `<br><small>📱 ${escapeHtml(employee.telegram)}</small>` : ''}
                    <br><small class="employee-id">ID: ${employeeId.slice(0, 8)}</small>
                </div>
                <button class="delete-employee-btn" data-id="${employeeId}">🗑️</button>
            `;
            
            const deleteBtn = empDiv.querySelector('.delete-employee-btn');
            deleteBtn.onclick = () => deleteEmployee(employeeId);
            
            employeesList.appendChild(empDiv);
        });
    });
}

// Добавить сотрудника
export async function addEmployee(name, telegram) {
    if (!currentRoomId) {
        alert('Выберите комнату');
        return;
    }
    
    if (!name.trim()) {
        alert('Введите имя сотрудника');
        return;
    }
    
    try {
        await addDoc(collection(db, 'rooms', currentRoomId, 'employees'), {
            name: name.trim(),
            telegram: telegram?.trim() || '',
            createdAt: new Date()
        });
        return true;
    } catch (error) {
        alert('Ошибка: ' + error.message);
        return false;
    }
}

// Удалить сотрудника
export async function deleteEmployee(employeeId) {
    if (!confirm('Удалить сотрудника? Все его задачи останутся, но он не сможет их отмечать.')) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, 'rooms', currentRoomId, 'employees', employeeId));
        alert('Сотрудник удалён');
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// Получить ссылку для сотрудника
export function getEmployeeLink(roomId, employeeId) {
    return `${window.location.origin}/employee.html?room=${roomId}&employee=${employeeId}`;
}

// Простая защита от XSS
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
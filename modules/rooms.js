import { auth, db } from './firebase-init.js';
import { collection, addDoc, query, where, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

let currentRoomId = null;

export async function createRoom(name) {
    const user = auth.currentUser;
    if (!user) {
        alert('Вы не авторизованы');
        return;
    }
    
    try {
        await addDoc(collection(db, 'rooms'), {
            name: name,
            adminId: user.uid,
            createdAt: new Date()
        });
        alert('Комната создана!');
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

export function loadRooms() {
    const user = auth.currentUser;
    if (!user) return;
    
    const q = query(collection(db, 'rooms'), where('adminId', '==', user.uid));
    
    onSnapshot(q, (snapshot) => {
        const roomsList = document.getElementById('roomsList');
        
        if (snapshot.empty) {
            roomsList.innerHTML = '<div class="empty-message">Нет комнат. Создайте первую!</div>';
            return;
        }
        
        roomsList.innerHTML = '';
        snapshot.forEach((doc) => {
            const room = doc.data();
            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            if (currentRoomId === doc.id) {
                roomDiv.classList.add('active');
            }
            roomDiv.textContent = room.name;
            roomDiv.onclick = () => selectRoom(doc.id, room.name);
            roomsList.appendChild(roomDiv);
        });
    });
}

export function selectRoom(roomId, roomName) {
    currentRoomId = roomId;
    loadRooms(); // обновим активный класс
    
    const roomContent = document.getElementById('roomContent');
    roomContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2>📁 ${roomName}</h2>
            <button id="showEmployeesBtn" class="btn-primary">👥 Управление сотрудниками</button>
        </div>
        <div id="roomStats" style="background: #f0f0f0; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
            <p>Здесь будет статистика по комнате</p>
        </div>
        <div id="roomTasks">
            <h3>Задачи</h3>
            <button id="addTaskBtn" class="btn-primary" style="margin-bottom: 15px;">+ Добавить задачу</button>
            <div id="tasksList">Загрузка задач...</div>
        </div>
    `;
    
    // Временно заглушки для кнопок
    document.getElementById('showEmployeesBtn').onclick = () => {
        alert('Управление сотрудниками — будет в следующем шаге');
    };
    document.getElementById('addTaskBtn').onclick = () => {
        alert('Создание задач — будет в следующем шаге');
    };
}

export function initRoomsModule() {
    loadRooms();
}
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCz0vGpRTOJxxiLzQU93PN34pvYhuUpxno",
    authDomain: "justlink-task.firebaseapp.com",
    projectId: "justlink-task",
    storageBucket: "justlink-task.firebasestorage.app",
    messagingSenderId: "330324597396",
    appId: "1:330324597396:web:fce9b687c11d7c8d2e7281"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ========== ФУНКЦИИ ДЛЯ ИСПОЛЬЗОВАНИЯ В ДРУГИХ МОДУЛЯХ ==========
export { auth };

export async function logout() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ТОЛЬКО ДЛЯ INDEX.HTML ==========
// Проверяем, есть ли на странице элементы для входа/регистрации
const startBtn = document.getElementById('startAdminBtn');

if (startBtn) {
    // Эта часть выполняется ТОЛЬКО на index.html
    const loginModal = document.getElementById('adminLoginModal');
    const registerModal = document.getElementById('adminRegisterModal');
    const loginForm = document.getElementById('adminLoginForm');
    const registerForm = document.getElementById('adminRegisterForm');
    const showRegisterLink = document.getElementById('showRegisterLink');
    const showLoginLink = document.getElementById('showLoginLink');
    const closeBtns = document.querySelectorAll('.modal-close');

    // Открыть модалку входа
    startBtn.onclick = () => {
        if (loginModal) loginModal.style.display = 'flex';
    };

    // Закрыть модалки
    closeBtns.forEach(btn => {
        btn.onclick = () => {
            if (loginModal) loginModal.style.display = 'none';
            if (registerModal) registerModal.style.display = 'none';
        };
    });

    // Переключение на регистрацию
    if (showRegisterLink) {
        showRegisterLink.onclick = (e) => {
            e.preventDefault();
            if (loginModal) loginModal.style.display = 'none';
            if (registerModal) registerModal.style.display = 'flex';
        };
    }

    // Переключение на вход
    if (showLoginLink) {
        showLoginLink.onclick = (e) => {
            e.preventDefault();
            if (registerModal) registerModal.style.display = 'none';
            if (loginModal) loginModal.style.display = 'flex';
        };
    }

    // Обработка входа
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            try {
                await signInWithEmailAndPassword(auth, email, password);
                window.location.href = 'admin.html';
            } catch (error) {
                alert('Ошибка входа: ' + error.message);
            }
        };
    }

    // Обработка регистрации
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirm = document.getElementById('registerConfirmPassword').value;
            
            if (password !== confirm) {
                alert('Пароли не совпадают');
                return;
            }
            
            if (password.length < 6) {
                alert('Пароль должен быть минимум 6 символов');
                return;
            }
            
            try {
                await createUserWithEmailAndPassword(auth, email, password);
                alert('Регистрация успешна! Теперь войдите.');
                if (registerModal) registerModal.style.display = 'none';
                if (loginModal) loginModal.style.display = 'flex';
                registerForm.reset();
            } catch (error) {
                alert('Ошибка регистрации: ' + error.message);
            }
        };
    }

    // Клик вне модалки для закрытия
    window.onclick = (e) => {
        if (e.target === loginModal && loginModal) loginModal.style.display = 'none';
        if (e.target === registerModal && registerModal) registerModal.style.display = 'none';
    };
}
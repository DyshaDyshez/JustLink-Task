/**
 * telegram.js
 * Отправка уведомлений в Telegram (обфусцированная версия)
 */

import { db } from './firebase-init.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Кэш токена
let cachedToken = null;
let tokenCacheTime = null;
const CACHE_TTL = 5 * 60 * 1000;

// Маскируем敏感ные строки
const TG_HOST = 'api.' + 'telegram.org';
const TG_PATH = '/bot';

// Получить токен из Firestore
async function getBotToken() {
    if (cachedToken && tokenCacheTime && (Date.now() - tokenCacheTime) < CACHE_TTL) {
        return cachedToken;
    }
    
    try {
        const docRef = doc(db, 'settings', 'botToken');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().token) {
            cachedToken = docSnap.data().token;
            tokenCacheTime = Date.now();
            console.log('[TG] Token loaded');
            return cachedToken;
        } else {
            console.warn('[TG] Token not found');
            return null;
        }
    } catch (error) {
        console.error('[TG] Token error:', error);
        return null;
    }
}

// Отправка сообщения
export async function sendTelegramMessage(chatId, text) {
    const token = await getBotToken();
    if (!token) {
        console.warn('[TG] No token');
        return false;
    }
    
    // Собираем URL частями
    const protocol = 'https://';
    const fullUrl = protocol + TG_HOST + TG_PATH + token + '/sendMessage';
    
    try {
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            })
        });
        
        const data = await response.json();
        if (data.ok) {
            console.log('[TG] Message sent');
        } else {
            console.error('[TG] Error:', data.description);
        }
        return data.ok;
    } catch (error) {
        console.error('[TG] Fetch error:', error);
        return false;
    }
}

// Уведомление о новой задаче
export async function notifyNewTask(task, employeeTelegramId, roomName) {
    if (!employeeTelegramId) {
        console.warn('[TG] No telegramId');
        return false;
    }
    
    const deadlineText = task.deadline ? new Date(task.deadline).toLocaleString() : 'не указан';
    
    // Экранируем HTML
    const safeTitle = String(task.title).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
    
    const safeDesc = task.description ? String(task.description).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    }) : '';
    
    const safeRoom = String(roomName).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
    
    const messageLines = [];
    messageLines.push('📋 <b>НОВАЯ ЗАДАЧА!</b>');
    messageLines.push('━━━━━━━━━━━━━━━');
    messageLines.push('📌 <b>' + safeTitle + '</b>');
    if (safeDesc) messageLines.push('📝 ' + safeDesc);
    messageLines.push('🏢 Комната: ' + safeRoom);
    messageLines.push('⏰ Дедлайн: ' + deadlineText);
    messageLines.push('');
    messageLines.push('🔗 Ссылка: ' + window.location.origin + '/employee.html?room=' + task.roomId + '&employee=' + task.assigneeId);
    
    const message = messageLines.join('\n');
    
    return sendTelegramMessage(employeeTelegramId, message);
}
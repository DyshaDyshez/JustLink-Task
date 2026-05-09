const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Твой токен от BotFather (замени на реальный)
const BOT_TOKEN = '8280642862:AAEK3fbCN7IU_twQCV4ff8H_NrNC589hUeM';

// Отправка сообщения в Telegram
async function sendTelegramMessage(chatId, text) {
    const https = require('https');
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    
    const postData = JSON.stringify({
        chat_id: chatId,
        text: text
    });
    
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(true));
        });
        
        req.on('error', (e) => {
            console.error('Ошибка:', e);
            reject(false);
        });
        
        req.write(postData);
        req.end();
    });
}

// Вебхук для Telegram (бот будет отвечать на команды)
exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
    const update = req.body;
    const message = update.message;
    
    if (message && message.text) {
        const chatId = message.chat.id;
        const text = message.text;
        
        if (text === '/start') {
            await sendTelegramMessage(chatId, 
                '👋 Привет! Я бот JustLink Task.\n\nОтправь команду /myid, чтобы узнать свой Telegram ID.');
        }
        else if (text === '/myid') {
            await sendTelegramMessage(chatId, 
                `🤖 Твой Telegram ID: ${chatId}\n\nПередай этот ID руководителю.`);
        }
    }
    
    res.sendStatus(200);
});
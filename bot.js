const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
const TELEGRAM_BOT_TOKEN = '8760735795:AAE8BybKmYt8JyV4INOwAbV1ukYpj0Ag56E'; 
const CHANNEL_CHAT_ID = '-1003879763598'; 
const ADMIN_ID = '8358255492'; 
const CHANNEL_LINK = 'https://t.me/BULIDPRO'; 

// 🟢 DEFAULT STICKERS
const DEFAULT_STICKERS = {
    win: 'CAACAgUAAxkBAAEGxbhqpFBAYoBBfkci1nqKQMykp2clWQACbxQAAvvweFY9gMKaaaZ_Hz0E',
    loss: 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA', 
    jpt1: 'CAACAgUAAxkBAAEGxbRqpFAgw3AmWBExIgSWMZHu59sAAWoAApYPAAKPHXlWBNkiCpfo-yA9BA', 
    jpt2: 'CAACAgUAAxkBAAEGxbNqpFAgrZ0yGhD6dSOxD3Z8fl4hIgACAhAAAkmUeFYO5k1fKCUsRz0E', 
    jpt3: 'CAACAgUAAxkBAAEGxbJqpFAfhB0qQtog2WYxFKpYd5Vh1AACxw8AAvsJeVaBbAgF_n3m8j0E', 
    skip: 'CAACAgUAAxkBAAEGxbxqpFBPx9PqmPrnmbe3uXf47sk2WQACDw8AAlLmeVZPWovInAvkFT0E',
    morning: 'CAACAgUAAxkBAAEGxdZqpFJnYqt9SwUCbN1faymo--Fz-gACkhEAAmmYeFY2PES7ivQb2z0E',
    night: 'CAACAgUAAxkBAAEGxXxqpE0IZLYfOV9KcedlqzWmoY0JpgACFhEAAkQn4VXDknqUSMyX7T0E',
    predStart: 'CAACAgUAAxkBAAEGxb5qpFBXv3MhLqfJzb7zaG2EXRnY3QACbBUAAsAsIFdjqS8Z8HQ2zD0E',
    predEnd: 'CAACAgUAAxkBAAEGxc5qpFH5BX41GeGqht0yXLck6ozCDAACNxEAAjXPKVe4-q5YhV0VYj0E',
    megaWin: 'CAACAgUAAxkBAAEGxdRqpFJIVz-g7zEMJjdozZJQsmquaQAC8BkAAl17MFQ05QXD-JXE-D0E',
    megaJackpot: 'CAACAgUAAxkBAAEGxcBqpFBn_Ineoqgu8wgZssaBvlWCFgAC-hQAAu0OiFSGFOobgNZJHD0E'
};

const API_ENDPOINT = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=50";

let history = []; 
let botLevel = 1; 
let maxLevel = 20; 
let walletBalance = 4000; 
let currentPrediction = null; 
let autoPostTimeout = null;
let isBotActive = true; 
let skipMode = true; 
let consecutiveWins = 0;
let consecutiveJackpots = 0; 
let dailyFlags = { morning: false, night: false, pin: false };
let pendingStickerUpdate = {}; 

let stats = { total: 0, wins: 0, losses: 0, jackpots: 0, skips: 0, maxLevelReached: 1, hourlyData: {}, pctTracker: {}, stickers: {} };
let recoveryUsers = {}; 

if (fs.existsSync('./stats.json')) { 
    try { 
        stats = JSON.parse(fs.readFileSync('./stats.json')); 
        if (!stats.stickers || Object.keys(stats.stickers).length === 0) stats.stickers = DEFAULT_STICKERS;
    } catch (e) {} 
} else { stats.stickers = DEFAULT_STICKERS; }
setInterval(() => { fs.writeFileSync('./stats.json', JSON.stringify(stats)); }, 5 * 60 * 1000); 

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
http.createServer((req, res) => { res.writeHead(200); res.end('BulidPro Master AI V25 Active!\n'); }).listen(process.env.PORT || 3000);

// ==========================================
// 🎯 ADMIN STICKERS
// ==========================================
bot.onText(/^\/setsticker\s+(win|loss|jpt1|jpt2|jpt3|skip)$/, (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    pendingStickerUpdate[msg.chat.id] = match[1];
    bot.sendMessage(msg.chat.id, `✅ <b>${match[1].toUpperCase()}</b> के लिए नया स्टीकर भेजें...`, {parse_mode: 'HTML'});
});

bot.on('sticker', async (msg) => {
    if (msg.chat.type === 'private' && msg.from.id.toString() === ADMIN_ID) {
        if (pendingStickerUpdate[msg.chat.id]) {
            let type = pendingStickerUpdate[msg.chat.id];
            try {
                await bot.sendSticker(msg.chat.id, msg.sticker.file_id);
                stats.stickers[type] = msg.sticker.file_id;
                delete pendingStickerUpdate[msg.chat.id];
                bot.sendMessage(msg.chat.id, `✅ <b>एकदम फिट!</b>\nयह स्टीकर <b>${type.toUpperCase()}</b> के लिए सेट हो गया है।`, {parse_mode: 'HTML'});
            } catch (e) { bot.sendMessage(msg.chat.id, `❌ <b>रिजेक्टेड!</b> कोई दूसरा स्टीकर भेजें।`, {parse_mode: 'HTML'}); }
        }
    }
});

// ==========================================
// 🛠️ MATH (MIN BET 1)
// ==========================================
function getISTTime() { return new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + (3600000 * 5.5)); }
function getISTTimeString() {
    let nd = getISTTime(), h = nd.getHours(), m = nd.getMinutes(), ampm = h >= 12 ? 'PM' : 'AM'; 
    h = h % 12 || 12; m = m < 10 ? '0'+m : m; return (h < 10 ? '0'+h : h) + ':' + m + ' ' + ampm;
}
function getFancyType(type) {
    if (type === "BIG") return "🔵 BIGGG"; if (type === "SMALL") return "🟡 SMALL";
    if (type === "RED") return "🔴 REDDD"; if (type === "GREEN") return "🟢 GREEN"; return type; 
}

function getDynamicBet(level, wallet) {
    let levelMultiplier = Math.pow(3, level - 1);
    let levelTotalBet = levelMultiplier; 
    
    // मिनिमम 1 का रूल
    if (levelTotalBet < 1) levelTotalBet = 1;

    let bBet = Math.round(levelTotalBet * 0.72);
    let nBet = Math.floor((levelTotalBet - bBet) / 2);

    if (bBet >= 10 && bBet <= 25) nBet = 1; else if (bBet < 5) nBet = 0;
    
    bBet = levelTotalBet - (nBet * 2);
    if (bBet < 1) bBet = 1; // कम से कम ₹1 का दांव
    
    return { bBet, nBet, levelTotal: bBet + (nBet * 2) };
}

// ==========================================
// 🧠 30% RULE PREDICTION LOGIC
// ==========================================
function calculateRealProbability(historyData, type) {
    if (historyData.length < 20) return { pred: type === 'size' ? 'B' : 'R', chance: 50 };
    let currentSeq = "";
    for(let i=0; i<3; i++) {
        let item = historyData[i];
        if (type === 'size') currentSeq += (item.number >= 5 ? "B" : "S");
        else currentSeq += (item.number % 2 === 0 ? "R" : "G");
    }
    let matchCount = 0; let nextOutcomeCounts = {};
    for (let i = 3; i < historyData.length - 1; i++) {
        let histSeq = "";
        for(let j=0; j<3; j++) {
            let item = historyData[i - j];
            if (type === 'size') histSeq += (item.number >= 5 ? "B" : "S");
            else histSeq += (item.number % 2 === 0 ? "R" : "G");
        }
        if (histSeq === currentSeq) {
            matchCount++;
            let nextItem = historyData[i - 3]; 
            let nextVal = type === 'size' ? (nextItem.number >= 5 ? "B" : "S") : (nextItem.number % 2 === 0 ? "R" : "G");
            nextOutcomeCounts[nextVal] = (nextOutcomeCounts[nextVal] || 0) + 1;
        }
    }
    if (matchCount === 0) return { pred: type === 'size' ? 'B' : 'R', chance: 55 };
    let bestPred = ""; let bestCount = -1;
    for (let key in nextOutcomeCounts) {
        if (nextOutcomeCounts[key] > bestCount) { bestCount = nextOutcomeCounts[key]; bestPred = key; }
    }
    let chance = Math.round((bestCount / matchCount) * 100);
    if (chance < 50) chance = 50; 
    return { pred: bestPred, chance: chance };
}

function generatePrediction(nextId) {
    if (history.length < 10) return; 
    let finalSelection = "WAIT", skipReason = "", winChance = 0;

    let sizeResult = calculateRealProbability(history, 'size'); 
    let colResult = calculateRealProbability(history, 'color'); 

    if (sizeResult.chance >= 70 || colResult.chance >= 70) {
        // 🔥 30% RULE: कलर का चांस साइज से 30% ज़्यादा होना चाहिए
        if (colResult.chance >= sizeResult.chance + 30) {
            finalSelection = colResult.pred === "R" ? "RED" : "GREEN";
            winChance = colResult.chance;
        } else {
            finalSelection = sizeResult.pred === "B" ? "BIG" : "SMALL";
            winChance = sizeResult.chance;
        }
    } else {
        skipReason = "Low Probability (रिस्क बहुत ज़्यादा है)";
        finalSelection = "WAIT";
    }

    if ([0, 5].includes(history[0].number) && skipMode) {
        skipReason = "0/5 Volatile (Skip Mode ON)";
        finalSelection = "WAIT";
    }

    let finalNums = ["-", "-"];
    if (finalSelection === "BIG") finalNums = [7, 9]; if (finalSelection === "SMALL") finalNums = [1, 3];
    if (finalSelection === "RED") finalNums = [2, 8]; if (finalSelection === "GREEN") finalNums = [3, 7];

    currentPrediction = { issue: nextId, predType: finalSelection, nums: finalNums, level: botLevel, messageId: null, isChannelPosted: false, predTime: getISTTimeString(), chance: winChance, skipReason: skipReason };
    
    clearTimeout(autoPostTimeout);
    autoPostTimeout = setTimeout(async () => { if (currentPrediction && !currentPrediction.isChannelPosted) await sendPredictionToChannel(); }, 8000); 
}

async function sendPredictionToChannel() {
    if (!currentPrediction || currentPrediction.isChannelPosted) return;
    let msgContent = "";
    if (currentPrediction.predType === "WAIT") {
        bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.skip || DEFAULT_STICKERS.skip).catch(()=>{});
        msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟skip🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹0\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}/${maxLevel}\n━━━━━━━━━━━━━━━━━━━━━━━`;
    } else {
        const bets = getDynamicBet(currentPrediction.level, walletBalance);
        const nBetDisplay = bets.nBet > 0 ? `₹${bets.nBet} (EACH)` : `₹0 (LOW BAL)`;
        let chanceIcon = currentPrediction.chance >= 80 ? "🔥" : "⚡";
        
        msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   WAIT\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹${bets.bBet}\n━━━━━━━━━━━━━━━━━━━━━━━\n🪙 N•BET.  :- ${nBetDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}/${maxLevel}\n━━━━━━━━━━━━━━━━━━━━━━━\n${chanceIcon} <b>WIN CHANCE:- ${currentPrediction.chance}% SURE</b>\n━━━━━━━━━━━━━━━━━━━━━━━`;
    }
    try {
        const sentMessage = await bot.sendMessage(CHANNEL_CHAT_ID, msgContent, { parse_mode: 'HTML' });
        currentPrediction.messageId = sentMessage.message_id;
        currentPrediction.isChannelPosted = true;
    } catch (err) {}
}

async function monitorLoop() {
    if (!isBotActive) return;
    try {
        const response = await fetch(`${API_ENDPOINT}&t=${Date.now()}`);
        if (!response.ok) return;
        const json = await response.json();
        const list = json.data?.list || json.list || json.data || [];
        
        if (Array.isArray(list) && list.length > 0) {
            let newlyAdded = false;
            list.reverse().forEach(item => {
                const id = (item.issueNumber || item.period || item.issue).toString();
                const num = parseInt(item.number !== undefined ? item.number : item.resultNum);
                if (!history.find(h => h.issue === id)) { history.unshift({ issue: id, number: num }); newlyAdded = true; }
            });
            if (newlyAdded) {
                history.sort((a,b) => b.issue.localeCompare(a.issue));
                if (history.length > 600) history = history.slice(0, 600); 
                await handleNewOutcome();
            }
        }
    } catch (e) {}
}

async function handleNewOutcome() {
    if (history.length < 15) return;
    const latestOutcome = history[0], latestId = latestOutcome.issue;

    if (currentPrediction && currentPrediction.issue === latestId) {
        const actualNum = latestOutcome.number;
        const actualSize = actualNum >= 5 ? "🔵 BIGGG" : "🟡 SMALL";
        const actualColor = actualNum % 2 === 0 ? "🔴 RED" : "🟢 GREEN";
        let outcomeDisplay = `🌟${actualSize} / ${actualColor}(${actualNum})🌟`;
        
        if (currentPrediction.predType === "WAIT") {
            stats.skips++;
            try { await bot.editMessageText(`🚨 <b>PREDICTION RESOLVED</b> 🚨\n🆔 #${latestId.slice(-4)}\n🎯 MY PRE:- 🌟skip🌟\n🎲 RUGLT. :- ${outcomeDisplay}\n📊 LEVEL. :- ${currentPrediction.level}/${maxLevel}`, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (e) {}
        } else {
            stats.total++;
            let isWin = false; let isJackpot = currentPrediction.nums.includes(actualNum); 
            
            if (currentPrediction.predType === "BIG" && actualNum >= 5) isWin = true;
            else if (currentPrediction.predType === "SMALL" && actualNum < 5) isWin = true;
            else if (currentPrediction.predType === "RED" && actualNum % 2 === 0) isWin = true;
            else if (currentPrediction.predType === "GREEN" && actualNum % 2 !== 0) isWin = true;

            const bets = getDynamicBet(currentPrediction.level, walletBalance);
            let chanceIcon = currentPrediction.chance >= 80 ? "🔥" : "⚡";
            
            const editedMsg = `🚨 <b>PREDICTION RESOLVED</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${latestId.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   ${outcomeDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹${bets.bBet}\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}/${maxLevel}\n━━━━━━━━━━━━━━━━━━━━━━━\n${chanceIcon} <b>CHANCE:- ${currentPrediction.chance}% SURE</b>\n━━━━━━━━━━━━━━━━━━━━━━━`;
            try { await bot.editMessageText(editedMsg, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (err) {}

            if (isWin || isJackpot) {
                stats.levelHistoryTracker[botLevel] = (stats.levelHistoryTracker[botLevel] || 0) + 1;
                stats.wins++; consecutiveWins++;
                
                if (isJackpot) {
                    stats.jackpots++; consecutiveJackpots++;
                    let selectedSticker;
                    if (actualNum >= 0 && actualNum <= 3) selectedSticker = stats.stickers.jpt1 || DEFAULT_STICKERS.jpt1;
                    else if (actualNum >= 4 && actualNum <= 7) selectedSticker = stats.stickers.jpt3 || DEFAULT_STICKERS.jpt3;
                    else selectedSticker = stats.stickers.jpt2 || DEFAULT_STICKERS.jpt2;
                    bot.sendSticker(CHANNEL_CHAT_ID, selectedSticker).catch(()=>{});
                } else {
                    bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.win || DEFAULT_STICKERS.win).catch(()=>{});
                }
                botLevel = 1; 
            } else {
                stats.losses++; consecutiveWins = 0; consecutiveJackpots = 0; 
                bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.loss || DEFAULT_STICKERS.loss).catch(()=>{});
                
                if (botLevel >= maxLevel) {
                    bot.sendMessage(CHANNEL_CHAT_ID, `⚠️ <b>STOP LOSS HIT (Level ${maxLevel})</b>\nफंड बचाने के लिए लेवल 1 से फिर शुरू कर रहे हैं।`, {parse_mode: 'HTML'}).catch(()=>{});
                    botLevel = 1;
                } else {
                    botLevel++;
                }
            }
            if (botLevel > stats.maxLevelReached) stats.maxLevelReached = botLevel;
        }
    }
    const nextId = (BigInt(latestId) + 1n).toString();
    generatePrediction(nextId);
}

// ==========================================
// 💬 BUTTON-BASED PRIVATE RECOVERY SYSTEM
// ==========================================
bot.onText(/^\/start$/, (msg) => { bot.sendMessage(msg.chat.id, `🎉 <b>WELCOME, ${msg.from.first_name}!</b> 🎉\n\n👇 <b>मेन्यू:</b>\n👉 /stats - लाइव एक्यूरेसी\n👉 /chart - 20X फंड चार्ट\n👉 /recovery - (PM Only) रिकवरी शुरू करें`, { parse_mode: 'HTML' }).catch(()=>{}); });
bot.onText(/^\/chart$/, (msg) => {
    let chartMsg = `📊 <b>20-LEVEL FUND CHART</b> 📊\n💰 <b>Total Wallet:</b> ₹${walletBalance}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
    let cumulative = 0;
    for(let i = 1; i <= 10; i++) {
        const bets = getDynamicBet(i, walletBalance);
        cumulative += bets.levelTotal;
        const nBetText = bets.nBet > 0 ? `₹${bets.nBet}, ₹${bets.nBet}` : `₹0 (Low Bal)`;
        chartMsg += `👉 <b>L${i}:</b> B/S: ₹${bets.bBet} | Nums: ${nBetText} (Cum: ₹${cumulative})\n`;
    }
    bot.sendMessage(msg.chat.id, chartMsg, { parse_mode: 'HTML' }).catch(()=>{});
});
bot.onText(/^\/stats$/, (msg) => {
    const statsMsg = `📊 <b>LIVE BOT ACCURACY</b> 📊\n🔥 <b>Signals:</b> ${stats.total}\n🌟 <b>Wins:</b> ${stats.wins} | 🤬 <b>Losses:</b> ${stats.losses}\n📈 <b>Win Rate:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%`;
    bot.sendMessage(msg.chat.id, statsMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

// रिकवरी प्रोसेस 
bot.onText(/^\/recovery$/, (msg) => {
    if (msg.chat.type !== 'private') return bot.sendMessage(msg.chat.id, "⚠️ यह सिर्फ DM (Private) में काम करता है!");
    if (!recoveryUsers[msg.chat.id]) recoveryUsers[msg.chat.id] = { state: 'IDLE' };
    bot.sendMessage(msg.chat.id, `😔 <b>आपका कुल लॉस (Loss) कितना है?</b> (सिर्फ अमाउंट लिखें)`, {parse_mode:'HTML'});
    recoveryUsers[msg.chat.id].state = 'ASK_LOSS';
});

bot.on('message', (msg) => {
    if (msg.chat.type !== 'private' || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id, text = msg.text;
    if (!recoveryUsers[chatId]) return;
    let user = recoveryUsers[chatId];

    if (user.state === 'ASK_LOSS' && !isNaN(text)) {
        user.loss = parseFloat(text);
        bot.sendMessage(chatId, `💰 <b>अभी आपके वॉलेट में कुल कितना बैलेंस (Wallet) है?</b>`, {parse_mode:'HTML'});
        user.state = 'ASK_WALLET';
    }
    else if (user.state === 'ASK_WALLET' && !isNaN(text)) {
        user.wallet = parseFloat(text);
        // टारगेट = वॉलेट + (लॉस का थोड़ा हिस्सा)
        user.target = user.wallet + Math.min(user.loss, Math.max(50, user.wallet * 0.2)); 
        
        bot.sendSticker(chatId, stats.stickers.predStart || DEFAULT_STICKERS.predStart).catch(()=>{}); // Start Session Sticker
        
        let planMsg = `✅ <b>रिकवरी प्लान तैयार!</b>\n\n📉 <b>लॉस:</b> ₹${user.loss}\n💳 <b>वॉलेट:</b> ₹${user.wallet}\n🎯 <b>टारगेट बैलेंस:</b> ₹${user.target}\n\nनीचे दिए गए बटन पर क्लिक करके प्रेडिक्शन लें👇`;
        
        bot.sendMessage(chatId, planMsg, {
            parse_mode:'HTML',
            reply_markup: { inline_keyboard: [[{text: "🎯 Start Recovery", callback_data: "next_pred"}]] }
        });
        user.state = 'READY';
    }
});

// बटन क्लिक्स हैंडलर
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    let user = recoveryUsers[chatId];
    
    if (!user || user.state !== 'READY') return bot.answerCallbackQuery(query.id, {text: "Please /recovery first"});

    if (data === 'next_pred') {
        if (user.cooldown && Date.now() < user.cooldown) {
            return bot.answerCallbackQuery(query.id, {text: "⚠️ 1 घंटे बाद आना! ट्रेंड खराब है।", show_alert: true});
        }
        
        if (currentPrediction && currentPrediction.chance >= 70) {
            const bets = getDynamicBet(currentPrediction.level, user.wallet);
            const nBetDisplay = bets.nBet > 0 ? `₹${bets.nBet}` : `₹0 (Low Bal)`;
            
            let msg = `🎯 <b>PRIVATE SIGNAL</b>\n\n🌟 <b>लगाओ:</b> ${currentPrediction.predType}\n💵 <b>अमाउंट:</b> ₹${bets.bBet}\n🪙 <b>नंबर (${currentPrediction.nums}):</b> ${nBetDisplay}\n\n<i>रिज़ल्ट आने के बाद नीचे क्लिक करें:</i>`;
            
            bot.sendMessage(chatId, msg, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{text: "✅ Win", callback_data: `res_win_${bets.bBet}`}, {text: "❌ Loss", callback_data: `res_loss_${bets.bBet}`}]
                    ]
                }
            });
            bot.answerCallbackQuery(query.id);
        } else {
            bot.sendMessage(chatId, `⚠️ <b>ट्रेंड बहुत खराब है भाई!</b>\nमैं अभी रिस्क नहीं ले सकता। <b>1 घंटे बाद आना</b>।`, {parse_mode:'HTML'});
            user.cooldown = Date.now() + (60 * 60 * 1000); 
            bot.answerCallbackQuery(query.id);
        }
    } 
    else if (data.startsWith('res_win') || data.startsWith('res_loss')) {
        let isWin = data.startsWith('res_win');
        let amount = parseFloat(data.split('_')[2]);
        
        if (isWin) user.wallet += (amount * 0.95); // प्रॉफिट
        else user.wallet -= amount; // लॉस
        
        // बटन हटा दो
        bot.editMessageReplyMarkup({inline_keyboard: []}, {chat_id: chatId, message_id: query.message.message_id}).catch(()=>{});
        
        if (user.wallet >= user.target) {
            bot.sendSticker(chatId, stats.stickers.predEnd || DEFAULT_STICKERS.predEnd).catch(()=>{});
            bot.sendMessage(chatId, `🎉 <b>TARGET REACHED!</b> 🎉\nआपका आज का रिकवरी टारगेट पूरा हो गया।\n💰 <b>Final Wallet:</b> ₹${Math.round(user.wallet)}\nलालच मत करो, कल मिलेंगे!`, {parse_mode:'HTML'});
            delete recoveryUsers[chatId];
        } else if (user.wallet < 1) {
            bot.sendSticker(chatId, stats.stickers.loss || DEFAULT_STICKERS.loss).catch(()=>{});
            bot.sendMessage(chatId, `😔 <b>TOTAL LOSS</b> 😔\nभाई आपका फंड ₹1 से कम हो गया है। आज के लिए सेशन क्लोज!`, {parse_mode:'HTML'});
            delete recoveryUsers[chatId];
        } else {
            bot.sendMessage(chatId, `💰 <b>Wallet:</b> ₹${Math.round(user.wallet)} / 🎯 <b>Target:</b> ₹${Math.round(user.target)}\n\nअगले दांव के लिए क्लिक करें👇`, {
                parse_mode:'HTML',
                reply_markup: { inline_keyboard: [[{text: "🎯 Next Prediction", callback_data: "next_pred"}]] }
            });
        }
        bot.answerCallbackQuery(query.id);
    }
});

// 🔒 ADMIN COMMANDS
bot.onText(/^\/startsession$/, (msg) => { if (msg.from.id.toString() !== ADMIN_ID) return; isBotActive = true; bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.predStart || DEFAULT_STICKERS.predStart).catch(()=>{}); bot.sendMessage(msg.chat.id, "✅ Session Started!"); });
bot.onText(/^\/endsession$/, (msg) => { if (msg.from.id.toString() !== ADMIN_ID) return; isBotActive = false; bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.predEnd || DEFAULT_STICKERS.predEnd).catch(()=>{}); bot.sendMessage(msg.chat.id, "✅ Session Ended!"); });
bot.onText(/^\/skipmode$/, (msg) => { if (msg.from.id.toString() !== ADMIN_ID) return; skipMode = !skipMode; bot.sendMessage(msg.chat.id, `⚙️ Skip Mode is now ${skipMode ? "ON" : "OFF"}`); });

setInterval(monitorLoop, 5000);
console.log("🚀 BULIDPRO Master AI (Button Recovery) Booted Successfully...");

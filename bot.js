const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// ==========================================
// ⚙️ CONFIGURATION (आपकी डिटेल्स)
// ==========================================
const TELEGRAM_BOT_TOKEN = '8760735795:AAE8BybKmYt8JyV4INOwAbV1ukYpj0Ag56E'; 
const CHANNEL_CHAT_ID = '-1003879763598'; 
const ADMIN_ID = '8358255492'; 
const RENDER_APP_URL = "https://build-pro-predator.onrender.com"; 
const TELEGRAM_CHANNEL_ID = "https://t.me/BULIDPRO";

const API_ENDPOINT = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=15";

let history = []; 
let botLevel = 1;
let baseBetAmount = 10; 
let currentPrediction = null; 
let autoPostTimeout = null;
let isPollingReconnecting = false; 
let isBotActive = true; 
let dailyReportSent = false;
let midnightPinSent = false;
let consecutiveWins = 0;
let consecutiveJackpots = 0; 
let pendingSticker = null; 

// 📊 Stats & Dynamic Data Object
let stats = {
    total: 0, wins: 0, losses: 0, jackpots: 0,
    maxLevelReached: 1, levelHistoryTracker: {}, 
    hourlyData: {}, 
    percentTracker: {}, 
    stickers: {
        win: 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA',
        loss: 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA',
        jackpot: 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE',
        streak_win: 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA', 
        streak_jackpot: 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE',
        gm: 'CAACAgEAAxkBAAE...', 
        gn: 'CAACAgEAAxkBAAE...'  
    }
};

if (fs.existsSync('./stats.json')) {
    try { 
        let loaded = JSON.parse(fs.readFileSync('./stats.json')); 
        stats = { ...stats, ...loaded };
    } catch (e) {}
}
setInterval(() => { fs.writeFileSync('./stats.json', JSON.stringify(stats)); }, 5 * 60 * 1000); 

// ==========================================
// 🤖 BOT SETUP & SERVER (With Self-Ping)
// ==========================================
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false, request: { agentOptions: { family: 4 } } });

bot.on('polling_error', (error) => {
    if (String(error).includes('409 Conflict') && !isPollingReconnecting) {
        isPollingReconnecting = true;
        bot.stopPolling().then(() => {
            setTimeout(() => { bot.startPolling({ restart: true }).then(() => isPollingReconnecting = false).catch(() => isPollingReconnecting = false); }, 15000); 
        }).catch(() => isPollingReconnecting = false);
    }
});
bot.deleteWebHook({ drop_pending_updates: true }).then(() => bot.startPolling({ restart: true }));

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('Predator Ultra Bug-Fixed Active!\n'); }).listen(PORT);

setInterval(() => {
    http.get(RENDER_APP_URL).on('error', (err) => { console.error('Ping Keep-Alive Error'); });
}, 5 * 60 * 1000); 

// ==========================================
// 🛠️ UTILITY & MATH FUNCTIONS
// ==========================================
function getISTTime() { return new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + (3600000 * 5.5)); }
function getISTTimeString() {
    let nd = getISTTime(), h = nd.getHours(), m = nd.getMinutes();
    let ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; m = m < 10 ? '0'+m : m;
    return (h < 10 ? '0'+h : h) + ':' + m + ' ' + ampm;
}
function getFancyType(type) {
    if (type === "BIG") return "🔵 BIGGG"; if (type === "SMALL") return "🟡 SMALL"; return type; 
}
function getRandomNumber(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getDynamicBet(level, baseAmount) {
    const levelMultiplier = Math.pow(3, level - 1); 
    const levelTotalBet = Math.round(baseAmount * levelMultiplier);
    let bBet = Math.round(levelTotalBet * 0.72);
    let nBet = Math.floor((levelTotalBet - bBet) / 2);
    if (bBet >= 10 && bBet <= 25) { nBet = 1; } else if (bBet < 5) { nBet = 0; }
    bBet = levelTotalBet - (nBet * 2);
    if (bBet < 1) { bBet = levelTotalBet; nBet = 0; }
    return { bBet, nBet, levelTotal: bBet + (nBet * 2) };
}

function getBadNumbers(historyData) {
    let counts = {}; let breaks = {};
    for(let i = 0; i < historyData.length - 1; i++) {
        let currentSize = historyData[i].number >= 5 ? "B" : "S"; 
        let prevSize = historyData[i+1].number >= 5 ? "B" : "S"; 
        let prevNum = historyData[i+1].number; 
        counts[prevNum] = (counts[prevNum] || 0) + 1;
        if(currentSize !== prevSize) breaks[prevNum] = (breaks[prevNum] || 0) + 1;
    }
    let badNums = [0, 5]; 
    for(let i = 0; i <= 9; i++) {
        if(counts[i] >= 5 && (breaks[i] / counts[i]) >= 0.60) {
            if(!badNums.includes(i)) badNums.push(i);
        }
    }
    return badNums;
}

// ==========================================
// 🧠 PREDICTION LOGIC
// ==========================================
function generatePrediction(nextId) {
    if (history.length < 8) return; 

    let activeBadNumbers = getBadNumbers(history);
    let lastNum = history[0].number;
    
    let seq = "";
    for(let i = 0; i < 8; i++) { seq += (history[i].number >= 5 ? "B" : "S"); }
    let p = seq.split('').reverse().join(''); 

    let finalSelection = history[0].number >= 5 ? "BIG" : "SMALL"; 
    let baseWinChance = 65; 

    if (p.endsWith("BSBSBS") || p.endsWith("SBSBSB")) { finalSelection = p.endsWith("S") ? "BIG" : "SMALL"; baseWinChance = 88; } 
    else if (p.endsWith("BBS") || p.endsWith("SSB")) { finalSelection = p.endsWith("S") ? "SMALL" : "BIG"; baseWinChance = 90; } 
    else if (p.endsWith("BBBS") || p.endsWith("SSSB")) { finalSelection = p.endsWith("S") ? "SMALL" : "BIG"; baseWinChance = 92; } 
    else if (p.endsWith("BBBBS") || p.endsWith("SSSSB")) { finalSelection = p.endsWith("S") ? "SMALL" : "BIG"; baseWinChance = 94; } 
    else if (p.endsWith("BBSBBS") || p.endsWith("SSBSSB")) { finalSelection = p.endsWith("S") ? "BIG" : "SMALL"; baseWinChance = 87; } 
    else if (p.endsWith("BBBBBB") || p.endsWith("SSSSSS")) { finalSelection = p.endsWith("S") ? "SMALL" : "BIG"; baseWinChance = 80; } 
    else if (p.endsWith("BSSBSS") || p.endsWith("SBBSSBB")) { finalSelection = p.endsWith("S") ? "BIG" : "SMALL"; baseWinChance = 85; } 
    else if (p.endsWith("BBBSBBBS") || p.endsWith("SSSBSBSS")) { finalSelection = p.endsWith("S") ? "BIG" : "SMALL"; baseWinChance = 89; } 
    else if (p.endsWith("BBSBB") || p.endsWith("SSBSS")) { finalSelection = p.endsWith("B") ? "SMALL" : "BIG"; baseWinChance = 93; } 
    else if (p.endsWith("BSB") || p.endsWith("SBS")) { finalSelection = p.endsWith("B") ? "SMALL" : "BIG"; baseWinChance = 78; } 
    
    let isBadTrend = activeBadNumbers.includes(lastNum) || [0, 5].includes(lastNum);
    
    if (isBadTrend) {
        baseWinChance = getRandomNumber(51, 59);
    } else {
        if (baseWinChance === 65) baseWinChance = getRandomNumber(60, 69);
        else baseWinChance = getRandomNumber(baseWinChance - 2, baseWinChance + 2);
    }

    let finalNums = ["-", "-"];
    if (finalSelection === "BIG") finalNums = [7, 9];
    if (finalSelection === "SMALL") finalNums = [1, 3];

    currentPrediction = { issue: nextId, predType: finalSelection, nums: finalNums, level: botLevel, messageId: null, isChannelPosted: false, predTime: getISTTimeString(), chance: baseWinChance };
    
    clearTimeout(autoPostTimeout);
    autoPostTimeout = setTimeout(async () => {
        if (currentPrediction && !currentPrediction.isChannelPosted) await sendPredictionToChannel();
    }, 8000); 
}

async function sendPredictionToChannel() {
    if (!currentPrediction || currentPrediction.isChannelPosted) return;
    
    const bets = getDynamicBet(currentPrediction.level, baseBetAmount);
    const nBetDisplay = bets.nBet > 0 ? `₹${bets.nBet} (EACH)` : `₹0 (LOW BAL)`;
    let chanceIcon = currentPrediction.chance >= 80 ? "🔥" : (currentPrediction.chance >= 65 ? "⚡" : "⚠️");

    // 🧹 Clean HTML Message Layout
    let msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>PERIOD:</b> #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━\n🎯 <b>MY PRE:</b> 🌟${getFancyType(currentPrediction.predType)}🌟\n━━━━━━━━━━━━━━━━━━━━\n🔮 <b>N•PRED:</b> 🌐(${currentPrediction.nums.join(',')})🌐\n━━━━━━━━━━━━━━━━━━━━\n🎲 <b>RUGLT:</b> WAIT\n━━━━━━━━━━━━━━━━━━━━\n💵 <b>B•BET:</b> ₹${bets.bBet} (SIZE)\n━━━━━━━━━━━━━━━━━━━━\n🪙 <b>N•BET:</b> ${nBetDisplay}\n━━━━━━━━━━━━━━━━━━━━\n📊 <b>LEVEL:</b> ${currentPrediction.level}\n━━━━━━━━━━━━━━━━━━━━\n${chanceIcon} <b>WIN CHANCE: ${currentPrediction.chance}%</b>\n━━━━━━━━━━━━━━━━━━━━`;
    
    try {
        const sentMessage = await bot.sendMessage(CHANNEL_CHAT_ID, msgContent, { parse_mode: 'HTML' });
        currentPrediction.messageId = sentMessage.message_id;
        currentPrediction.isChannelPosted = true;
    } catch (err) {
        console.log("Message Send Error:", err);
    }
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
                if (!history.find(h => h.issue === id)) {
                    history.unshift({ issue: id, number: num });
                    newlyAdded = true;
                }
            });
            if (newlyAdded) {
                history.sort((a,b) => b.issue.localeCompare(a.issue));
                if (history.length > 600) history = history.slice(0, 600); 
                await handleNewOutcome();
            }
        }
    } catch (e) {}
}

// 🛠️ BUG FIX: DEEP SEARCH OUTCOME LOGIC
async function handleNewOutcome() {
    if (!currentPrediction) {
        if (history.length > 0) generatePrediction((BigInt(history[0].issue) + 1n).toString());
        return;
    }

    // 🔍 सीधे हिस्ट्री में खोजें (अगर API लेट भी हुआ, तो रिज़ल्ट ढूँढ लेगा)
    const resolvedOutcome = history.find(h => h.issue === currentPrediction.issue);

    if (resolvedOutcome) {
        const actualNum = resolvedOutcome.number;
        const actualSize = actualNum >= 5 ? "🔵 BIGGG" : "🟡 SMALL";
        let outcomeDisplay = `🌟${actualSize}(${actualNum})🌟`;
        
        stats.total++;
        let isWin = false;
        let isJackpot = currentPrediction.nums.includes(actualNum); 
        
        if (currentPrediction.predType === "BIG" && actualNum >= 5) isWin = true;
        else if (currentPrediction.predType === "SMALL" && actualNum < 5) isWin = true;

        let pctRange = Math.floor(currentPrediction.chance / 5) * 5; 
        let rangeKey = `${pctRange}%-${pctRange+4}%`;
        if(!stats.percentTracker[rangeKey]) stats.percentTracker[rangeKey] = { w:0, l:0, j:0 };
        
        if(isJackpot) stats.percentTracker[rangeKey].j++;
        if(isWin || isJackpot) stats.percentTracker[rangeKey].w++;
        else stats.percentTracker[rangeKey].l++;

        let currentHour = getISTTime().getHours();
        if(!stats.hourlyData[currentHour]) stats.hourlyData[currentHour] = { wins: 0, total: 0 };
        stats.hourlyData[currentHour].total++;
        if(isWin || isJackpot) stats.hourlyData[currentHour].wins++;

        const bets = getDynamicBet(currentPrediction.level, baseBetAmount);
        let chanceIcon = currentPrediction.chance >= 80 ? "🔥" : (currentPrediction.chance >= 65 ? "⚡" : "⚠️");
        
        // 🧹 Clean Result Edit Message
        const editedMsg = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>PERIOD:</b> #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━\n🎯 <b>MY PRE:</b> 🌟${getFancyType(currentPrediction.predType)}🌟\n━━━━━━━━━━━━━━━━━━━━\n🎲 <b>RUGLT:</b> ${outcomeDisplay}\n━━━━━━━━━━━━━━━━━━━━\n💵 <b>B•BET:</b> ₹${bets.bBet} (SIZE)\n━━━━━━━━━━━━━━━━━━━━\n📊 <b>LEVEL:</b> ${currentPrediction.level}\n━━━━━━━━━━━━━━━━━━━━\n${chanceIcon} <b>WIN CHANCE: ${currentPrediction.chance}%</b>\n━━━━━━━━━━━━━━━━━━━━`;
        
        try { 
            if(currentPrediction.messageId) {
                await bot.editMessageText(editedMsg, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); 
            }
        } catch (err) {}

        if (isWin || isJackpot) {
            stats.levelHistoryTracker[botLevel] = (stats.levelHistoryTracker[botLevel] || 0) + 1;
            stats.wins++;
            consecutiveWins++;
            
            if(isJackpot) {
                stats.jackpots++;
                consecutiveJackpots++;
                bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.jackpot).catch(()=>{});
            } else {
                consecutiveJackpots = 0; 
                bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.win).catch(()=>{});
            }

            if (consecutiveWins === 5) {
                bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.streak_win).catch(()=>{});
                bot.sendMessage(CHANNEL_CHAT_ID, `🔥 <b>UNSTOPPABLE! 5 BACK-TO-BACK WINS!</b> 🔥\nमार्केट का पूरा पैसा खींच लिया! है कोई टक्कर में? 😎`, { parse_mode: 'HTML' }).catch(()=>{});
                consecutiveWins = 0; 
            }
            if (consecutiveJackpots === 5) {
                bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.streak_jackpot).catch(()=>{});
                bot.sendMessage(CHANNEL_CHAT_ID, `🚀 <b>HISTORY CREATED! 5 BACK-TO-BACK JACKPOTS!</b> 🚀\nनंबर विन की झड़ी लगा दी! सीधा 9X प्रॉफिट! 💸`, { parse_mode: 'HTML' }).catch(()=>{});
                consecutiveJackpots = 0;
            }

            botLevel = 1; 
        } else {
            stats.losses++;
            consecutiveWins = 0;
            consecutiveJackpots = 0; 
            
            botLevel++; 
            bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.loss).catch(()=>{});
        }
        if (botLevel > stats.maxLevelReached) stats.maxLevelReached = botLevel;
        
        currentPrediction = null; // रिसेट प्रेडिक्शन
        const latestId = history[0].issue; // अगला पीरियड निकालें
        generatePrediction((BigInt(latestId) + 1n).toString());

    } else {
        // 🚨 अगर API ने कोई पीरियड पूरी तरह जंप कर दिया (Missed Data)
        if (history.length > 0 && BigInt(history[0].issue) > BigInt(currentPrediction.issue)) {
            currentPrediction = null;
            const latestId = history[0].issue;
            generatePrediction((BigInt(latestId) + 1n).toString());
        }
    }
}

// ==========================================
// 🎨 DYNAMIC STICKER MANAGEMENT (Admin Only)
// ==========================================
bot.on('message', (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;

    let fileId = null;
    if (msg.sticker) { fileId = msg.sticker.file_id; } 
    else if (msg.text && msg.text.length > 20 && !msg.text.includes(' ') && !msg.text.startsWith('/')) { fileId = msg.text; }

    if (fileId) {
        pendingSticker = fileId;
        const opts = { reply_markup: { inline_keyboard: [ [{ text: '✅ हाँ', callback_data: 'sticker_yes' }, { text: '❌ नहीं', callback_data: 'sticker_no' }] ] } };
        bot.sendMessage(msg.chat.id, "🎯 क्या आप इस स्टीकर को अपने चैनल प्रेडिक्शन के लिए यूज़ करना चाहते हैं?", opts);
    }
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    if (query.data === 'sticker_no') {
        pendingSticker = null;
        bot.editMessageText("❌ स्टीकर अपडेट कैंसिल कर दिया गया।", { chat_id: chatId, message_id: query.message.message_id });
    } 
    else if (query.data === 'sticker_yes') {
        try {
            await bot.sendSticker(chatId, pendingSticker);
            const opts = { reply_markup: { inline_keyboard: [
                [{ text: '🟢 WIN (पास)', callback_data: 'set_win' }, { text: '🔴 LOSS (फेल)', callback_data: 'set_loss' }],
                [{ text: '🤑 JACKPOT (नंबर)', callback_data: 'set_jackpot' }],
                [{ text: '🔥 5 Back-To-Back Win', callback_data: 'set_streak_win' }, { text: '🚀 5 B2B Jackpot', callback_data: 'set_streak_jackpot' }],
                [{ text: '🌅 Good Morning', callback_data: 'set_gm' }, { text: '🌙 Good Night', callback_data: 'set_gn' }]
            ]}};
            bot.editMessageText("✅ स्टीकर मान्य है! कृपया चुनें कि इसे किस इवेंट के लिए सेट करना है:", { chat_id: chatId, message_id: query.message.message_id, reply_markup: opts.reply_markup });
        } catch (e) {
            bot.editMessageText("⚠️ यह स्टीकर बोट द्वारा सपोर्ट नहीं कर रहा है। कृपया कोई दूसरा स्टीकर भेजें!", { chat_id: chatId, message_id: query.message.message_id });
        }
    }
    else if (query.data.startsWith('set_')) {
        let key = query.data.replace('set_', '');
        if (stats.stickers[key] !== undefined && pendingSticker) {
            stats.stickers[key] = pendingSticker;
            bot.editMessageText(`✅ आपका नया स्टीकर सफलतापूर्वक **${key.toUpperCase()}** के लिए सेट कर दिया गया है!`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
            pendingSticker = null;
        }
    }
});

// ==========================================
// 📊 ADMIN ANALYTICS COMMAND
// ==========================================
bot.onText(/\/analytics/, (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    
    let bestHour = -1; let bestWinRate = -1;
    for(let h=0; h<24; h++) {
        if(stats.hourlyData[h] && stats.hourlyData[h].total >= 5) { 
            let rate = stats.hourlyData[h].wins / stats.hourlyData[h].total;
            if(rate > bestWinRate) { bestWinRate = rate; bestHour = h; }
        }
    }
    
    let timeStr = "Not enough data";
    if (bestHour !== -1) {
        let ampm1 = bestHour >= 12 ? 'PM' : 'AM'; let h1 = bestHour % 12 || 12;
        let nextH = (bestHour + 1) % 24; let ampm2 = nextH >= 12 ? 'PM' : 'AM'; let h2 = nextH % 12 || 12;
        timeStr = `${h1}:00 ${ampm1} - ${h2}:00 ${ampm2} (${Math.round(bestWinRate*100)}% Win)`;
    }

    let pctText = "";
    Object.keys(stats.percentTracker).sort().reverse().forEach(pct => {
        let d = stats.percentTracker[pct];
        pctText += `👉 <b>${pct}:</b> 🟢 ${d.w} W | 🔴 ${d.l} L | 🤑 ${d.j} J\n`;
    });

    const replyMsg = `👑 <b>ADMIN SUPER ANALYTICS</b> 👑\n\n🏆 <b>Golden Time (Last 24h):</b>\n${timeStr}\n\n📊 <b>Percentage Accuracy Tracker:</b>\n${pctText || "अभी डेटा बन रहा है..."}`;
    bot.sendMessage(msg.chat.id, replyMsg, { parse_mode: 'HTML' });
});

// ==========================================
// 🕛 MIDNIGHT LOGIC & DAILY REPORT
// ==========================================
setInterval(() => {
    const now = getISTTime();
    
    if (now.getHours() === 8 && now.getMinutes() === 0 && stats.stickers.gm) {
        bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.gm).catch(()=>{});
        bot.sendMessage(CHANNEL_CHAT_ID, `🌅 <b>GOOD MORNING VIP FAMILY!</b> 🌅\nतैयार हो जाइए आज के तगड़े प्रॉफिट के लिए! 💸\n${TELEGRAM_CHANNEL_ID}`, { parse_mode: 'HTML' }).catch(()=>{});
    }
    if (now.getHours() === 23 && now.getMinutes() === 58 && stats.stickers.gn) {
        bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.gn).catch(()=>{});
        bot.sendMessage(CHANNEL_CHAT_ID, `🌙 <b>GOOD NIGHT VIP TEAM!</b> 🌙\nआज का सेशन खत्म, कल मिलेंगे नई एनर्जी के साथ!\n${TELEGRAM_CHANNEL_ID}`, { parse_mode: 'HTML' }).catch(()=>{});
    }

    if (now.getHours() === 0 && now.getMinutes() === 0 && !midnightPinSent) {
        let bestHour = -1; let bestWinRate = -1;
        for(let h=0; h<24; h++) {
            if(stats.hourlyData[h] && stats.hourlyData[h].total >= 10) { 
                let rate = stats.hourlyData[h].wins / stats.hourlyData[h].total;
                if(rate > bestWinRate) { bestWinRate = rate; bestHour = h; }
            }
        }
        if(bestHour !== -1) {
            let ampm1 = bestHour >= 12 ? 'PM' : 'AM'; let h1 = bestHour % 12 || 12;
            let nextH = (bestHour + 1) % 24; let ampm2 = nextH >= 12 ? 'PM' : 'AM'; let h2 = nextH % 12 || 12;
            let timeStr = `${h1}:00 ${ampm1} से ${h2}:00 ${ampm2}`;
            let pinMsg = `🏆 <b>GOLDEN TRADING HOUR</b> 🏆\n\nपिछले 24 घंटे की AI रिसर्च के अनुसार, आज सबसे सुरक्षित दांव लगाने का समय है:\n\n⏰ <b>${timeStr}</b>\n⚡ <b>Win Rate:</b> ${Math.round(bestWinRate*100)}%\n\n<i>बोट 24 घंटे चालू है, लेकिन इस समय पर प्रॉफिट के चांस सबसे ज़्यादा होते हैं! 🚀</i>`;
            bot.sendMessage(CHANNEL_CHAT_ID, pinMsg, { parse_mode: 'HTML' }).then(sentMsg => {
                bot.pinChatMessage(CHANNEL_CHAT_ID, sentMsg.message_id).catch(()=>{});
            });
        }
        stats.hourlyData = {}; 
        stats.percentTracker = {}; 
        midnightPinSent = true;
    }
    if (now.getHours() === 0 && now.getMinutes() === 5) { midnightPinSent = false; }
}, 60000); 

// ==========================================
// 💬 USER COMMANDS
// ==========================================
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `🎉 <b>WELCOME TO PREDATOR VIP!</b> 🎉\n\n👉 /stats - लाइव एक्यूरेसी\n👉 /chart - 3X अनलिमिटेड चार्ट`, { parse_mode: 'HTML' }).catch(()=>{});
});
bot.onText(/\/chart/, (msg) => {
    let chartMsg = `📊 <b>UNLIMITED 3X CUMULATIVE CHART (UP TO L8)</b> 📊\n💰 <b>Base Level 1 Bet:</b> ₹${baseBetAmount}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
    let cumulative = 0;
    for(let i = 1; i <= 8; i++) {
        const bets = getDynamicBet(i, baseBetAmount); cumulative += bets.levelTotal;
        const nBetText = bets.nBet > 0 ? `₹${bets.nBet}, ₹${bets.nBet}` : `₹0 (Low Bal)`;
        chartMsg += `👉 <b>L${i}:</b> B/S: ₹${bets.bBet} | Nums: ${nBetText}\n   └ <i>Total: ₹${bets.levelTotal} | Cum: ₹${cumulative}</i>\n`;
    }
    bot.sendMessage(msg.chat.id, chartMsg, { parse_mode: 'HTML' }).catch(()=>{});
});
bot.onText(/\/stats/, (msg) => {
    let levelTrackerText = "";
    Object.keys(stats.levelHistoryTracker).sort((a,b) => a-b).forEach(lvl => { levelTrackerText += `👉 <b>Level ${lvl}:</b> ${stats.levelHistoryTracker[lvl]} बार पास\n`; });
    const statsMsg = `📊 <b>LIVE BOT ACCURACY</b> 📊\n\n🔥 <b>Signals:</b> ${stats.total}\n🎯 <b>JACKPOT WINS:</b> ${stats.jackpots} 🤑\n🌟 <b>Wins:</b> ${stats.wins} | 🤬 <b>Losses:</b> ${stats.losses}\n📈 <b>Win Rate:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n🎚️ <b>Max Level Reached:</b> L${stats.maxLevelReached}\n\n🏆 <b>LEVEL CLEARANCE:</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n${levelTrackerText || "अभी कोई डेटा नहीं है।"}`;
    bot.sendMessage(msg.chat.id, statsMsg, { parse_mode: 'HTML' }).catch(()=>{});
});
bot.onText(/\/level\s+(\d+)/, (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    baseBetAmount = parseFloat(match[1]);
    bot.sendMessage(msg.chat.id, `✅ <b>ADMIN ACTION:</b> Level 1 Base Bet Set to = ₹${baseBetAmount}`, { parse_mode: 'HTML' });
});

// 🔥 ANTI-CRASH SYSTEM (बोट को कभी मरने नहीं देगा)
process.on('uncaughtException', function (err) { console.error('⚠️ Uncaught Exception:', err); });
process.on('unhandledRejection', (reason, promise) => { console.error('⚠️ Unhandled Rejection:', reason); });

setInterval(monitorLoop, 5000);
console.log("🚀 Predator Ultra Bug-Fixed Bot Active...");

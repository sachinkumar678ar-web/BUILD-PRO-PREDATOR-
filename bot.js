const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
const TELEGRAM_BOT_TOKEN = '8760735795:AAE8BybKmYt8JyV4INOwAbV1ukYpj0Ag56E'; 
const CHANNEL_CHAT_ID = '-1003879763598'; 
const ADMIN_ID = '8358255492'; 
const RENDER_APP_URL = "https://build-pro-predator.onrender.com"; 

const API_ENDPOINT = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=15";

let history = []; 
let botLevel = 1; // 🔥 यह अब अनलिमिटेड जाएगा
let baseBetAmount = 10; 
let currentPrediction = null; 
let autoPostTimeout = null;
let isPollingReconnecting = false; 
let isBotActive = true; 
let midnightPinSent = false;
let consecutiveWins = 0;
let consecutiveLosses = 0;
let consecutiveJackpots = 0; 
let pendingData = { type: null, content: null }; 

// 🎨 Default Stickers & Messages
let stats = {
    total: 0, wins: 0, losses: 0, jackpots: 0, skips: 0,
    maxLevelReached: 1, levelHistoryTracker: {}, 
    hourlyData: {}, percentTracker: {},
    stickers: {
        win: 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA',
        win_2: 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA',
        win_3: 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA',
        win_4: 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA',
        win_5: 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA',
        loss: 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA',
        loss_2: 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA',
        loss_3: 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA',
        jackpot: 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE',
        jackpot_3: 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE',
        gm: 'CAACAgEAAxkBAAE...', gn: 'CAACAgEAAxkBAAE...'
    },
    messages: {
        win: '✅ <b>WIN SUCCESSFUL!</b> प्रॉफिट बुक करें!',
        win_2: '🔥 <b>2 BACK-TO-BACK WINS!</b>',
        win_3: '🔥 <b>3 BACK-TO-BACK WINS!</b>',
        win_4: '🔥 <b>4 BACK-TO-BACK WINS!</b>',
        win_5: '👑 <b>UNSTOPPABLE! 5 WINS IN A ROW!</b> 👑',
        loss: '❌ <b>LOSS!</b> कोई बात नहीं, लेवल बढ़ाएं! रिकवरी पक्की है।',
        loss_2: '⚠️ <b>2 LOSSES!</b> 3X अमाउंट लगाएँ।',
        loss_3: '🛑 <b>3+ LOSSES!</b> अनलिमिटेड बैकअप इस्तेमाल करें, विन होकर रहेगा!',
        jackpot: '🤑 <b>JACKPOT WIN (9X PROFIT)!</b> 🤑',
        jackpot_3: '🚀 <b>HISTORY CREATED! 3 BACK-TO-BACK JACKPOTS!</b> 🚀',
        gm: '🌅 <b>GOOD MORNING VIP FAMILY!</b> 🌅',
        gn: '🌙 <b>GOOD NIGHT VIP TEAM!</b> 🌙'
    }
};

if (fs.existsSync('./stats.json')) {
    try { 
        let loaded = JSON.parse(fs.readFileSync('./stats.json')); 
        stats = { ...stats, ...loaded };
        stats.stickers = { ...stats.stickers, ...(loaded.stickers || {}) };
        stats.messages = { ...stats.messages, ...(loaded.messages || {}) };
    } catch (e) {}
}
setInterval(() => { fs.writeFileSync('./stats.json', JSON.stringify(stats)); }, 5 * 60 * 1000); 

// ==========================================
// 🤖 BOT SETUP & SERVER
// ==========================================
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false, request: { agentOptions: { family: 4 } } });

bot.on('polling_error', (error) => {
    if (!isPollingReconnecting) {
        isPollingReconnecting = true;
        bot.stopPolling().then(() => { setTimeout(() => { bot.startPolling({ restart: true }).then(() => isPollingReconnecting = false).catch(() => isPollingReconnecting = false); }, 15000); }).catch(() => isPollingReconnecting = false);
    }
});
bot.deleteWebHook({ drop_pending_updates: true }).then(() => bot.startPolling({ restart: true }));

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('Predator Unlimited Safe Active!\n'); }).listen(PORT);
setInterval(() => { http.get(RENDER_APP_URL).on('error', (err) => {}); }, 5 * 60 * 1000); 

// ==========================================
// 🛠️ UTILITY & MATH FUNCTIONS
// ==========================================
function getISTTime() { return new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + (3600000 * 5.5)); }
function getISTTimeString() {
    let nd = getISTTime(), h = nd.getHours(), m = nd.getMinutes();
    let ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; m = m < 10 ? '0'+m : m;
    return (h < 10 ? '0'+h : h) + ':' + m + ' ' + ampm;
}
function getFancyType(type) { return type === "BIG" ? "🔵 BIGGG" : "🟡 SMALL"; }
function getRandomNumber(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// 🔥 UNLIMITED 3X MATH (कोई मैक्स लिमिट नहीं)
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
// 🧠 HYBRID AI PREDICTION (Unlimited Wait Safe)
// ==========================================
function generatePrediction(nextId) {
    if (history.length < 6) return; 

    let activeBadNumbers = getBadNumbers(history);
    let lastNum = history[0].number;
    
    let s0 = history[0].number >= 5 ? "B" : "S"; 
    let s1 = history[1].number >= 5 ? "B" : "S";
    let s2 = history[2].number >= 5 ? "B" : "S"; 
    let s3 = history[3].number >= 5 ? "B" : "S";
    
    let seq4 = s3+s2+s1+s0;
    let seq3 = s2+s1+s0;
    let seq2 = s1+s0;

    let finalSelection = "WAIT"; // डिफ़ॉल्ट WAIT (कचरा मार्केट में पैसा नहीं डुबाएगा)
    let baseWinChance = 0; 

    // 🛑 1. STRICT SKIP (खराब नंबर या चोपी मार्केट पर रुकेगा, लेवल होल्ड करेगा)
    if (activeBadNumbers.includes(lastNum) || [0, 5].includes(lastNum)) {
        finalSelection = "WAIT"; 
    } 
    else if (seq4 === "BSBS" || seq4 === "SBSB") {
        finalSelection = "WAIT"; 
    }
    // 🟢 2. HIGH PROBABILITY SETUPS (सिर्फ सेफ ट्रेंड पर दांव, कम से कम लॉस के लिए)
    else {
        if (seq2 === "BB") { finalSelection = "BIG"; baseWinChance = 85; } // ट्रेंड
        else if (seq2 === "SS") { finalSelection = "SMALL"; baseWinChance = 85; } // ट्रेंड
        else if (seq3 === "BBS") { finalSelection = "SMALL"; baseWinChance = 90; } // AABB पैटर्न
        else if (seq3 === "SSB") { finalSelection = "BIG"; baseWinChance = 90; } // AABB पैटर्न
        else if (seq4 === "BSSB") { finalSelection = "SMALL"; baseWinChance = 94; } // ट्रैप
        else if (seq4 === "SBBS") { finalSelection = "BIG"; baseWinChance = 94; } // ट्रैप
        else if (seq4 === "BBBB") { finalSelection = "BIG"; baseWinChance = 82; } // लॉन्ग ट्रेंड
        else if (seq4 === "SSSS") { finalSelection = "SMALL"; baseWinChance = 82; }
    }

    let finalNums = ["-", "-"];
    if (finalSelection === "BIG") finalNums = [7, 9];
    else if (finalSelection === "SMALL") finalNums = [1, 3];

    if (baseWinChance > 0) { baseWinChance = getRandomNumber(baseWinChance - 2, baseWinChance + 2); }

    currentPrediction = { issue: nextId, predType: finalSelection, nums: finalNums, level: botLevel, messageId: null, isChannelPosted: false, predTime: getISTTimeString(), chance: baseWinChance };
    
    clearTimeout(autoPostTimeout);
    autoPostTimeout = setTimeout(async () => {
        if (currentPrediction && !currentPrediction.isChannelPosted) await sendPredictionToChannel();
    }, 8000); 
}

async function sendPredictionToChannel() {
    if (!currentPrediction || currentPrediction.isChannelPosted) return;
    
    let msgContent = "";
    const bets = getDynamicBet(currentPrediction.level, baseBetAmount); // लेवल हमेशा होल्ड रहेगा

    if (currentPrediction.predType === "WAIT") {
        msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>PERIOD:</b> #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━\n🎯 <b>MY PRE:</b>   🌟skip🌟\n━━━━━━━━━━━━━━━━━━━━\n🔮 <b>N•PRED:</b>   🌐(skip)🌐\n━━━━━━━━━━━━━━━━━━━━\n🎲 <b>RUGLT:</b> WAIT\n━━━━━━━━━━━━━━━━━━━━\n💵 <b>B•BET:</b> ₹0 (SIZE)\n━━━━━━━━━━━━━━━━━━━━\n🪙 <b>N•BET:</b> ₹0 (EACH)\n━━━━━━━━━━━━━━━━━━━━\n📊 <b>LEVEL:</b> ${currentPrediction.level} (ON HOLD)\n━━━━━━━━━━━━━━━━━━━━`;
    } else {
        const nBetDisplay = bets.nBet > 0 ? `₹${bets.nBet} (EACH)` : `₹0 (LOW BAL)`;
        let chanceIcon = currentPrediction.chance >= 80 ? "🔥" : "⚡";

        msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>PERIOD:</b> #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━\n🎯 <b>MY PRE:</b> 🌟${getFancyType(currentPrediction.predType)}🌟\n━━━━━━━━━━━━━━━━━━━━\n🔮 <b>N•PRED:</b> 🌐(${currentPrediction.nums.join(',')})🌐\n━━━━━━━━━━━━━━━━━━━━\n🎲 <b>RUGLT:</b> WAIT\n━━━━━━━━━━━━━━━━━━━━\n💵 <b>B•BET:</b> ₹${bets.bBet} (SIZE)\n━━━━━━━━━━━━━━━━━━━━\n🪙 <b>N•BET:</b> ${nBetDisplay}\n━━━━━━━━━━━━━━━━━━━━\n📊 <b>LEVEL:</b> ${currentPrediction.level} (UNLIMITED)\n━━━━━━━━━━━━━━━━━━━━\n${chanceIcon} <b>WIN CHANCE: ${currentPrediction.chance}%</b>\n━━━━━━━━━━━━━━━━━━━━`;
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
    if (!currentPrediction) {
        if (history.length > 0) generatePrediction((BigInt(history[0].issue) + 1n).toString());
        return;
    }

    const resolvedOutcome = history.find(h => h.issue === currentPrediction.issue);

    if (resolvedOutcome) {
        const actualNum = resolvedOutcome.number;
        const actualSize = actualNum >= 5 ? "🔵 BIGGG" : "🟡 SMALL";
        let outcomeDisplay = `🌟${actualSize}(${actualNum})🌟`;
        
        if (currentPrediction.predType === "WAIT") {
            // 🔥 WAIT लॉजिक: लेवल नहीं बढ़ेगा, ना ही 1 पर जाएगा। यह बस होल्ड करेगा।
            stats.skips++;
            try { 
                let waitMsg = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>PERIOD:</b> #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━\n🎯 <b>MY PRE:</b>   🌟skip🌟\n━━━━━━━━━━━━━━━━━━━━\n🎲 <b>RUGLT:</b> ${outcomeDisplay}\n━━━━━━━━━━━━━━━━━━━━\n💵 <b>B•BET:</b> ₹0\n━━━━━━━━━━━━━━━━━━━━\n📊 <b>LEVEL:</b> ${currentPrediction.level} (ON HOLD)\n━━━━━━━━━━━━━━━━━━━━`;
                if(currentPrediction.messageId) { await bot.editMessageText(waitMsg, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); }
            } catch (e) {}
        } 
        else {
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
            let chanceIcon = currentPrediction.chance >= 80 ? "🔥" : "⚡";
            
            const editedMsg = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>PERIOD:</b> #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━\n🎯 <b>MY PRE:</b> 🌟${getFancyType(currentPrediction.predType)}🌟\n━━━━━━━━━━━━━━━━━━━━\n🎲 <b>RUGLT:</b> ${outcomeDisplay}\n━━━━━━━━━━━━━━━━━━━━\n💵 <b>B•BET:</b> ₹${bets.bBet} (SIZE)\n━━━━━━━━━━━━━━━━━━━━\n📊 <b>LEVEL:</b> ${currentPrediction.level}\n━━━━━━━━━━━━━━━━━━━━\n${chanceIcon} <b>WIN CHANCE: ${currentPrediction.chance}%</b>\n━━━━━━━━━━━━━━━━━━━━`;
            
            try { if(currentPrediction.messageId) { await bot.editMessageText(editedMsg, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } } catch (err) {}

            if (isWin || isJackpot) {
                // 🔥 WIN LOGIC: विन होने पर ही बोट लेवल 1 पर वापस जाएगा!
                stats.levelHistoryTracker[botLevel] = (stats.levelHistoryTracker[botLevel] || 0) + 1;
                stats.wins++;
                consecutiveLosses = 0; 
                consecutiveWins++;
                if (isJackpot) consecutiveJackpots++; else consecutiveJackpots = 0;

                let eKey = 'win';
                if(consecutiveWins === 2) eKey = 'win_2';
                else if(consecutiveWins === 3) eKey = 'win_3';
                else if(consecutiveWins === 4) eKey = 'win_4';
                else if(consecutiveWins >= 5) eKey = 'win_5';
                
                if(isJackpot) {
                    eKey = 'jackpot';
                    if(consecutiveJackpots >= 3) eKey = 'jackpot_3';
                }

                bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers[eKey] || stats.stickers.win).catch(()=>{});
                bot.sendMessage(CHANNEL_CHAT_ID, stats.messages[eKey] || stats.messages.win, { parse_mode: 'HTML' }).catch(()=>{});
                
                botLevel = 1; // विन हुआ, तो लेवल 1 पर आ गया
            } else {
                // 🔥 LOSS LOGIC: स्टॉप-लॉस हटा दिया गया है। बोट हारने पर सिर्फ लेवल बढ़ाएगा।
                stats.losses++;
                consecutiveWins = 0;
                consecutiveJackpots = 0; 
                consecutiveLosses++;
                
                let eKey = 'loss';
                if (consecutiveLosses === 2) eKey = 'loss_2';
                else if (consecutiveLosses >= 3) eKey = 'loss_3';

                botLevel++; // हारने पर लेवल अनलिमिटेड बढ़ता जाएगा 🚀
                
                bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers[eKey] || stats.stickers.loss).catch(()=>{});
                bot.sendMessage(CHANNEL_CHAT_ID, stats.messages[eKey] || stats.messages.loss, { parse_mode: 'HTML' }).catch(()=>{});
            }
            if (botLevel > stats.maxLevelReached) stats.maxLevelReached = botLevel;
        }
        
        currentPrediction = null; 
        const latestId = history[0].issue; 
        generatePrediction((BigInt(latestId) + 1n).toString());

    } else {
        if (history.length > 0 && BigInt(history[0].issue) > BigInt(currentPrediction.issue)) {
            currentPrediction = null;
            const latestId = history[0].issue;
            generatePrediction((BigInt(latestId) + 1n).toString());
        }
    }
}

// ==========================================
// 🎨 DYNAMIC ADMIN PANEL
// ==========================================
function getSettingKeyboard(prefix) {
    return { inline_keyboard: [
        [{text: '🟢 Win 1', callback_data: prefix+'win'}, {text: '🔴 Loss 1', callback_data: prefix+'loss'}],
        [{text: '🔥 Win 2', callback_data: prefix+'win_2'}, {text: '⚠️ Loss 2', callback_data: prefix+'loss_2'}],
        [{text: '🔥 Win 3', callback_data: prefix+'win_3'}, {text: '🛑 Loss 3+', callback_data: prefix+'loss_3'}],
        [{text: '🔥 Win 4', callback_data: prefix+'win_4'}, {text: '🚀 Win 5+', callback_data: prefix+'win_5'}],
        [{text: '🤑 Jackpot 1', callback_data: prefix+'jackpot'}, {text: '💸 Jackpot 3+', callback_data: prefix+'jackpot_3'}],
        [{text: '🌅 GM', callback_data: prefix+'gm'}, {text: '🌙 GN', callback_data: prefix+'gn'}]
    ]};
}

bot.on('message', (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID || (msg.text && msg.text.startsWith('/'))) return;

    if (msg.sticker) {
        pendingData = { type: 'sticker', content: msg.sticker.file_id };
        bot.sendMessage(msg.chat.id, "🎯 **STEPS:** आपने एक स्टीकर भेजा है। इसे किस इवेंट पर सेट करना है?", { reply_markup: getSettingKeyboard('set_') });
    } else if (msg.text) {
        pendingData = { type: 'message', content: msg.text };
        bot.sendMessage(msg.chat.id, "📝 **STEPS:** आपने एक मैसेज भेजा है। इसे किस इवेंट पर सेट करना है?", { reply_markup: getSettingKeyboard('set_') });
    }
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    if (query.data.startsWith('set_')) {
        let key = query.data.replace('set_', '');
        if (pendingData.type === 'sticker') {
            stats.stickers[key] = pendingData.content;
            bot.editMessageText(`✅ **SUCCESS!** नया स्टीकर **${key.toUpperCase()}** के लिए सेट हो गया।`, { chat_id: chatId, message_id: query.message.message_id });
        } else if (pendingData.type === 'message') {
            stats.messages[key] = pendingData.content;
            bot.editMessageText(`✅ **SUCCESS!** नया मैसेज **${key.toUpperCase()}** के लिए सेट हो गया।`, { chat_id: chatId, message_id: query.message.message_id });
        }
        pendingData = { type: null, content: null };
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

    let pctArray = Object.keys(stats.percentTracker).map(k => ({ key: k, data: stats.percentTracker[k] }));
    pctArray.sort((a, b) => a.data.l - b.data.l); 

    let pctText = "";
    pctArray.forEach(item => { pctText += `👉 <b>${item.key}:</b> 🔴 L: ${item.data.l} | 🟢 W: ${item.data.w} | 🤑 J: ${item.data.j}\n`; });

    const replyMsg = `👑 <b>ADMIN SUPER ANALYTICS</b> 👑\n\n🏆 <b>Golden Time (Last 24h):</b>\n${timeStr}\n\n📊 <b>Lowest Loss Percentage Tracker:</b>\n${pctText || "अभी डेटा बन रहा है..."}`;
    bot.sendMessage(msg.chat.id, replyMsg, { parse_mode: 'HTML' });
});

// ==========================================
// 🕛 MIDNIGHT LOGIC
// ==========================================
setInterval(() => {
    const now = getISTTime();
    
    if (now.getHours() === 8 && now.getMinutes() === 0 && stats.stickers.gm) {
        bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.gm).catch(()=>{});
        bot.sendMessage(CHANNEL_CHAT_ID, stats.messages.gm, { parse_mode: 'HTML' }).catch(()=>{});
    }
    if (now.getHours() === 23 && now.getMinutes() === 58 && stats.stickers.gn) {
        bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.gn).catch(()=>{});
        bot.sendMessage(CHANNEL_CHAT_ID, stats.messages.gn, { parse_mode: 'HTML' }).catch(()=>{});
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
            let pinMsg = `🏆 <b>GOLDEN TRADING HOUR</b> 🏆\n\nआज सबसे सुरक्षित दांव लगाने का समय है:\n⏰ <b>${timeStr}</b>\n⚡ <b>Win Rate:</b> ${Math.round(bestWinRate*100)}%\n\n<i>बोट 24 घंटे चालू है, इस समय एक्टिव रहें! 🚀</i>`;
            bot.sendMessage(CHANNEL_CHAT_ID, pinMsg, { parse_mode: 'HTML' }).then(sentMsg => {
                bot.pinChatMessage(CHANNEL_CHAT_ID, sentMsg.message_id).catch(()=>{});
            });
        }
        stats.hourlyData = {}; stats.percentTracker = {}; midnightPinSent = true;
    }
    if (now.getHours() === 0 && now.getMinutes() === 5) { midnightPinSent = false; }
}, 60000); 

// ==========================================
// 💬 USER COMMANDS
// ==========================================
bot.onText(/\/start/, (msg) => { bot.sendMessage(msg.chat.id, `🎉 <b>WELCOME TO PREDATOR VIP!</b> 🎉\n\n👉 /stats - लाइव एक्यूरेसी\n👉 /chart - 3X अनलिमिटेड चार्ट`, { parse_mode: 'HTML' }).catch(()=>{}); });
bot.onText(/\/chart/, (msg) => {
    let chartMsg = `📊 <b>UNLIMITED 3X CUMULATIVE CHART (UP TO L10)</b> 📊\n💰 <b>Base Level 1 Bet:</b> ₹${baseBetAmount}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
    let cumulative = 0;
    for(let i = 1; i <= 10; i++) {
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

// 🔥 ANTI-CRASH
process.on('uncaughtException', function (err) { console.error('⚠️ Exception:', err); });
process.on('unhandledRejection', (reason) => { console.error('⚠️ Rejection:', reason); });

setInterval(monitorLoop, 5000);
console.log("🚀 Predator Unlimited Safe Bot Active...");

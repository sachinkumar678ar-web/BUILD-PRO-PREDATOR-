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
const TELEGRAM_CHANNEL_ID = "https://t.me/BULIDPRO";

const API_ENDPOINT = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=50";

let history = []; 
let botLevel = 1;
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

const defaultStickers = {
    win: 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA',
    win_2: 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA',
    win_3: 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA',
    win_4: 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA',
    win_5: 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA',
    win_6: 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA', 
    loss: 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA',
    loss_2: 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA',
    loss_3: 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA',
    loss_4: 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA',
    loss_5: 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA',
    loss_6: 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA', 
    jackpot: 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE',
    jackpot_2: 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE',
    jackpot_3: 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE',
    jackpot_4: 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE',
    jackpot_5: 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE',
    jackpot_6: 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE', 
    gm: 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA', 
    gn: 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA'
};

const defaultMessages = {
    win: '✅ <b>WIN SUCCESSFUL!</b> प्रॉफिट बुक करें!',
    win_2: '🔥 <b>2 BACK-TO-BACK WINS!</b>',
    win_3: '🔥 <b>3 BACK-TO-BACK WINS!</b>',
    win_4: '🔥 <b>4 BACK-TO-BACK WINS!</b>',
    win_5: '👑 <b>5 WINS IN A ROW!</b>',
    win_6: '🚀 <b>GOD MODE! 6+ WINS IN A ROW!</b>',
    loss: '❌ <b>LOSS!</b> लेवल बढ़ाया गया है।',
    loss_2: '⚠️ <b>2 LOSSES!</b> 3X अमाउंट लगाएँ।',
    loss_3: '🛑 <b>3 LOSSES!</b> 9X अमाउंट लगाएँ।',
    loss_4: '🛑 <b>4 LOSSES!</b> 27X अमाउंट लगाएँ।',
    loss_5: '🛑 <b>5 LOSSES!</b> 81X अमाउंट लगाएँ।',
    loss_6: '⛔ <b>EXTREME HIGH RISK (6+ LOSS)!</b>',
    jackpot: '🤑 <b>JACKPOT WIN (9X PROFIT)!</b> 🤑',
    jackpot_2: '💣 <b>2 BACK-TO-BACK JACKPOTS!</b>',
    jackpot_3: '🚀 <b>3 BACK-TO-BACK JACKPOTS!</b>',
    jackpot_4: '🔥 <b>4 BACK-TO-BACK JACKPOTS!</b>',
    jackpot_5: '👑 <b>5 BACK-TO-BACK JACKPOTS!</b>',
    jackpot_6: '🤯 <b>UNBELIEVABLE! 6+ JACKPOTS!</b>',
    gm: `🌅 <b>GOOD MORNING VIP FAMILY!</b> 🌅\n${TELEGRAM_CHANNEL_ID}`,
    gn: `🌙 <b>GOOD NIGHT VIP TEAM!</b> 🌙\n${TELEGRAM_CHANNEL_ID}`
};

let stats = {
    total: 0, wins: 0, losses: 0, jackpots: 0,
    maxLevelReached: 1, levelHistoryTracker: {}, 
    hourlyData: {}, rollingHourlyData: {}, percentTracker: {}
};

if (fs.existsSync('./stats.json')) {
    try { 
        let loaded = JSON.parse(fs.readFileSync('./stats.json')); 
        stats = { ...stats, ...loaded };
        stats.stickers = { ...defaultStickers, ...(loaded.stickers || {}) };
        stats.messages = { ...defaultMessages, ...(loaded.messages || {}) };
        stats.rollingHourlyData = loaded.rollingHourlyData || {}; 
    } catch (e) {}
} else {
    stats.stickers = { ...defaultStickers };
    stats.messages = { ...defaultMessages };
}
setInterval(() => { fs.writeFileSync('./stats.json', JSON.stringify(stats)); }, 5 * 60 * 1000); 

// ==========================================
// 🤖 BOT SETUP & SERVER 
// ==========================================
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false, request: { agentOptions: { family: 4 } } });
bot.on('polling_error', (error) => {
    if (String(error).includes('409 Conflict') && !isPollingReconnecting) {
        isPollingReconnecting = true;
        bot.stopPolling().then(() => { setTimeout(() => { bot.startPolling({ restart: true }).then(() => isPollingReconnecting = false).catch(() => isPollingReconnecting = false); }, 15000); }).catch(() => isPollingReconnecting = false);
    }
});
bot.deleteWebHook({ drop_pending_updates: true }).then(() => bot.startPolling({ restart: true }));
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('Predator 100 VVI Formulas Active!\n'); }).listen(PORT);
setInterval(() => { http.get(RENDER_APP_URL).on('error', (err) => {}); }, 5 * 60 * 1000); 

// ==========================================
// 🛠️ UTILITY FUNCTIONS
// ==========================================
function getISTTime() { return new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + (3600000 * 5.5)); }
function getISTTimeString() {
    let nd = getISTTime(), h = nd.getHours(), m = nd.getMinutes();
    let ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; m = m < 10 ? '0'+m : m;
    return (h < 10 ? '0'+h : h) + ':' + m + ' ' + ampm;
}
function getFancyType(type) { return type === "BIG" ? "🔵 BIGGG" : "🟡 SMALL"; }
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

// 🔥 HOT NUMBERS LOGIC (सिर्फ 1 हॉट नंबर जैकपॉट के लिए)
function getHotNumbers(historyData, type) {
    let counts = {};
    historyData.forEach(h => {
        if (type === "BIG" && [6,7,8,9].includes(h.number)) counts[h.number] = (counts[h.number] || 0) + 1;
        if (type === "SMALL" && [1,2,3,4].includes(h.number)) counts[h.number] = (counts[h.number] || 0) + 1;
    });
    let sorted = Object.keys(counts).sort((a,b) => counts[b] - counts[a]);
    if (sorted.length >= 1) return [parseInt(sorted[0])]; 
    return type === "BIG" ? [[6,7,8,9][getRandomNumber(0, 3)]] : [[1,2,3,4][getRandomNumber(0, 3)]]; 
}

// ==========================================
// 🧠 100 VVI RULES & FORMULA ENGINE 🔥
// ==========================================
function generatePrediction(nextId) {
    if (history.length < 30) return; 

    let votes = { BIG: 0, SMALL: 0 };
    let addV = (v) => { if (v === "BIG") votes.BIG++; else votes.SMALL++; };

    let n0 = history[0].number; let n1 = history[1].number; let n2 = history[2].number;
    let n3 = history[3].number; let n4 = history[4].number; let n5 = history[5].number;
    let issueDigit = parseInt(history[0].issue.slice(-1));

    let seq = "";
    for(let i=0; i<30; i++) { seq += (history[i].number >= 5 ? "B" : "S"); }

    // 🧮 GROUP 1: ISSUE & MATH FORMULAS (20 Rules)
    addV((issueDigit + n0) % 2 === 0 ? "SMALL" : "BIG"); // Rule 1
    addV((issueDigit + n1) % 2 === 0 ? "SMALL" : "BIG"); // Rule 2
    addV(Math.abs(n0 - n1) % 2 === 0 ? "SMALL" : "BIG"); // Rule 3 (Diff)
    addV((n0 + n1 + n2) % 2 === 0 ? "SMALL" : "BIG"); // Rule 4 (Sum 3)
    addV((n0 + n1 + n2 + n3 + n4) % 2 === 0 ? "SMALL" : "BIG"); // Rule 5 (Sum 5)
    addV((issueDigit * n0) % 2 === 0 ? "SMALL" : "BIG"); // Rule 6 (Multiply)
    addV(n0 > n1 ? "BIG" : "SMALL"); // Rule 7 (Momentum)
    addV(n1 > n2 ? "BIG" : "SMALL"); // Rule 8
    addV((Math.abs(n0 - n2) + issueDigit) % 2 === 0 ? "SMALL" : "BIG"); // Rule 9
    addV((n0 + 3) % 2 === 0 ? "SMALL" : "BIG"); // Rule 10 (Golden Ratio +3)
    // 10 more variations of Math Parity
    for(let i=11; i<=20; i++) { addV((history[i%10].number + i) % 2 === 0 ? "SMALL" : "BIG"); }

    // 🔢 GROUP 2: NUMBER FOLLOWING ASTROLOGY (20 Rules)
    let rule21 = "BIG"; if([1,3,7].includes(n0)) rule21 = "SMALL"; addV(rule21);
    let rule22 = "SMALL"; if([0,2,8].includes(n0)) rule22 = "BIG"; addV(rule22);
    let rule23 = "BIG"; if([4,9].includes(n0)) rule23 = "SMALL"; addV(rule23);
    let rule24 = n0 === 8 ? "SMALL" : "BIG"; addV(rule24);
    let rule25 = n0 === 1 ? "BIG" : "SMALL"; addV(rule25);
    let rule26 = n0 === n1 ? (n0 >= 5 ? "SMALL" : "BIG") : (n0 >= 5 ? "BIG" : "SMALL"); addV(rule26); // Duplicate break
    let rule27 = (n0+1 === n1 || n0-1 === n1) ? "BIG" : "SMALL"; addV(rule27); // Neighbors
    let rule28 = [0,5].includes(n0) ? (n1 >= 5 ? "SMALL" : "BIG") : "BIG"; addV(rule28); // 0/5 Reverse
    let rule29 = [0,5].includes(n1) ? (n0 >= 5 ? "SMALL" : "BIG") : "SMALL"; addV(rule29); 
    let rule30 = n0 === 9 ? "SMALL" : "BIG"; addV(rule30);
    // 10 more specific number triggers
    for(let i=31; i<=40; i++) { addV(history[i%5].number >= 5 ? "BIG" : "SMALL"); }

    // 🧩 GROUP 3: ACTUAL PATTERN MATCHING (20 Rules)
    addV(seq.startsWith("BBBB") ? "SMALL" : "BIG"); // Break 4
    addV(seq.startsWith("SSSS") ? "BIG" : "SMALL"); // Break 4
    addV(seq.startsWith("BSBS") ? "BIG" : "SMALL"); // Continue Alternating
    addV(seq.startsWith("SBSB") ? "SMALL" : "BIG"); 
    addV(seq.startsWith("BBS") ? "SMALL" : "BIG"); // AABB setup
    addV(seq.startsWith("SSB") ? "BIG" : "SMALL"); 
    addV(seq.startsWith("BSSB") ? "SMALL" : "BIG"); // Sandwich Break
    addV(seq.startsWith("SBBS") ? "BIG" : "SMALL"); 
    addV(seq.startsWith("BBSS") ? "BIG" : "SMALL"); // Two-Two
    addV(seq.startsWith("SSBB") ? "SMALL" : "BIG"); 
    addV(seq.startsWith("BBBBS") ? "SMALL" : "BIG"); // Trap recovery
    addV(seq.startsWith("SSSSB") ? "BIG" : "SMALL");
    addV(seq.startsWith("BBSBBS") ? "SMALL" : "BIG");
    addV(seq.startsWith("SSBSSB") ? "BIG" : "SMALL");
    addV(seq.startsWith("BSB") ? "SMALL" : "BIG"); // 1-1-1
    addV(seq.startsWith("SBS") ? "BIG" : "SMALL"); 
    addV(seq.startsWith("BBBBBB") ? "BIG" : "SMALL"); // Ride Dragon
    addV(seq.startsWith("SSSSSS") ? "SMALL" : "BIG"); // Ride Dragon
    addV(seq.substring(1,5) === "BBBB" ? "SMALL" : "BIG"); // Delayed break
    addV(seq.substring(1,5) === "SSSS" ? "BIG" : "SMALL");

    // 🪞 GROUP 4: ADVANCED MIRRORING (20 Rules)
    addV(seq[2] === "B" ? "BIG" : "SMALL"); // 2-step mirror
    addV(seq[3] === "B" ? "BIG" : "SMALL"); // 3-step mirror
    addV(seq[4] === "B" ? "BIG" : "SMALL"); 
    addV(seq[5] === "B" ? "BIG" : "SMALL");
    addV(seq[6] === "B" ? "BIG" : "SMALL");
    addV(seq[2] === "B" ? "SMALL" : "BIG"); // 2-step reverse
    addV(seq[3] === "B" ? "SMALL" : "BIG"); // 3-step reverse
    addV(seq[4] === "B" ? "SMALL" : "BIG");
    addV(seq[5] === "B" ? "SMALL" : "BIG");
    addV(seq[6] === "B" ? "SMALL" : "BIG");
    // 10 more dynamic mirrors based on dominance
    let dom = seq.slice(0, 10).split('B').length >= 5 ? "BIG" : "SMALL";
    for(let i=71; i<=80; i++) { addV(dom); }

    // 📊 GROUP 5: FREQUENCY & ALGORITHMIC DOMINANCE (20 Rules)
    addV(seq.slice(0, 5).split('B').length >= 3 ? "BIG" : "SMALL"); // Last 5 dom
    addV(seq.slice(0, 7).split('B').length >= 4 ? "BIG" : "SMALL"); // Last 7 dom
    addV(seq.slice(0, 9).split('B').length >= 5 ? "BIG" : "SMALL"); // Last 9 dom
    addV(seq.slice(0, 15).split('B').length >= 8 ? "BIG" : "SMALL"); // Last 15 dom
    addV(seq.slice(0, 20).split('B').length >= 10 ? "BIG" : "SMALL"); // Last 20 dom
    // Opposite Dominance (Reversal theory)
    addV(seq.slice(0, 5).split('B').length >= 3 ? "SMALL" : "BIG");
    addV(seq.slice(0, 7).split('B').length >= 4 ? "SMALL" : "BIG");
    // Deep Math Averages
    let avg = (n0+n1+n2+n3+n4+n5)/6;
    addV(avg >= 4.5 ? "BIG" : "SMALL");
    addV(avg < 4.5 ? "SMALL" : "BIG");
    // Final filler rules to complete 100 perfectly
    for(let i=90; i<=100; i++) { addV((n0 * i) % 2 === 0 ? "SMALL" : "BIG"); }

    // 🏆 DECISION BY 100 FORMULAS
    let finalSelection = votes.BIG > votes.SMALL ? "BIG" : "SMALL";
    let winningVotes = Math.max(votes.BIG, votes.SMALL); 
    
    // 💯 PERCENTAGE = Exact match out of 100 rules
    let exactMatchPercentage = winningVotes;
    if (exactMatchPercentage < 51) exactMatchPercentage = 51;
    if (exactMatchPercentage > 99) exactMatchPercentage = 99;

    // 🔥 HOT NUMBER PREDICTION (सिर्फ 1 नंबर)
    let finalNumArray = getHotNumbers(history.slice(0, 30), finalSelection);

    currentPrediction = { issue: nextId, predType: finalSelection, nums: finalNumArray, level: botLevel, messageId: null, isChannelPosted: false, predTime: getISTTimeString(), chance: exactMatchPercentage };
    
    clearTimeout(autoPostTimeout);
    autoPostTimeout = setTimeout(async () => {
        if (currentPrediction && !currentPrediction.isChannelPosted) await sendPredictionToChannel();
    }, 8000); 
}

async function sendPredictionToChannel() {
    if (!currentPrediction || currentPrediction.isChannelPosted) return;
    
    const bets = getDynamicBet(currentPrediction.level, baseBetAmount);
    const nBetDisplay = bets.nBet > 0 ? `₹${bets.nBet} (SINGLE)` : `₹0 (LOW BAL)`;
    let chanceIcon = currentPrediction.chance >= 75 ? "🔥" : (currentPrediction.chance >= 60 ? "⚡" : "⚠️");

    let msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>PERIOD:</b> #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━\n🎯 <b>MY PRE:</b> 🌟${getFancyType(currentPrediction.predType)}🌟\n━━━━━━━━━━━━━━━━━━━━\n🔮 <b>N•PRED:</b> 🌐(${currentPrediction.nums[0]})🌐\n━━━━━━━━━━━━━━━━━━━━\n🎲 <b>RUGLT:</b> WAIT\n━━━━━━━━━━━━━━━━━━━━\n💵 <b>B•BET:</b> ₹${bets.bBet} (SIZE)\n━━━━━━━━━━━━━━━━━━━━\n🪙 <b>N•BET:</b> ${nBetDisplay}\n━━━━━━━━━━━━━━━━━━━━\n📊 <b>LEVEL:</b> ${currentPrediction.level} (UNLIMITED)\n━━━━━━━━━━━━━━━━━━━━\n${chanceIcon} <b>WIN CHANCE: ${currentPrediction.chance}%</b>\n━━━━━━━━━━━━━━━━━━━━`;
    
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
        if(!stats.hourlyData[currentHour]) stats.hourlyData[currentHour] = { wins: 0, total: 0, maxLevel: 1 };
        stats.hourlyData[currentHour].total++;
        if(isWin || isJackpot) stats.hourlyData[currentHour].wins++;
        if(botLevel > stats.hourlyData[currentHour].maxLevel) stats.hourlyData[currentHour].maxLevel = botLevel; 

        const bets = getDynamicBet(currentPrediction.level, baseBetAmount);
        let chanceIcon = currentPrediction.chance >= 75 ? "🔥" : (currentPrediction.chance >= 60 ? "⚡" : "⚠️");
        
        const editedMsg = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>PERIOD:</b> #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━\n🎯 <b>MY PRE:</b> 🌟${getFancyType(currentPrediction.predType)}🌟\n━━━━━━━━━━━━━━━━━━━━\n🎲 <b>RUGLT:</b> ${outcomeDisplay}\n━━━━━━━━━━━━━━━━━━━━\n💵 <b>B•BET:</b> ₹${bets.bBet} (SIZE)\n━━━━━━━━━━━━━━━━━━━━\n📊 <b>LEVEL:</b> ${currentPrediction.level}\n━━━━━━━━━━━━━━━━━━━━\n${chanceIcon} <b>WIN CHANCE: ${currentPrediction.chance}%</b>\n━━━━━━━━━━━━━━━━━━━━`;
        
        try { 
            if(currentPrediction.messageId) {
                await bot.editMessageText(editedMsg, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); 
            }
        } catch (err) {}

        if (isWin || isJackpot) {
            stats.levelHistoryTracker[botLevel] = (stats.levelHistoryTracker[botLevel] || 0) + 1;
            stats.wins++;
            consecutiveLosses = 0; 
            consecutiveWins++;
            
            let eKey = 'win';
            if(consecutiveWins === 2) eKey = 'win_2';
            else if(consecutiveWins === 3) eKey = 'win_3';
            else if(consecutiveWins === 4) eKey = 'win_4';
            else if(consecutiveWins === 5) eKey = 'win_5';
            else if(consecutiveWins >= 6) eKey = 'win_6';
            
            if(isJackpot) {
                stats.jackpots++;
                consecutiveJackpots++;
                eKey = 'jackpot';
                if(consecutiveJackpots === 2) eKey = 'jackpot_2';
                else if(consecutiveJackpots === 3) eKey = 'jackpot_3';
                else if(consecutiveJackpots === 4) eKey = 'jackpot_4';
                else if(consecutiveJackpots === 5) eKey = 'jackpot_5';
                else if(consecutiveJackpots >= 6) eKey = 'jackpot_6';
            } else {
                consecutiveJackpots = 0; 
            }

            bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers[eKey] || stats.stickers.win).catch(()=>{});
            if (stats.messages[eKey]) bot.sendMessage(CHANNEL_CHAT_ID, stats.messages[eKey], { parse_mode: 'HTML' }).catch(()=>{});

            botLevel = 1; 
        } else {
            stats.losses++;
            consecutiveWins = 0;
            consecutiveJackpots = 0; 
            consecutiveLosses++;
            
            let eKey = 'loss';
            if (consecutiveLosses === 2) eKey = 'loss_2';
            else if (consecutiveLosses === 3) eKey = 'loss_3';
            else if (consecutiveLosses === 4) eKey = 'loss_4';
            else if (consecutiveLosses === 5) eKey = 'loss_5';
            else if (consecutiveLosses >= 6) eKey = 'loss_6';

            botLevel++; 
            
            bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers[eKey] || stats.stickers.loss).catch(()=>{});
            if (stats.messages[eKey]) bot.sendMessage(CHANNEL_CHAT_ID, stats.messages[eKey], { parse_mode: 'HTML' }).catch(()=>{});
        }
        if (botLevel > stats.maxLevelReached) stats.maxLevelReached = botLevel;
        
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
// 🎨 DYNAMIC ADMIN PANEL & STICKER ID SYSTEM
// ==========================================
function getSettingKeyboard(prefix) {
    return { inline_keyboard: [
        [{text: '🟢 Win 1', callback_data: prefix+'win'}, {text: '🔴 Loss 1', callback_data: prefix+'loss'}],
        [{text: '🟢 Win 2', callback_data: prefix+'win_2'}, {text: '🔴 Loss 2', callback_data: prefix+'loss_2'}],
        [{text: '🟢 Win 3', callback_data: prefix+'win_3'}, {text: '🔴 Loss 3', callback_data: prefix+'loss_3'}],
        [{text: '🟢 Win 4', callback_data: prefix+'win_4'}, {text: '🔴 Loss 4', callback_data: prefix+'loss_4'}],
        [{text: '🟢 Win 5', callback_data: prefix+'win_5'}, {text: '🔴 Loss 5', callback_data: prefix+'loss_5'}],
        [{text: '🚀 Win 6+', callback_data: prefix+'win_6'}, {text: '⛔ Loss 6+', callback_data: prefix+'loss_6'}],
        [{text: '🤑 Jackpot 1', callback_data: prefix+'jackpot'}, {text: '🤑 Jackpot 2', callback_data: prefix+'jackpot_2'}],
        [{text: '🤑 Jackpot 3', callback_data: prefix+'jackpot_3'}, {text: '🤑 Jackpot 4', callback_data: prefix+'jackpot_4'}],
        [{text: '🤑 Jackpot 5', callback_data: prefix+'jackpot_5'}, {text: '🤯 Jackpot 6+', callback_data: prefix+'jackpot_6'}],
        [{text: '🌅 GM', callback_data: prefix+'gm'}, {text: '🌙 GN', callback_data: prefix+'gn'}]
    ]};
}

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const isCmd = msg.text && msg.text.startsWith('/');

    if (msg.sticker) {
        let sId = msg.sticker.file_id;
        bot.sendMessage(chatId, `🏷️ **Here is your Sticker ID:**\n\`${sId}\`\n\n*(Touch to copy)*`, { parse_mode: 'Markdown' });
        
        if (msg.from.id.toString() === ADMIN_ID) {
            pendingData = { type: 'sticker', content: sId };
            bot.sendMessage(chatId, "🎯 **ADMIN STEPS:** आप इस स्टीकर को किस इवेंट पर सेट करना चाहते हैं?", { reply_markup: getSettingKeyboard('set_') });
        }
        return;
    }

    if (msg.from.id.toString() === ADMIN_ID && !isCmd && msg.text) {
        pendingData = { type: 'message', content: msg.text };
        bot.sendMessage(chatId, "📝 **ADMIN STEPS:** आपने एक मैसेज भेजा है। इसे किस इवेंट पर सेट करना है?", { reply_markup: getSettingKeyboard('set_') });
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
// 👑 ADMIN COMMAND: CHECK SAVED STICKERS
// ==========================================
bot.onText(/\/stickers/, (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    let text = "🎨 **ALL SAVED STICKER IDs (20 SLOTS):**\n\n";
    for (const [key, value] of Object.entries(stats.stickers)) {
        text += `👉 **${key.toUpperCase()}:** \n\`${value}\`\n\n`;
    }
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// ==========================================
// 📊 5-DAY HOURLY ANALYTICS COMMAND 
// ==========================================
bot.onText(/\/analytics/, (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    
    let aggregatedHourly = [];
    for(let h=0; h<24; h++) {
        let totalW = 0; let totalT = 0; let maxL = 1;
        if(stats.rollingHourlyData[h]) {
            stats.rollingHourlyData[h].forEach(d => {
                totalW += d.wins || 0; totalT += d.total || 0; 
                if(d.maxLevel > maxL) maxL = d.maxLevel;
            });
        }
        if(stats.hourlyData[h]) {
            totalW += stats.hourlyData[h].wins || 0;
            totalT += stats.hourlyData[h].total || 0;
            if(stats.hourlyData[h].maxLevel > maxL) maxL = stats.hourlyData[h].maxLevel;
        }

        if(totalT > 0) {
            let ampm1 = h >= 12 ? 'PM' : 'AM'; let h1 = h % 12 || 12;
            let nextH = (h + 1) % 24; let ampm2 = nextH >= 12 ? 'PM' : 'AM'; let h2 = nextH % 12 || 12;
            let timeStr = `${h1 < 10 ? '0'+h1 : h1}:00 ${ampm1} - ${h2 < 10 ? '0'+h2 : h2}:00 ${ampm2}`;
            aggregatedHourly.push({ hour: h, timeStr: timeStr, rate: totalW/totalT, wins: totalW, total: totalT, maxLevel: maxL });
        }
    }
    
    let bestTimes = [...aggregatedHourly].sort((a,b) => {
        if(b.rate === a.rate) return a.maxLevel - b.maxLevel;
        return b.rate - a.rate;
    }).slice(0, 5); 
    
    let bestText = "";
    bestTimes.forEach((item, index) => {
        let icon = index === 0 ? "🥇" : (index === 1 ? "🥈" : (index === 2 ? "🥉" : "✅"));
        bestText += `${icon} <b>${item.timeStr}</b> | ${Math.round(item.rate*100)}% Win | Max Level: <b>L${item.maxLevel}</b>\n`;
    });

    let worstTimes = [...aggregatedHourly].sort((a,b) => {
        if(b.maxLevel === a.maxLevel) return a.rate - b.rate;
        return b.maxLevel - a.maxLevel;
    }).slice(0, 5); 
    
    let worstText = "";
    worstTimes.forEach(item => {
        worstText += `⛔ <b>${item.timeStr}</b> | Max Level Hit: <b>L${item.maxLevel}</b> | ${Math.round(item.rate*100)}% Win\n`;
    });

    if (bestText === "") bestText = "अभी कोई डेटा नहीं है।";
    if (worstText === "") worstText = "अभी कोई डेटा नहीं है।";

    const replyMsg = `👑 <b>5-DAY MASTER ANALYTICS</b> 👑\n\n✅ <b>BEST TIMES TO TRADE (Low Risk):</b>\n${bestText}\n\n⛔ <b>DANGER ZONES (High Loss Steaks):</b>\n<i>(इन समयों पर बोट को पॉज़ रखें या लो बेट करें)</i>\n${worstText}`;
    bot.sendMessage(msg.chat.id, replyMsg, { parse_mode: 'HTML' });
});

// ==========================================
// 🕛 DAILY RESET & 5-DAY ROLLING UPDATE
// ==========================================
setInterval(() => {
    const now = getISTTime();
    
    if (now.getHours() === 8 && now.getMinutes() === 0 && stats.stickers.gm) {
        bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.gm).catch(()=>{});
        if (stats.messages.gm) bot.sendMessage(CHANNEL_CHAT_ID, stats.messages.gm, { parse_mode: 'HTML' }).catch(()=>{});
    }
    if (now.getHours() === 23 && now.getMinutes() === 58 && stats.stickers.gn) {
        bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.gn).catch(()=>{});
        if (stats.messages.gn) bot.sendMessage(CHANNEL_CHAT_ID, stats.messages.gn, { parse_mode: 'HTML' }).catch(()=>{});
    }

    if (now.getHours() === 0 && now.getMinutes() === 0 && !midnightPinSent) {
        for(let h=0; h<24; h++) {
            if(!stats.rollingHourlyData[h]) stats.rollingHourlyData[h] = [];
            let dataToSave = stats.hourlyData[h] || { wins: 0, total: 0, maxLevel: 1 };
            stats.rollingHourlyData[h].push(dataToSave);
            if(stats.rollingHourlyData[h].length > 5) stats.rollingHourlyData[h].shift(); 
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
bot.onText(/\/start/, (msg) => { bot.sendMessage(msg.chat.id, `🎉 <b>WELCOME TO PREDATOR VIP!</b> 🎉\n\n👉 /stats - लाइव एक्यूरेसी\n👉 /chart - 3X अनलिमिटेड चार्ट`, { parse_mode: 'HTML' }).catch(()=>{}); });
bot.onText(/\/chart/, (msg) => {
    let chartMsg = `📊 <b>UNLIMITED 3X CUMULATIVE CHART (UP TO L10)</b> 📊\n💰 <b>Base Level 1 Bet:</b> ₹${baseBetAmount}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
    let cumulative = 0;
    for(let i = 1; i <= 10; i++) { 
        const bets = getDynamicBet(i, baseBetAmount); cumulative += bets.levelTotal;
        const nBetText = bets.nBet > 0 ? `₹${bets.nBet} (SINGLE)` : `₹0 (Low Bal)`;
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
console.log("🚀 The Master 100-Formula VIP Bot Active...");

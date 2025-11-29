const WebSocket = require('ws');
const mineflayer = require('mineflayer');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Use Railway's port or default to 8080
const PORT = process.env.PORT || 8080;

// Bot accounts - all 50
const accounts = [
    "kmyq20700", "nzhj60086", "fspz88256", "etiew29872", "lerey07058",
    "dpyww21385", "nwlic69698", "kfdh76242", "keme41973", "gtomu36792",
    "gjth41639", "layt14206", "yflju08739", "gisz21394", "numv88981",
    "fugs99967", "jbjfd54500", "rkli78660", "mmp08961", "tyed67776",
    "anv70605", "jizvh44817", "blur78987", "slsx80865", "vnt06756",
    "lvlv20278", "lpghg52113", "ktjb75635", "fqb96501", "imfdl63351",
    "gedmh93153", "bgub63864", "tdg09805", "higwp33380", "tpdr45264",
    "dkwc51820", "ixf05608", "xbari85549", "tzr37381", "wtvg67482",
    "tml18129", "zebsx01272", "xbw17141", "ahj11848", "vhykv06965",
    "pqym34099", "unk33373", "bnghq49924", "qdcpm41716", "xycg80877"
];

const activeBots = new Map();
const botStatuses = new Map();

// Initialize bot statuses
accounts.forEach(username => {
    botStatuses.set(username, {
        status: 'offline',
        currentServer: 'unknown',
        username: username
    });
});

// Create HTTP server
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/web-interface.html') {
        fs.readFile(path.join(__dirname, 'web-interface.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading page');
            } else {
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end(data);
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({
    server,
    clientTracking: true,
    perMessageDeflate: false
});

const clients = new Set();

wss.on('connection', function connection(ws) {
    console.log('🔌 Client connected to control panel');
    clients.add(ws);

    sendAllBotStatuses(ws);

    ws.on('message', function incoming(data) {
        try {
            const command = JSON.parse(data.toString());
            console.log('📨 Received command:', command.command, 'for bot:', command.username || 'N/A');
            handleCommand(ws, command);
        } catch (error) {
            console.error('❌ Error parsing command:', error);
        }
    });

    ws.on('close', function() {
        console.log('🔌 Client disconnected from control panel');
        clients.delete(ws);
    });

    ws.on('error', function(error) {
        console.error('❌ WebSocket error:', error.message);
        clients.delete(ws);
    });
});

function sendAllBotStatuses(ws) {
    const statuses = [];
    botStatuses.forEach((status, username) => {
        statuses.push({
            username: username,
            status: status.status,
            currentServer: status.currentServer
        });
    });

    const message = JSON.stringify({
        type: 'bot_statuses',
        bots: statuses
    });

    safeSend(ws, message);
}

function safeSend(ws, message) {
    try {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    } catch (error) {
        console.error('❌ Error sending message:', error.message);
    }
}

function sendToAllClients(message) {
    clients.forEach(function each(client) {
        safeSend(client, message);
    });
}

function safeBotCleanup(bot) {
    try {
        if (bot.loginInterval) clearInterval(bot.loginInterval);
        if (bot.keepAliveInterval) clearInterval(bot.keepAliveInterval);
        if (bot.serverSwitchTimeout) clearTimeout(bot.serverSwitchTimeout);
        if (bot.survivalInterval) clearInterval(bot.survivalInterval);
        if (bot.movementTimeout) clearTimeout(bot.movementTimeout);
        if (bot.entity) {
            bot.clearControlStates();
            bot.quit();
        }
    } catch (error) {
        console.log('❌ Cleanup error:', error.message);
    }
}

function handleCommand(ws, command) {
    const { command: cmd, username, server, port, password, message, count } = command;

    console.log('🔄 Handling command:', cmd, 'message:', message);

    switch (cmd) {
        case 'connect':
            connectBot(ws, username, server, port, password);
            break;
        case 'disconnect':
            disconnectBot(username);
            break;
        case 'chat':
            sendChat(username, message);
            break;
        case 'get_bot_statuses':
            sendAllBotStatuses(ws);
            break;
        case 'bulk_connect':
            bulkConnectBots(ws, count, server, port, password);
            break;
        case 'chat_all':
            chatAllBots(message);
            break;
        case 'survival_all':
            sendAllToSurvival();
            break;
        case 'tpa_all':
            tpaToOwner();
            break;
        case 'drop_tripwire_all':
            dropTripwireHooks();
            break;
        default:
            console.log('❌ Unknown command:', cmd);
    }
}

function chatAllBots(message) {
    console.log(`💬 Sending chat to all online bots: "${message}"`);
    let sentCount = 0;

    activeBots.forEach((botData, username) => {
        if (botData.bot.entity) {
            try {
                botData.bot.chat(message);
                sentCount++;
                console.log(`✅ Sent chat to ${username}: "${message}"`);

                sendToAllClients(JSON.stringify({
                    type: 'system',
                    message: `Sent "${message}" to ${username}`
                }));
            } catch (error) {
                console.log(`❌ Failed to send chat to ${username}:`, error.message);
            }
        }
    });

    sendToAllClients(JSON.stringify({
        type: 'system',
        message: `Sent "${message}" to ${sentCount} online bots`
    }));
}

function tpaToOwner() {
    console.log('📞 Sending TPA to WORST_HT4_ for all online bots');
    let sentCount = 0;

    activeBots.forEach((botData, username) => {
        if (botData.bot.entity) {
            try {
                botData.bot.chat('/tpa WORST_HT4_');
                sentCount++;
                console.log(`✅ Sent TPA from ${username} to WORST_HT4_`);

                sendToAllClients(JSON.stringify({
                    type: 'system',
                    message: `Sent TPA from ${username} to WORST_HT4_`
                }));
            } catch (error) {
                console.log(`❌ Failed to send TPA from ${username}:`, error.message);
            }
        }
    });

    sendToAllClients(JSON.stringify({
        type: 'system',
        message: `Sent TPA to WORST_HT4_ from ${sentCount} online bots`
    }));
}

function dropTripwireHooks() {
    console.log('🎣 Dropping tripwire hooks for all online bots');
    let sentCount = 0;

    activeBots.forEach((botData, username) => {
        if (botData.bot.entity) {
            try {
                const bot = botData.bot;

                // Select first hotbar slot
                bot.setQuickBarSlot(0);

                // Drop the item
                setTimeout(() => {
                    try {
                        bot.activateItem();
                        console.log(`✅ ${username} dropped tripwire hook`);

                        sendToAllClients(JSON.stringify({
                            type: 'system',
                            message: `${username} dropped tripwire hook`
                        }));
                    } catch (error) {
                        console.log(`❌ Error dropping item from ${username}:`, error.message);
                    }
                }, 100);

                sentCount++;
            } catch (error) {
                console.log(`❌ Error preparing drop from ${username}:`, error.message);
            }
        }
    });

    sendToAllClients(JSON.stringify({
        type: 'system',
        message: `Dropped tripwire hooks from ${sentCount} online bots`
    }));
}

function sendAllToSurvival() {
    console.log('🎯 Sending all online bots to survival');
    let sentCount = 0;

    activeBots.forEach((botData, username) => {
        if (botData.bot.entity) {
            try {
                botData.bot.chat('/server survival');
                botStatuses.set(username, {
                    status: 'online',
                    currentServer: 'survival',
                    username: username
                });
                sentCount++;
                console.log(`✅ Sent ${username} to survival`);

                sendToAllClients(JSON.stringify({
                    type: 'system',
                    message: `Sent ${username} to survival server`
                }));

                sendToAllClients(JSON.stringify({
                    type: 'status',
                    username: username,
                    status: 'online'
                }));
            } catch (error) {
                console.log(`❌ Failed to send ${username} to survival:`, error.message);
            }
        }
    });

    sendToAllClients(JSON.stringify({
        type: 'system',
        message: `Sent ${sentCount} online bots to survival server`
    }));
}

function startSurvivalLoop(bot, username) {
    // Clear any existing interval
    if (bot.survivalInterval) {
        clearInterval(bot.survivalInterval);
    }

    // Start survival command loop every 10 seconds
    bot.survivalInterval = setInterval(() => {
        if (bot.entity) {
            try {
                bot.chat('/server survival');
                console.log(`🔄 Sent /server survival to ${username}`);

                sendToAllClients(JSON.stringify({
                    type: 'system',
                    message: `Sent /server survival to ${username}`
                }));
            } catch (error) {
                console.log(`❌ Error sending survival command to ${username}:`, error.message);
            }
        }
    }, 10000); // 10 seconds
}

function bulkConnectBots(ws, count, server, port, password) {
    const maxCount = Math.min(parseInt(count) || 50, 50);
    console.log(`🚀 Starting bulk connection of ${maxCount} bots - MAXIMUM SPEED`);

    const offlineBots = [];

    // Find offline bots
    accounts.forEach(username => {
        const status = botStatuses.get(username);
        if (status && status.status === 'offline' && offlineBots.length < maxCount) {
            offlineBots.push(username);
        }
    });

    if (offlineBots.length === 0) {
        console.log('❌ No offline bots available for bulk connection');
        safeSend(ws, JSON.stringify({
            type: 'system',
            message: 'No offline bots available for bulk connection'
        }));
        return;
    }

    console.log(`🔍 Found ${offlineBots.length} offline bots, connecting ALL AT ONCE`);

    // Connect ALL bots immediately - no delays
    offlineBots.forEach((username, index) => {
        // Connect with 2 second delay between each to prevent 3000ms errors
        setTimeout(() => {
            connectBot(ws, username, server, port, password);
        }, index * 2000); // 2 second delay between connections
    });

    safeSend(ws, JSON.stringify({
        type: 'system',
        message: `Starting connection of ${offlineBots.length} bots with 2 second delays`
    }));
}

function connectBot(ws, username, server, port, password) {
    if (!accounts.includes(username)) {
        console.log('❌ Bot not found in account list:', username);
        return;
    }

    // Clean up existing bot if needed
    if (activeBots.has(username)) {
        const existingBot = activeBots.get(username);
        if (existingBot.bot.entity) {
            console.log('❌ Bot already connected:', username);
            return;
        } else {
            safeBotCleanup(existingBot.bot);
            activeBots.delete(username);
        }
    }

    console.log('🚀 Connecting bot:', username);

    // Update status immediately
    botStatuses.set(username, {
        status: 'connecting',
        currentServer: 'unknown',
        username: username
    });

    sendToAllClients(JSON.stringify({
        type: 'status',
        username: username,
        status: 'connecting'
    }));

    try {
        const bot = mineflayer.createBot({
            host: server || 'play.stealfun.net',
            port: port || 25565,
            username: username,
            version: '1.19.2',
            auth: 'offline',

            // INCREASED TIMEOUTS TO PREVENT 3000ms ERRORS
            checkTimeoutInterval: 120000, // 2 minutes
            session: null,
            closeTimeout: 120 * 1000, // 2 minutes
            noPongTimeout: 60 * 1000, // 1 minute

            // Connection stability options
            connectTimeout: 30000, // 30 seconds connection timeout
            keepAlive: true,

            skipValidation: true,
            hideErrors: false,
            logErrors: true,

            // Additional network options
            transport: 'tcp',
            colorsEnabled: false,
            // Reduced packet logging to prevent spam
            logDebug: false
        });

        activeBots.set(username, { bot, ws });

        bot.once('spawn', () => {
            console.log('✅ Bot successfully joined:', username);

            botStatuses.set(username, {
                status: 'online',
                currentServer: 'hub',
                username: username
            });

            sendToAllClients(JSON.stringify({
                type: 'status',
                username: username,
                status: 'online'
            }));

            sendToAllClients(JSON.stringify({
                type: 'joined',
                username: username,
                message: 'Bot successfully joined server'
            }));

            // Login sequence with longer delays
            setTimeout(() => {
                if (bot.entity) {
                    const loginPassword = password || 'password';
                    bot.chat('/login ' + loginPassword);
                    console.log('🔐 Sent login command:', username);

                    sendToAllClients(JSON.stringify({
                        type: 'login',
                        username: username,
                        message: '/login ' + loginPassword
                    }));

                    // Switch to survival after longer delay
                    setTimeout(() => {
                        if (bot.entity) {
                            bot.chat('/server survival');
                            botStatuses.set(username, {
                                status: 'online',
                                currentServer: 'survival',
                                username: username
                            });
                            console.log('🎯 Sent to survival:', username);

                            sendToAllClients(JSON.stringify({
                                type: 'system',
                                username: username,
                                message: 'Switched to survival'
                            }));

                            // Start the survival loop immediately
                            startSurvivalLoop(bot, username);
                        }
                    }, 5000); // 5 second delay before switching
                }
            }, 3000); // 3 second delay before login

            // Keep alive - less aggressive to prevent timeouts
            bot.keepAliveInterval = setInterval(() => {
                if (bot.entity) {
                    try {
                        // Gentle movement to prevent timeouts
                        bot.look(bot.entity.yaw + 0.1, bot.entity.pitch, false);
                    } catch (error) {
                        console.log('❌ Keep-alive error:', error.message);
                    }
                }
            }, 30000); // 30 second interval - less frequent
        });

        bot.on('message', (msg) => {
            const messageText = msg.toString();
            // Filter out timeout and connection messages
            if (!messageText.includes('timed out') && !messageText.includes('3000ms')) {
                console.log('💬 Bot received message:', username, messageText);
                sendToAllClients(JSON.stringify({
                    type: 'message',
                    username: username,
                    message: messageText
                }));
            }
        });

        bot.on('end', (reason) => {
            // Filter out timeout messages from logging
            if (!reason.includes('3000ms') && !reason.includes('timed out')) {
                console.log('❌ Bot disconnected:', username, reason);
            }

            botStatuses.set(username, {
                status: 'offline',
                currentServer: 'unknown',
                username: username
            });

            sendToAllClients(JSON.stringify({
                type: 'status',
                username: username,
                status: 'offline'
            }));

            safeBotCleanup(bot);
            activeBots.delete(username);

            // Auto-reconnect after 10 seconds - longer delay
            setTimeout(() => {
                if (!activeBots.has(username)) {
                    console.log('🔄 Attempting to reconnect:', username);
                    connectBot(ws, username, server, port, password);
                }
            }, 10000);
        });

        bot.on('error', (err) => {
            // Filter out timeout errors from logging
            if (!err.message.includes('3000ms') && !err.message.includes('timed out')) {
                console.error('❌ Bot error:', username, err.message);
            }

            botStatuses.set(username, {
                status: 'offline',
                currentServer: 'unknown',
                username: username
            });

            sendToAllClients(JSON.stringify({
                type: 'status',
                username: username,
                status: 'offline'
            }));

            safeBotCleanup(bot);
            activeBots.delete(username);
        });

        // Handle kick events specifically
        bot.on('kicked', (reason) => {
            console.log(`🚫 Bot kicked: ${username} - ${reason}`);

            botStatuses.set(username, {
                status: 'offline',
                currentServer: 'kicked',
                username: username
            });

            sendToAllClients(JSON.stringify({
                type: 'status',
                username: username,
                status: 'offline'
            }));

            safeBotCleanup(bot);
            activeBots.delete(username);

            // Reconnect after 15 seconds if kicked
            setTimeout(() => {
                if (!activeBots.has(username)) {
                    console.log('🔄 Reconnecting after kick:', username);
                    connectBot(ws, username, server, port, password);
                }
            }, 15000);
        });

        // Handle timeout events specifically
        bot.on('timeout', () => {
            console.log(`⏰ Bot timeout: ${username}`);

            botStatuses.set(username, {
                status: 'offline',
                currentServer: 'timeout',
                username: username
            });

            sendToAllClients(JSON.stringify({
                type: 'status',
                username: username,
                status: 'offline'
            }));

            safeBotCleanup(bot);
            activeBots.delete(username);

            // Reconnect after 10 seconds for timeout
            setTimeout(() => {
                if (!activeBots.has(username)) {
                    console.log('🔄 Reconnecting after timeout:', username);
                    connectBot(ws, username, server, port, password);
                }
            }, 10000);
        });

    } catch (error) {
        console.error('❌ Failed to create bot:', username, error);

        botStatuses.set(username, {
            status: 'offline',
            currentServer: 'unknown',
            username: username
        });

        sendToAllClients(JSON.stringify({
            type: 'error',
            username: username,
            message: 'Failed to create bot: ' + error.message
        }));
    }
}

function disconnectBot(username) {
    console.log('🛑 Disconnecting bot:', username);

    const botData = activeBots.get(username);
    if (botData) {
        botStatuses.set(username, {
            status: 'offline',
            currentServer: 'unknown',
            username: username
        });

        safeBotCleanup(botData.bot);
        activeBots.delete(username);

        sendToAllClients(JSON.stringify({
            type: 'status',
            username: username,
            status: 'offline'
        }));

        console.log('✅ Bot disconnected:', username);
    }
}

function sendChat(username, message) {
    const botData = activeBots.get(username);
    if (botData && botData.bot.entity) {
        console.log('💬 Sending chat from', username + ':', message);
        try {
            botData.bot.chat(message);

            sendToAllClients(JSON.stringify({
                type: 'chat_sent',
                username: username,
                message: message
            }));
        } catch (error) {
            console.log(`❌ Failed to send chat from ${username}:`, error.message);
        }
    } else {
        console.log(`❌ Cannot send chat - bot ${username} not connected`);
    }
}

// Start the combined server
server.listen(PORT, '0.0.0.0', () => {
    console.log('🤖 Minecraft Bot Combined Server Started');
    console.log('📡 Running on port', PORT);
    console.log('📊 Total bots available:', accounts.length);
    console.log('⚡ Connection strategy: 2 second delays between connections');
    console.log('⏰ Increased timeouts to prevent 3000ms errors');
    console.log('🔄 Survival loop: /server survival every 10 seconds');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down server gracefully...');

    activeBots.forEach((botData, username) => {
        safeBotCleanup(botData.bot);
    });

    clients.forEach(client => {
        client.close();
    });

    wss.close(() => {
        console.log('✅ WebSocket server closed');
    });

    server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
    });
});

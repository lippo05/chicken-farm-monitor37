// ============================================
// Farm Monitoring & Control Dashboard
// Complete Firebase + ESP32 Bridge System
// ============================================

// ===== FIREBASE CONFIGURATION =====
const firebaseConfig = {
  apiKey: "AIzaSyC8OZZ27bP-HQXimnYbyNzCrWDJdgupl1I",
  authDomain: "farmmonitoring-a9cfa.firebaseapp.com",
  databaseURL: "https://farmmonitoring-a9cfa-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "farmmonitoring-a9cfa",
  storageBucket: "farmmonitoring-a9cfa.firebasestorage.app",
  messagingSenderId: "1093700096226",
  appId: "1:1093700096226:web:dc2174ea0cda0052b98ebb"
};

// ===== GLOBAL VARIABLES =====
let database;
let auth;
let user = null;
let selectedBridge = null;
let sensorDataRef = null;
let bridgeRef = null;
let commandsRef = null;
let lastSensorData = null;
let alertCount = 0;

// Data update timestamps
let lastWaterUpdate = 0;
let lastFeedUpdate = 0;
let lastTempUpdate = 0;
let lastConnectionUpdate = 0;

// Bridge list
let bridges = [];
let activeBridgeId = null;

// ===== DOM ELEMENTS =====
const loginForm = document.getElementById('loginForm');
const dashboard = document.getElementById('dashboard');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('loginError');
const userEmail = document.getElementById('userEmail');
const bridgeList = document.getElementById('bridgeList');
const refreshBridgeBtn = document.getElementById('refreshBridgeBtn');
const clearLogBtn = document.getElementById('clearLogBtn');

// Status elements
const bridgeStatus = document.getElementById('bridgeStatus');
const loraStatus = document.getElementById('loraStatus');

// Sensor display elements
const waterValue = document.getElementById('waterValue');
const waterGauge = document.getElementById('waterGauge');
const waterBadge = document.getElementById('waterBadge');
const waterUpdate = document.getElementById('waterUpdate');

const feedValue = document.getElementById('feedValue');
const feedGauge = document.getElementById('feedGauge');
const feedBadge = document.getElementById('feedBadge');
const feedUpdate = document.getElementById('feedUpdate');

// Temperature elements
const tempBadge = document.getElementById('tempBadge');
const tempUpdate = document.getElementById('tempUpdate');

// Control display elements
const servo1Indicator = document.getElementById('servo1Indicator');
const servo1Icon = document.getElementById('servo1Icon');
const servo1Position = document.getElementById('servo1Position');

const servo2Indicator = document.getElementById('servo2Indicator');
const servo2Icon = document.getElementById('servo2Icon');
const servo2Position = document.getElementById('servo2Position');

const pumpIndicator = document.getElementById('pumpIndicator');
const pumpIcon = document.getElementById('pumpIcon');
const pumpStatusText = document.getElementById('pumpStatusText');

// Fan elements
const fanIndicator = document.getElementById('fanIndicator');
const fanIcon = document.getElementById('fanIcon');
const fanStatusText = document.getElementById('fanStatusText');

// Connection info elements
const activeBridgeEl = document.getElementById('activeBridge');
const loraSignal = document.getElementById('loraSignal');
const loraDistance = document.getElementById('loraDistance');
const loraSNR = document.getElementById('loraSNR');
const packetCount = document.getElementById('packetCount');
const lastDataTime = document.getElementById('lastDataTime');

// Alert elements
const alertPanel = document.getElementById('alertPanel');
const alertContent = document.getElementById('alertContent');
const alertCountEl = document.getElementById('alertCount');

// Log elements
const logContent = document.getElementById('logContent');

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    console.log('Initializing Farm Control System...');
    
    // Initialize Firebase
    try {
        firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        auth = firebase.auth();
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Firebase initialization error:', error);
        showNotification('Firebase connection failed. Please check configuration.', 'error');
    }
    
    // Set up auth state listener
    auth.onAuthStateChanged(handleAuthStateChanged);
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize timestamps
    lastWaterUpdate = Date.now();
    lastFeedUpdate = Date.now();
    lastTempUpdate = Date.now();
    lastConnectionUpdate = Date.now();
    
    // Hide logout button initially (login page)
    logoutBtn.style.display = 'none';
    
    console.log('Application initialized');
}

function setupEventListeners() {
    // Login button
    loginBtn.addEventListener('click', handleLogin);
    
    // Logout button
    logoutBtn.addEventListener('click', handleLogout);
    
    // Refresh bridges button
    refreshBridgeBtn.addEventListener('click', loadBridges);
    
    // Clear logs button
    clearLogBtn.addEventListener('click', clearLogs);
    
    // Enter key for login
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    // Window beforeunload - cleanup
    window.addEventListener('beforeunload', () => {
        if (sensorDataRef) sensorDataRef.off();
        if (bridgeRef) bridgeRef.off();
        if (commandsRef) commandsRef.off();
    });
}

// ===== AUTHENTICATION =====
async function handleLogin() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        showError('Please enter email and password');
        return;
    }
    
    try {
        // Update UI
        loginError.textContent = '';
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
        
        // Sign in with Firebase
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        user = userCredential.user;
        
        showNotification(`Welcome back, ${user.email}!`, 'success');
        
    } catch (error) {
        console.error('Login error:', error);
        
        let errorMessage = 'Login failed. ';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage += 'User not found.';
                break;
            case 'auth/wrong-password':
                errorMessage += 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email format.';
                break;
            default:
                errorMessage += error.message;
        }
        
        showError(errorMessage);
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to Dashboard';
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        auth.signOut();
        showNotification('Logged out successfully', 'info');
    }
}

function handleAuthStateChanged(firebaseUser) {
    if (firebaseUser) {
        // User is signed in
        user = firebaseUser;
        userEmail.textContent = user.email;
        showDashboard();
        loadBridges();
        logEvent('User logged in', 'info');
        
        // Show logout button (on dashboard)
        logoutBtn.style.display = 'flex';
    } else {
        // User is signed out
        user = null;
        userEmail.textContent = 'Not logged in';
        showLogin();
        resetDashboard();
        
        // Hide logout button (on login page)
        logoutBtn.style.display = 'none';
    }
}

function showLogin() {
    loginForm.style.display = 'flex';
    dashboard.classList.add('hidden');
}

function showDashboard() {
    loginForm.style.display = 'none';
    dashboard.classList.remove('hidden');
}

// ===== BRIDGE MANAGEMENT =====
function loadBridges() {
    if (!user) return;
    
    console.log('Loading bridges...');
    
    // Clear existing bridges
    bridges = [];
    bridgeList.innerHTML = '';
    
    // Listen for bridges
    bridgeRef = database.ref('/bridge');
    bridgeRef.on('value', (snapshot) => {
        bridges = [];
        bridgeList.innerHTML = '';
        
        if (!snapshot.exists()) {
            bridgeList.innerHTML = `
                <div class="no-bridges">
                    <i class="fas fa-satellite"></i>
                    <p>No bridges connected. Make sure Device 2 is running.</p>
                </div>
            `;
            return;
        }
        
        snapshot.forEach((childSnapshot) => {
            const bridgeId = childSnapshot.key;
            const bridgeData = childSnapshot.val();
            
            bridges.push({
                id: bridgeId,
                name: bridgeData.name || 'Unknown Bridge',
                status: bridgeData.status || 'offline',
                ip: bridgeData.ip || 'N/A',
                last_update: bridgeData.last_update || 0,
                packets_received: bridgeData.packets_received || 0,
                last_rssi: bridgeData.last_rssi || 0
            });
            
            // Create bridge item
            const bridgeItem = document.createElement('div');
            bridgeItem.className = `bridge-item ${bridgeId === activeBridgeId ? 'active' : ''}`;
            bridgeItem.innerHTML = `
                <div class="bridge-name">
                    <i class="fas fa-satellite-dish"></i>
                    ${bridgeData.name || 'Bridge'}
                </div>
                <div class="bridge-id">ID: ${bridgeId}</div>
                <div class="bridge-info">
                    <span class="bridge-status ${bridgeData.status || 'offline'}">
                        <i class="fas fa-circle"></i> ${bridgeData.status || 'offline'}
                    </span>
                    <span>Packets: ${bridgeData.packets_received || 0}</span>
                </div>
            `;
            
            // Add click event
            bridgeItem.addEventListener('click', () => selectBridge(bridgeId));
            bridgeList.appendChild(bridgeItem);
        });
        
        // Auto-select first bridge if none selected
        if (bridges.length > 0 && !activeBridgeId) {
            selectBridge(bridges[0].id);
        }
        
        updateBridgeStatus();
    });
}

function selectBridge(bridgeId) {
    if (!user) return;
    
    console.log('Selecting bridge:', bridgeId);
    
    // Update UI
    document.querySelectorAll('.bridge-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const selectedItem = Array.from(document.querySelectorAll('.bridge-item'))
        .find(item => item.querySelector('.bridge-id').textContent.includes(bridgeId));
    
    if (selectedItem) {
        selectedItem.classList.add('active');
    }
    
    // Set active bridge
    activeBridgeId = bridgeId;
    selectedBridge = bridges.find(b => b.id === bridgeId);
    
    if (selectedBridge) {
        activeBridgeEl.textContent = selectedBridge.name;
        
        // Start monitoring sensors
        startSensorMonitoring();
        
        // Start command monitoring
        startCommandMonitoring();
        
        showNotification(`Connected to bridge: ${selectedBridge.name}`, 'success');
        logEvent(`Bridge selected: ${selectedBridge.name}`, 'info');
    }
}

function updateBridgeStatus() {
    if (bridges.length === 0) {
        bridgeStatus.innerHTML = '<i class="fas fa-circle"></i> No Bridges';
        bridgeStatus.className = 'status-offline';
        return;
    }
    
    const onlineBridges = bridges.filter(b => b.status === 'online');
    
    if (onlineBridges.length > 0) {
        bridgeStatus.innerHTML = `<i class="fas fa-circle"></i> ${onlineBridges.length} Online`;
        bridgeStatus.className = 'status-online';
    } else {
        bridgeStatus.innerHTML = '<i class="fas fa-circle"></i> All Offline';
        bridgeStatus.className = 'status-offline';
    }
}

// ===== SENSOR MONITORING =====
function startSensorMonitoring() {
    if (!user || !activeBridgeId) return;
    
    console.log('Starting sensor monitoring...');
    
    // Stop previous listeners
    if (sensorDataRef) {
        sensorDataRef.off();
    }
    
    // Listen for sensor data
    sensorDataRef = database.ref('/sensors/current');
    sensorDataRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            lastSensorData = data;
            updateSensorDisplay(data);
            updateConnectionDisplay(data);
            checkAlerts(data);
            lastConnectionUpdate = Date.now();
            
            // Update LoRa status
            loraStatus.innerHTML = '<i class="fas fa-circle"></i> Connected';
            loraStatus.className = 'status-online';
        }
    });
    
    // Handle disconnect
    sensorDataRef.onDisconnect().update({
        status: 'offline'
    });
}

function updateSensorDisplay(data) {
    // Water level
    const waterLevel = data.water || 0;
    waterValue.textContent = `${waterLevel}%`;
    waterGauge.style.width = `${waterLevel}%`;
    waterUpdate.textContent = formatTimeAgo(data.timestamp);
    lastWaterUpdate = data.timestamp || Date.now();
    
    // Feed level
    const feedLevel = data.feed || 0;
    feedValue.textContent = `${feedLevel}%`;
    feedGauge.style.width = `${feedLevel}%`;
    feedUpdate.textContent = formatTimeAgo(data.timestamp);
    lastFeedUpdate = data.timestamp || Date.now();
    
    // Temperature
    const temperature = data.temperature || 0;
    const tempNumber = document.querySelector('.temp-number');
    if (tempNumber) {
        tempNumber.textContent = temperature.toFixed(1);
    }
    tempUpdate.textContent = formatTimeAgo(data.timestamp);
    lastTempUpdate = data.timestamp || Date.now();
    
    // Update temperature display color
    updateTemperatureDisplay(temperature);
    
    // Feed Gate 1
    const servo1Pos = data.servo1 || 0;
    servo1Position.textContent = `${servo1Pos}°`;
    
    if (servo1Pos === 90) {
        servo1Indicator.className = 'status-indicator status-online';
        servo1Indicator.querySelector('.status-text').textContent = 'OPEN';
        servo1Icon.innerHTML = '<i class="fas fa-door-open"></i>';
        document.querySelector('.feed-gate-1-card').classList.add('active');
    } else {
        servo1Indicator.className = 'status-indicator status-offline';
        servo1Indicator.querySelector('.status-text').textContent = 'CLOSED';
        servo1Icon.innerHTML = '<i class="fas fa-door-closed"></i>';
        document.querySelector('.feed-gate-1-card').classList.remove('active');
    }
    
    // Feed Gate 2
    const servo2Pos = data.servo2 || 0;
    servo2Position.textContent = `${servo2Pos}°`;
    
    if (servo2Pos === 90) {
        servo2Indicator.className = 'status-indicator status-online';
        servo2Indicator.querySelector('.status-text').textContent = 'OPEN';
        servo2Icon.innerHTML = '<i class="fas fa-door-open"></i>';
        document.querySelector('.feed-gate-2-card').classList.add('active');
    } else {
        servo2Indicator.className = 'status-indicator status-offline';
        servo2Indicator.querySelector('.status-text').textContent = 'CLOSED';
        servo2Icon.innerHTML = '<i class="fas fa-door-closed"></i>';
        document.querySelector('.feed-gate-2-card').classList.remove('active');
    }
    
    // Water Pump
    const pumpState = data.pump || false;
    pumpStatusText.textContent = pumpState ? 'RUNNING' : 'STOPPED';
    
    if (pumpState) {
        pumpIndicator.className = 'status-indicator status-online';
        pumpIndicator.querySelector('.status-text').textContent = 'ON';
        pumpIcon.innerHTML = '<i class="fas fa-play"></i>';
        document.querySelector('.pump-card').classList.add('active');
    } else {
        pumpIndicator.className = 'status-indicator status-offline';
        pumpIndicator.querySelector('.status-text').textContent = 'OFF';
        pumpIcon.innerHTML = '<i class="fas fa-power-off"></i>';
        document.querySelector('.pump-card').classList.remove('active');
    }
    
    // Fan status
    const fanState = data.fan || false;
    fanStatusText.textContent = fanState ? 'RUNNING' : 'STOPPED';
    
    if (fanState) {
        fanIndicator.className = 'status-indicator status-online';
        fanIndicator.querySelector('.status-text').textContent = 'ON';
        fanIcon.innerHTML = '<i class="fas fa-fan spin"></i>';
        document.querySelector('.fan-card').classList.add('active');
    } else {
        fanIndicator.className = 'status-indicator status-offline';
        fanIndicator.querySelector('.status-text').textContent = 'OFF';
        fanIcon.innerHTML = '<i class="fas fa-fan"></i>';
        document.querySelector('.fan-card').classList.remove('active');
    }
}

function updateTemperatureDisplay(temperature) {
    const tempDisplay = document.getElementById('temperatureValue');
    const tempNumber = document.querySelector('.temp-number');
    
    if (!tempDisplay || !tempNumber) return;
    
    if (temperature >= 30) {
        // Hot - red
        tempDisplay.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a52)';
        tempNumber.style.color = '#fff';
        tempBadge.textContent = 'HOT';
        tempBadge.style.background = '#f8d7da';
        tempBadge.style.color = '#721c24';
    } else if (temperature <= 15 && temperature > -100) {
        // Cold - blue
        tempDisplay.style.background = 'linear-gradient(135deg, #74b9ff, #0984e3)';
        tempNumber.style.color = '#fff';
        tempBadge.textContent = 'COLD';
        tempBadge.style.background = '#d1ecf1';
        tempBadge.style.color = '#0c5460';
    } else {
        // Normal - green
        tempDisplay.style.background = 'linear-gradient(135deg, #55efc4, #00b894)';
        tempNumber.style.color = '#fff';
        tempBadge.textContent = 'NORMAL';
        tempBadge.style.background = '#d4efdf';
        tempBadge.style.color = '#155724';
    }
}

function updateConnectionDisplay(data) {
    // LoRa signal
    const rssi = data.rssi || 0;
    loraSignal.textContent = `${rssi} dBm`;
    
    // Distance
    const distance = data.distance || 0;
    loraDistance.textContent = formatDistance(distance);
    
    // SNR
    const snr = data.snr || 0;
    loraSNR.textContent = `${snr.toFixed(1)} dB`;
    
    // Packet count
    const packets = data.packetCount || 0;
    packetCount.textContent = packets;
    
    // Last data time
    lastDataTime.textContent = formatTimeAgo(data.timestamp);
}

// ===== COMMAND CONTROL =====
function controlServo2(action) {
    sendCommand('servo2', action);
}

function sendCommand(device, action) {
    if (!user) {
        showNotification('Please login first', 'error');
        return;
    }
    
    if (!activeBridgeId) {
        showNotification('Please select a bridge first', 'error');
        return;
    }
    
    console.log(`Sending command: ${device} -> ${action}`);
    
    // Send command to Firebase
    const commandRef = database.ref(`/commands/${device}`);
    commandRef.set(action)
        .then(() => {
            showNotification(`${device.toUpperCase()} command sent: ${action}`, 'success');
            logEvent(`Command sent: ${device} ${action}`, 'info');
        })
        .catch((error) => {
            console.error('Command send error:', error);
            showNotification(`Failed to send command: ${error.message}`, 'error');
            logEvent(`Command failed: ${device} ${action} - ${error.message}`, 'error');
        });
}

function startCommandMonitoring() {
    if (!user || !activeBridgeId) return;
    
    // Listen for command execution status
    commandsRef = database.ref('/commands');
    commandsRef.on('child_changed', (snapshot) => {
        const device = snapshot.key;
        const status = snapshot.val();
        
        if (status === 'executed') {
            console.log(`Command executed: ${device}`);
            
            // Reset command after a delay
            setTimeout(() => {
                database.ref(`/commands/${device}`).set('none');
            }, 1000);
        }
    });
}

// ===== ALERT SYSTEM =====
function checkAlerts(data) {
    const alerts = [];
    
    // Water level alert
    const waterLevel = data.water || 0;
    if (waterLevel < 30) {
        alerts.push({
            type: 'critical',
            message: 'CRITICAL: Water level very low! (< 30%)',
            time: Date.now()
        });
        waterBadge.textContent = 'CRITICAL';
        waterBadge.style.background = '#f8d7da';
        waterBadge.style.color = '#721c24';
    } else if (waterLevel < 70) {
        alerts.push({
            type: 'warning',
            message: 'WARNING: Water level low (< 70%)',
            time: Date.now()
        });
        waterBadge.textContent = 'LOW';
        waterBadge.style.background = '#fff3cd';
        waterBadge.style.color = '#856404';
    } else {
        waterBadge.textContent = 'NORMAL';
        waterBadge.style.background = '#d4efdf';
        waterBadge.style.color = '#155724';
    }
    
    // Feed level alert
    const feedLevel = data.feed || 0;
    if (feedLevel < 20) {
        alerts.push({
            type: 'critical',
            message: 'CRITICAL: Feed level very low! (< 20%)',
            time: Date.now()
        });
        feedBadge.textContent = 'CRITICAL';
        feedBadge.style.background = '#f8d7da';
        feedBadge.style.color = '#721c24';
    } else if (feedLevel < 50) {
        alerts.push({
            type: 'warning',
            message: 'WARNING: Feed level low (< 50%)',
            time: Date.now()
        });
        feedBadge.textContent = 'LOW';
        feedBadge.style.background = '#fff3cd';
        feedBadge.style.color = '#856404';
    } else {
        feedBadge.textContent = 'NORMAL';
        feedBadge.style.background = '#fef9e7';
        feedBadge.style.color = '#7d6608';
    }
    
    // Temperature alerts
    const temperature = data.temperature || 0;
    if (temperature >= 30) {
        alerts.push({
            type: 'warning',
            message: `HIGH TEMPERATURE: ${temperature.toFixed(1)}°C`,
            time: Date.now()
        });
    } else if (temperature <= 15 && temperature > -100) {
        alerts.push({
            type: 'warning',
            message: `LOW TEMPERATURE: ${temperature.toFixed(1)}°C`,
            time: Date.now()
        });
    }
    
    // Connection alert (if no data for 60 seconds)
    const timeSinceUpdate = Date.now() - (data.timestamp || 0);
    if (timeSinceUpdate > 60000) {
        alerts.push({
            type: 'warning',
            message: 'WARNING: No data received for 60+ seconds',
            time: Date.now()
        });
    }
    
    // Update alert display
    updateAlertsDisplay(alerts);
    alertCount = alerts.length;
}

function updateAlertsDisplay(alerts) {
    alertContent.innerHTML = '';
    alertCountEl.textContent = alerts.length;
    
    if (alerts.length === 0) {
        alertContent.innerHTML = `
            <div class="no-alerts">
                <i class="fas fa-check-circle"></i>
                <p>All systems normal</p>
            </div>
        `;
        alertPanel.style.display = 'block';
        return;
    }
    
    // Sort alerts: critical first, then warning, then info
    alerts.sort((a, b) => {
        const priority = { critical: 3, warning: 2, info: 1 };
        return priority[b.type] - priority[a.type];
    });
    
    // Display alerts
    alerts.forEach(alert => {
        const alertElement = document.createElement('div');
        alertElement.className = `alert-item alert-${alert.type}`;
        alertElement.innerHTML = `
            <i class="fas fa-${alert.type === 'critical' ? 'exclamation-triangle' : 'exclamation-circle'}"></i>
            <div class="alert-message">${alert.message}</div>
            <div class="alert-time">${formatTimeAgo(alert.time)}</div>
        `;
        alertContent.appendChild(alertElement);
    });
    
    alertPanel.style.display = 'block';
}

// ===== LOG SYSTEM =====
function logEvent(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    let icon = 'info-circle';
    let color = '#3498db';
    
    switch (type) {
        case 'error':
            icon = 'times-circle';
            color = '#e74c3c';
            break;
        case 'success':
            icon = 'check-circle';
            color = '#2ecc71';
            break;
        case 'warning':
            icon = 'exclamation-circle';
            color = '#f39c12';
            break;
    }
    
    logEntry.innerHTML = `
        <span class="log-time" style="color: ${color}">[${timestamp}]</span>
        <span class="log-message">
            <i class="fas fa-${icon}" style="color: ${color}; margin-right: 5px;"></i>
            ${message}
        </span>
    `;
    
    // Add to top
    logContent.insertBefore(logEntry, logContent.firstChild);
    
    // Keep only last 50 entries
    const entries = logContent.querySelectorAll('.log-entry');
    if (entries.length > 50) {
        logContent.removeChild(entries[entries.length - 1]);
    }
    
    // Scroll to top
    logContent.scrollTop = 0;
}

function clearLogs() {
    if (confirm('Clear all log entries?')) {
        logContent.innerHTML = `
            <div class="log-entry">
                <span class="log-time">[${new Date().toLocaleTimeString()}]</span>
                <span class="log-message">
                    <i class="fas fa-info-circle" style="color: #3498db; margin-right: 5px;"></i>
                    Logs cleared
                </span>
            </div>
        `;
        logEvent('Logs cleared by user', 'info');
    }
}

// ===== UTILITY FUNCTIONS =====
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 1000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    } else {
        return `${(meters / 1000).toFixed(1)} km`;
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    // Add to container
    container.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

function showError(message) {
    loginError.textContent = message;
    loginError.style.animation = 'shake 0.5s';
    setTimeout(() => loginError.style.animation = '', 500);
}

function resetDashboard() {
    // Reset all displays
    waterValue.textContent = '0%';
    waterGauge.style.width = '0%';
    waterBadge.textContent = 'NORMAL';
    waterUpdate.textContent = 'Never';
    
    feedValue.textContent = '0%';
    feedGauge.style.width = '0%';
    feedBadge.textContent = 'NORMAL';
    feedUpdate.textContent = 'Never';
    
    // Reset temperature
    const tempNumber = document.querySelector('.temp-number');
    if (tempNumber) {
        tempNumber.textContent = '0.0';
    }
    const tempDisplay = document.getElementById('temperatureValue');
    if (tempDisplay) {
        tempDisplay.style.background = 'linear-gradient(135deg, #55efc4, #00b894)';
    }
    tempBadge.textContent = 'NORMAL';
    tempUpdate.textContent = 'Never';
    
    servo1Position.textContent = '0°';
    servo1Indicator.className = 'status-indicator status-offline';
    servo1Indicator.querySelector('.status-text').textContent = 'CLOSED';
    servo1Icon.innerHTML = '<i class="fas fa-door-closed"></i>';
    
    servo2Position.textContent = '0°';
    servo2Indicator.className = 'status-indicator status-offline';
    servo2Indicator.querySelector('.status-text').textContent = 'CLOSED';
    servo2Icon.innerHTML = '<i class="fas fa-door-closed"></i>';
    
    pumpStatusText.textContent = 'STOPPED';
    pumpIndicator.className = 'status-indicator status-offline';
    pumpIndicator.querySelector('.status-text').textContent = 'OFF';
    pumpIcon.innerHTML = '<i class="fas fa-power-off"></i>';
    
    fanStatusText.textContent = 'STOPPED';
    fanIndicator.className = 'status-indicator status-offline';
    fanIndicator.querySelector('.status-text').textContent = 'OFF';
    fanIcon.innerHTML = '<i class="fas fa-fan"></i>';
    fanIcon.classList.remove('spin');
    
    activeBridgeEl.textContent = 'None';
    loraSignal.textContent = '- dBm';
    loraDistance.textContent = '0 m';
    loraSNR.textContent = '0 dB';
    packetCount.textContent = '0';
    lastDataTime.textContent = 'Never';
    
    loraStatus.innerHTML = '<i class="fas fa-circle"></i> Offline';
    loraStatus.className = 'status-offline';
    
    // Clear alerts
    alertContent.innerHTML = `
        <div class="no-alerts">
            <i class="fas fa-check-circle"></i>
            <p>All systems normal</p>
        </div>
    `;
    alertCountEl.textContent = '0';
    
    // Stop all Firebase listeners
    if (sensorDataRef) sensorDataRef.off();
    if (bridgeRef) bridgeRef.off();
    if (commandsRef) commandsRef.off();
    
    sensorDataRef = null;
    bridgeRef = null;
    commandsRef = null;
    selectedBridge = null;
    activeBridgeId = null;
    bridges = [];
    lastSensorData = null;
}

// ===== PERIODIC UPDATES =====
setInterval(() => {
    // Update connection status if no data for 30 seconds
    if (lastConnectionUpdate && (Date.now() - lastConnectionUpdate > 30000)) {
        loraStatus.innerHTML = '<i class="fas fa-circle"></i> No Data';
        loraStatus.className = 'status-offline';
        
        // Add warning alert
        if (lastSensorData) {
            const alerts = Array.from(alertContent.querySelectorAll('.alert-item'));
            const hasConnectionAlert = alerts.some(alert => 
                alert.querySelector('.alert-message').textContent.includes('No data received')
            );
            
            if (!hasConnectionAlert) {
                checkAlerts({ ...lastSensorData, timestamp: lastConnectionUpdate });
            }
        }
    }
    
    // Update time ago displays
    if (lastWaterUpdate) {
        waterUpdate.textContent = formatTimeAgo(lastWaterUpdate);
    }
    if (lastFeedUpdate) {
        feedUpdate.textContent = formatTimeAgo(lastFeedUpdate);
    }
    if (lastTempUpdate) {
        tempUpdate.textContent = formatTimeAgo(lastTempUpdate);
    }
    if (lastConnectionUpdate) {
        lastDataTime.textContent = formatTimeAgo(lastConnectionUpdate);
    }
}, 10000); // Run every 10 seconds

// ===== ERROR HANDLING =====
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    logEvent(`JavaScript error: ${event.message}`, 'error');
});

// ===== STARTUP LOG =====
logEvent('Farm Control System initialized', 'info');

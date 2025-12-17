// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyC8OZZ27bP-HQXimnYbyNzCrWDJdgupl1I",
  authDomain: "farmmonitoring-a9cfa.firebaseapp.com",
  databaseURL: "https://farmmonitoring-a9cfa-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "farmmonitoring-a9cfa",
  storageBucket: "farmmonitoring-a9cfa.firebasestorage.app",
  messagingSenderId: "1093700096226",
  appId: "1:1093700096226:web:dc2174ea0cda0052b98ebb"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// DOM Elements
const loginForm = document.getElementById('loginForm');
const dashboard = document.getElementById('dashboard');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('loginError');
const farmSelector = document.getElementById('farmSelector');
const connectionStatus = document.getElementById('connectionStatus');

// Global Variables
let selectedFarmId = null;
let farmDataRef = null;
let deviceUptime = 0;
let farms = [];

// Initialize the app
function initApp() {
    // Check auth state
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in
            console.log('User signed in:', user.email);
            showDashboard();
            loadFarms();
        } else {
            // User is signed out
            console.log('User signed out');
            showLogin();
        }
    });

    // Login button event
    loginBtn.addEventListener('click', handleLogin);
    
    // Logout button event
    logoutBtn.addEventListener('click', handleLogout);
    
    // Farm selector event
    farmSelector.addEventListener('change', handleFarmChange);
    
    // Start uptime counter
    setInterval(() => {
        deviceUptime++;
        updateUptime();
    }, 1000);
}

// Handle login
async function handleLogin() {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    if (!email || !password) {
        loginError.textContent = 'Please enter email and password';
        return;
    }
    
    try {
        loginError.textContent = '';
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        
        await auth.signInWithEmailAndPassword(email, password);
        
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = error.message;
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    }
}

// Handle logout
function handleLogout() {
    auth.signOut();
}

// Show login form
function showLogin() {
    loginForm.style.display = 'flex';
    dashboard.classList.add('hidden');
}

// Show dashboard
function showDashboard() {
    loginForm.style.display = 'none';
    dashboard.classList.remove('hidden');
}

// Load available farms from Firebase
function loadFarms() {
    const farmsRef = database.ref('farms');
    
    farmsRef.on('value', (snapshot) => {
        farms = [];
        farmSelector.innerHTML = '<option value="">-- Select a farm --</option>';
        
        snapshot.forEach((childSnapshot) => {
            const farmId = childSnapshot.key;
            const farmData = childSnapshot.val();
            
            if (farmData.device_name) {
                farms.push({
                    id: farmId,
                    name: farmData.device_name
                });
                
                const option = document.createElement('option');
                option.value = farmId;
                option.textContent = farmData.device_name;
                farmSelector.appendChild(option);
            }
        });
    });
}

// Handle farm selection change
function handleFarmChange(event) {
    selectedFarmId = event.target.value;
    
    if (selectedFarmId) {
        startMonitoringFarm(selectedFarmId);
    } else {
        stopMonitoringFarm();
    }
}

// Start monitoring selected farm
function startMonitoringFarm(farmId) {
    // Stop previous listeners if any
    if (farmDataRef) {
        farmDataRef.off();
    }
    
    // Set up new listener
    farmDataRef = database.ref(`farms/${farmId}`);
    
    // Listen for data changes
    farmDataRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            updateDashboard(data);
        }
    });
    
    console.log(`Started monitoring farm: ${farmId}`);
}

// Stop monitoring farm
function stopMonitoringFarm() {
    if (farmDataRef) {
        farmDataRef.off();
        farmDataRef = null;
    }
    
    // Reset dashboard
    resetDashboard();
    console.log('Stopped monitoring farm');
}

// Update dashboard with data
function updateDashboard(data) {
    // Update sensor values
    const waterLevel = data.sensors?.water || 0;
    const feedLevel = data.sensors?.feed || 0;
    const servo1Pos = data.actuators?.servo1 || 0;
    const servo2Pos = data.actuators?.servo2 || 0;
    const pumpState = data.actuators?.pump || false;
    const connection = data.status?.connection || 'offline';
    const rssi = data.status?.rssi || 0;
    const lastUpdate = data.last_update || 'N/A';
    
    // Update water level
    document.getElementById('waterValue').textContent = `${waterLevel}%`;
    document.getElementById('waterGauge').style.width = `${waterLevel}%`;
    
    // Update feed level
    document.getElementById('feedValue').textContent = `${feedLevel}%`;
    document.getElementById('feedGauge').style.width = `${feedLevel}%`;
    
    // Update servo status
    document.getElementById('servo1Status').innerHTML = 
        servo1Pos === 90 ? 
        '<i class="fas fa-door-open"></i> Open' : 
        '<i class="fas fa-door-closed"></i> Closed';
    
    document.getElementById('servo2Status').innerHTML = 
        servo2Pos === 90 ? 
        '<i class="fas fa-door-open"></i> Open' : 
        '<i class="fas fa-door-closed"></i> Closed';
    
    // Update pump status
    document.getElementById('pumpStatus').innerHTML = 
        pumpState ? 
        '<i class="fas fa-power-off"></i> ON' : 
        '<i class="fas fa-power-off"></i> OFF';
    
    // Update device info
    document.getElementById('deviceId').textContent = selectedFarmId;
    document.getElementById('lastUpdate').textContent = lastUpdate;
    document.getElementById('wifiSignal').textContent = `${rssi} dBm`;
    
    // Update connection status
    if (connection === 'online') {
        connectionStatus.innerHTML = '<i class="fas fa-circle"></i> Online';
        connectionStatus.className = 'status-online';
    } else {
        connectionStatus.innerHTML = '<i class="fas fa-circle"></i> Offline';
        connectionStatus.className = 'status-offline';
    }
    
    // Update sensor status indicators
    updateSensorStatus('water', waterLevel);
    updateSensorStatus('feed', feedLevel);
    
    // Update alerts
    updateAlerts(waterLevel, feedLevel);
    
    // Add to logs
    addLogEntry(`Data updated: Water ${waterLevel}%, Feed ${feedLevel}%`);
}

// Reset dashboard
function resetDashboard() {
    document.getElementById('waterValue').textContent = '0%';
    document.getElementById('waterGauge').style.width = '0%';
    document.getElementById('feedValue').textContent = '0%';
    document.getElementById('feedGauge').style.width = '0%';
    document.getElementById('servo1Status').innerHTML = '<i class="fas fa-door-closed"></i> Closed';
    document.getElementById('servo2Status').innerHTML = '<i class="fas fa-door-closed"></i> Closed';
    document.getElementById('pumpStatus').innerHTML = '<i class="fas fa-power-off"></i> OFF';
    document.getElementById('deviceId').textContent = 'N/A';
    document.getElementById('lastUpdate').textContent = 'N/A';
    document.getElementById('wifiSignal').textContent = 'N/A';
    connectionStatus.innerHTML = '<i class="fas fa-circle"></i> Offline';
    connectionStatus.className = 'status-offline';
}

// Update sensor status
function updateSensorStatus(type, value) {
    const statusElement = document.getElementById(`${type}Status`);
    
    if (type === 'water') {
        if (value < 30) {
            statusElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Critical';
            statusElement.className = 'status-critical';
        } else if (value < 70) {
            statusElement.innerHTML = '<i class="fas fa-exclamation-circle"></i> Warning';
            statusElement.className = 'status-warning';
        } else {
            statusElement.innerHTML = '<i class="fas fa-check-circle"></i> Normal';
            statusElement.className = 'status-normal';
        }
    } else if (type === 'feed') {
        if (value < 20) {
            statusElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Critical';
            statusElement.className = 'status-critical';
        } else if (value < 50) {
            statusElement.innerHTML = '<i class="fas fa-exclamation-circle"></i> Warning';
            statusElement.className = 'status-warning';
        } else {
            statusElement.innerHTML = '<i class="fas fa-check-circle"></i> Normal';
            statusElement.className = 'status-normal';
        }
    }
}

// Update alerts
function updateAlerts(waterLevel, feedLevel) {
    const alertsContainer = document.getElementById('alertsContainer');
    alertsContainer.innerHTML = '';
    
    if (waterLevel < 30) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger';
        alert.innerHTML = '<i class="fas fa-exclamation-triangle"></i> CRITICAL: Water level very low!';
        alertsContainer.appendChild(alert);
    } else if (waterLevel < 70) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-warning';
        alert.innerHTML = '<i class="fas fa-exclamation-circle"></i> WARNING: Water level low';
        alertsContainer.appendChild(alert);
    }
    
    if (feedLevel < 20) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger';
        alert.innerHTML = '<i class="fas fa-exclamation-triangle"></i> CRITICAL: Feed level very low!';
        alertsContainer.appendChild(alert);
    } else if (feedLevel < 50) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-warning';
        alert.innerHTML = '<i class="fas fa-exclamation-circle"></i> WARNING: Feed level low';
        alertsContainer.appendChild(alert);
    }
    
    if (alertsContainer.children.length === 0) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-info';
        alert.innerHTML = '<i class="fas fa-info-circle"></i> No active alerts';
        alertsContainer.appendChild(alert);
    }
}

// Add log entry
function addLogEntry(message) {
    const logsContainer = document.getElementById('logsContainer');
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    const timestamp = new Date().toLocaleTimeString();
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    logsContainer.insertBefore(logEntry, logsContainer.firstChild);
    
    // Keep only last 10 logs
    if (logsContainer.children.length > 10) {
        logsContainer.removeChild(logsContainer.lastChild);
    }
}

// Update uptime display
function updateUptime() {
    const hours = Math.floor(deviceUptime / 3600);
    const minutes = Math.floor((deviceUptime % 3600) / 60);
    const seconds = deviceUptime % 60;
    
    document.getElementById('uptime').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Control Servo
function controlServo(action) {
    if (!selectedFarmId) {
        alert('Please select a farm first');
        return;
    }
    
    // This would control servo1 - implement as needed
    addLogEntry(`Servo 1 command: ${action}`);
}

// Control Servo 2
function controlServo2(action) {
    if (!selectedFarmId) {
        alert('Please select a farm first');
        return;
    }
    
    // Send command to Firebase
    const commandRef = database.ref(`farms/${selectedFarmId}/commands/servo2`);
    commandRef.set(action)
        .then(() => {
            addLogEntry(`Servo 2 command sent: ${action}`);
        })
        .catch((error) => {
            console.error('Error sending command:', error);
            addLogEntry(`Error sending servo 2 command: ${error.message}`);
        });
}

// Control Pump
function controlPump(action) {
    if (!selectedFarmId) {
        alert('Please select a farm first');
        return;
    }
    
    // Send command to Firebase
    const commandRef = database.ref(`farms/${selectedFarmId}/commands/pump`);
    commandRef.set(action)
        .then(() => {
            addLogEntry(`Pump command sent: ${action}`);
        })
        .catch((error) => {
            console.error('Error sending command:', error);
            addLogEntry(`Error sending pump command: ${error.message}`);
        });
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', initApp);
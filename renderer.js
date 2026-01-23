const { ipcRenderer } = require('electron');

// --- DOM ELEMENTS ---
const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const dateDisplay = document.getElementById('dateDisplay');
const projectProgressBar = document.getElementById('projectProgressBar');
const projectProgressText = document.getElementById('projectProgressText');

const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');
const themeToggle = document.getElementById('themeToggle');
const colorSwatches = document.querySelectorAll('.color-swatch');

// --- STATE ---
let data;
try {
    data = ipcRenderer.sendSync('data:get') || {};
} catch (e) {
    console.error('Failed to load data:', e);
    data = {};
}

let tasks = Array.isArray(data.tasks) ? data.tasks : [];

const defaultSettings = { theme: 'dark', accent: 'purple', showArchived: false, autoAdvance: false };
let settings;
try {
    settings = { ...defaultSettings, ...(ipcRenderer.sendSync('settings:get') || {}) };
} catch (e) {
    console.error('Failed to load settings:', e);
    settings = defaultSettings;
}

// --- INITIALIZATION ---
function init() {
    updateDate();
    renderTasks();
    updateStats();
    applySettings(settings);
    
    // Default to tasks view
    switchView('tasks');
}

function renderTasks() {
    taskList.innerHTML = '';
    
    const pendingTasks = tasks.filter(t => !t.done);

    if (pendingTasks.length === 0) {
        emptyState.style.display = 'flex';
        emptyState.innerHTML = `<p>No tasks yet. Add one above!</p>`;
    } else {
        emptyState.style.display = 'none';
        pendingTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.done ? 'done' : ''}`;
            li.innerHTML = `
                <span>${task.text}</span>
                <div class="task-actions">
                    <button class="action-btn ${task.focused ? 'active' : ''}" title="${task.focused ? 'Unfocus' : 'Focus'}" onclick="focusTask(${task.id})">
                        <i class="fa-solid fa-crosshairs" style="${task.focused ? 'color: var(--accent-color);' : ''}"></i>
                    </button>
                    <button class="action-btn" onclick="toggleTask(${task.id})">
                        <i class="fa-${task.done ? 'solid fa-circle-check' : 'regular fa-circle'}"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteTask(${task.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            taskList.appendChild(li);
        });
    }
    updateProgress();
}

function updateProgress() {
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    
    if (projectProgressBar) projectProgressBar.style.width = `${percent}%`;
    if (projectProgressText) projectProgressText.textContent = `${percent}% Complete`;
}

// --- ACTIONS ---

function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;
    
    // VALIDATION: Prevent massive tasks
    if (text.length > 500) {
        alert('Task is too long (max 500 characters).');
        return;
    }

    tasks.push({ id: Date.now(), text, done: false, createdAt: new Date().toISOString() });
    taskInput.value = '';
    saveData();
    renderTasks();
    updateStats();
}

function toggleTask(id) {
    const task = tasks.find(tk => tk.id === id);
    if (task) {
        task.done = !task.done;
        task.completedAt = task.done ? new Date().toISOString() : null;
        if (task.done) triggerConfetti();
        saveData();
        renderTasks();
        updateStats();
    }
}

function deleteTask(id) {
    if (!tasks.some(t => t.id === id)) return; // Safety check
    tasks = tasks.filter(tk => tk.id !== id);
    saveData();
    renderTasks();
    updateStats();
}

function focusTask(id) {
    const task = tasks.find(tk => tk.id === id);
    if (task) {
        task.focused = !task.focused;
        saveData();
        renderTasks();
        
        // Trigger focus mode only if we are focusing a task
        if (task.focused) {
            ipcRenderer.send('app:focus-mode');
        }
    }
}

function saveData() {
    ipcRenderer.send('data:save', { tasks });
}

function updateStats() {
    const now = new Date();
    const today = now.toDateString();
    const thisMonth = now.getMonth() + '-' + now.getFullYear();
    
    const completedTasks = tasks.filter(t => t.done && t.completedAt);
    
    const dailyCount = completedTasks.filter(t => new Date(t.completedAt).toDateString() === today).length;
    const monthlyCount = completedTasks.filter(t => {
        const d = new Date(t.completedAt);
        return d.getMonth() + '-' + d.getFullYear() === thisMonth;
    }).length;
    const totalCount = completedTasks.length;
    
    const statDaily = document.getElementById('statDaily');
    const statMonthly = document.getElementById('statMonthly');
    const statTotal = document.getElementById('statTotal');

    if(statDaily) statDaily.textContent = dailyCount;
    if(statMonthly) statMonthly.textContent = monthlyCount;
    if(statTotal) statTotal.textContent = totalCount;

    // Render Completed History in Stats View
    const statsList = document.getElementById('statsList');
    const statsDetails = document.getElementById('statsDetails');
    const statsDetailsTitle = document.getElementById('statsDetailsTitle');
    const closeStatsBtn = document.getElementById('closeStatsBtn');

    if (statsList && statsDetails) {
        statsList.innerHTML = '';
        // Sort by completedAt descending
        const sortedCompleted = [...completedTasks].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
        
        if (sortedCompleted.length > 0) {
            statsDetails.style.display = 'block';
            if (statsDetailsTitle) statsDetailsTitle.textContent = 'Completed History';
            if (closeStatsBtn) closeStatsBtn.style.display = 'none';

            sortedCompleted.forEach(task => {
                const div = document.createElement('div');
                div.className = 'task-item done';
                const date = new Date(task.completedAt).toLocaleDateString();
                
                div.innerHTML = `
                    <div style="flex: 1; display: flex; flex-direction: column;">
                        <span style="text-decoration: line-through; opacity: 0.7;">${task.text}</span>
                        <span style="font-size: 0.8em; opacity: 0.5;">${date}</span>
                    </div>
                    <div class="task-actions">
                        <button class="action-btn" title="Restore" onclick="toggleTask(${task.id})">
                            <i class="fa-solid fa-rotate-left"></i>
                        </button>
                        <button class="action-btn delete-btn" onclick="deleteTask(${task.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
                statsList.appendChild(div);
            });
        } else {
            statsDetails.style.display = 'none';
        }
    }
}

function updateDate() {
    if (dateDisplay) {
        dateDisplay.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }
}

function triggerConfetti() {
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.top = '-10px';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDuration = Math.random() * 2 + 1 + 's';
    confetti.style.opacity = Math.random();
    document.body.appendChild(confetti);
    
    setTimeout(() => confetti.remove(), 3000);
  }
}

// --- LISTENERS ---
ipcRenderer.on('data:updated', (event, data) => {
    console.log('Main window received data update:', data);
    if (data.tasks) {
        tasks = data.tasks;
        renderTasks();
        updateStats();
    }
});

addTaskBtn?.addEventListener('click', addTask);
taskInput?.addEventListener('keypress', (e) => e.key === 'Enter' && addTask());

const focusModeBtn = document.getElementById('focusModeBtn');
focusModeBtn?.addEventListener('click', () => {
    console.log('Focus Mode button clicked');
    ipcRenderer.send('app:focus-mode');
});

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // If clicking stats, switch to stats view
        // If clicking settings, switch to settings view (if implemented) or just toggle
        // The HTML has data-tab="stats" and data-tab="settings"
        // But we might not have a settings view in the HTML? 
        // Let's check index.html later. For now, assume standard view switching.
        const target = btn.dataset.tab;
        if (target) switchView(target);
    });
});

themeToggle?.addEventListener('change', () => {
    settings.theme = themeToggle.checked ? 'light' : 'dark';
    applySettings(settings);
    ipcRenderer.send('settings:save', settings);
});

colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
        const color = swatch.dataset.color;
        settings.accent = color;
        applySettings(settings);
        ipcRenderer.send('settings:save', settings);
    });
});

// Expose functions to window for onclick handlers in HTML
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.focusTask = focusTask;

// --- VIEW & SETTINGS ---

function switchView(viewName) {
    // If viewName is 'settings', we might not have a view for it in the simplified version
    // But let's try to find it.
    // In the original HTML, there was likely a settings view or it was a modal?
    // The original code had `data-tab="settings"`.
    
    views.forEach(v => v.classList.remove('active'));
    navBtns.forEach(b => b.classList.remove('active'));
    
    // Special case: if viewName is 'tasks', we want the main view.
    // The main view in index.html has id="tasks-view".
    // The button for it? There isn't a button for "Tasks" in the sidebar nav in the original HTML!
    // The original HTML had "Stats" and "Settings" in the nav.
    // The "Projects" list items acted as the "Tasks" view trigger.
    // Since we removed the projects list, we need a way to get back to Tasks view.
    // I should add a "Tasks" button to the sidebar navigation.
    
    const targetView = document.getElementById(`${viewName}-view`);
    const targetBtn = document.querySelector(`.nav-btn[data-tab="${viewName}"]`);
    
    if (targetView) targetView.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');
    
    if (viewName === 'stats') updateStats();
}

function applySettings(s) {
    document.body.className = s.theme === 'light' ? 'light-mode' : '';
    if (themeToggle) themeToggle.checked = s.theme === 'light';
    
    // Apply Accent
    // Remove old accent classes
    document.body.classList.remove('accent-blue', 'accent-green', 'accent-orange', 'accent-pink');
    /* 
    if (s.accent && s.accent !== 'purple') {
        document.body.classList.add(`accent-${s.accent}`);
    } 
    */
    
    // Update active swatch UI
    colorSwatches.forEach(swatch => {
        if (swatch.dataset.color === s.accent) {
            swatch.classList.add('active');
        } else {
            swatch.classList.remove('active');
        }
    });
}

init();

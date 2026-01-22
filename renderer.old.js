const { ipcRenderer } = require('electron');

// --- DOM ELEMENTS ---
const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const focusModeBtn = document.getElementById('focusModeBtn');
const emptyState = document.getElementById('emptyState');
const dateDisplay = document.getElementById('dateDisplay');
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

const projectsList = document.getElementById('projectsList');
const addProjectBtn = document.getElementById('addProjectBtn');
const subTabsList = document.getElementById('subTabsList');
const addTabBtn = document.getElementById('addTabBtn');
const currentProjectTitle = document.getElementById('currentProjectTitle');
const projectProgressBar = document.getElementById('projectProgressBar');
const projectProgressText = document.getElementById('projectProgressText');

const statDaily = document.getElementById('statDaily');
const statMonthly = document.getElementById('statMonthly');
const statYearly = document.getElementById('statYearly');
const statTotal = document.getElementById('statTotal');
const statsDetails = document.getElementById('statsDetails');
const statsDetailsTitle = document.getElementById('statsDetailsTitle');
const statsList = document.getElementById('statsList');
const closeStatsBtn = document.getElementById('closeStatsBtn');
const statCards = document.querySelectorAll('.stat-card');

const themeToggle = document.getElementById('themeToggle');
const colorSwatches = document.querySelectorAll('.color-swatch');
const showArchivedToggle = document.getElementById('showArchivedToggle');
const autoAdvanceToggle = document.getElementById('autoAdvanceToggle');

// Modal Elements
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalInput = document.getElementById('modalInput');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

// --- STATE ---
let data = ipcRenderer.sendSync('data:get');
let projects = data.projects || [];
let activeContext = data.activeContext || { projectId: null, tabId: null };
let selectedModalColor = 'purple';
let modalCallback = null;

const defaultSettings = { theme: 'dark', accent: 'purple', showArchived: false, autoAdvance: false };
let settings = { ...defaultSettings, ...(ipcRenderer.sendSync('settings:get') || {}) };

// --- INITIALIZATION ---
function init() {
    updateDate();
    
    // Safety check: if projects exist but activeContext is empty
    if (projects.length > 0 && !activeContext.projectId) {
        switchProject(projects[0].id);
    } else {
        renderAll();
    }

    updateStats();
    applySettings(settings);
}

function renderAll() {
    renderProjects();
    renderTabs();
    renderTasks();
}

// --- CORE FUNCTIONS ---

function openNewProjectFlow() {
    selectedModalColor = 'purple';
    showModal('New Project', 'Enter project name...', (name, color) => {
        const newProject = {
            id: Date.now(),
            name: name,
            color: color,
            isPinned: false,
            archived: false,
            tabs: [{ id: Date.now() + 1, name: 'General', tasks: [] }]
        };
        projects.push(newProject);
        saveData();
        switchProject(newProject.id); // switchProject calls renderAll
    }, true);
}

function renderProjects() {
    projectsList.innerHTML = '';
    
    if (projects.length === 0) {
        projectsList.innerHTML = `
            <div class="empty-sidebar-state" style="padding: 20px; text-align: center;">
                <p style="font-size: 13px; opacity: 0.6; margin-bottom: 10px;">No projects found</p>
                <button id="first-project-btn" class="primary-btn" style="width: 100%;">+ Create Project</button>
            </div>
        `;
        document.getElementById('first-project-btn')?.addEventListener('click', openNewProjectFlow);
        return;
    }

    const sortedProjects = [...projects].sort((a, b) => (b.isPinned - a.isPinned) || (b.id - a.id));

    sortedProjects.forEach(project => {
        if (project.archived && !settings.showArchived) return;

        const total = project.tabs.reduce((sum, t) => sum + t.tasks.length, 0);
        const done = project.tabs.reduce((sum, t) => sum + t.tasks.filter(tk => tk.done).length, 0);
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;

        const item = document.createElement('div');
        item.className = `project-item ${project.id === activeContext.projectId ? 'active' : ''}`;
        item.onclick = () => switchProject(project.id);

        item.innerHTML = `
            <div class="project-tile" style="--project-color: ${getHexColor(project.color)}">
                <i data-lucide="${getProjectIcon(project.name)}"></i>
            </div>
            <div class="project-text-container">
                <span class="project-name">${project.name}</span>
                <span class="project-meta">${total - done} tasks | ${percent}%</span>
            </div>
            <div class="project-actions" onclick="event.stopPropagation()">
                <button class="project-action-btn ${project.isPinned ? 'active' : ''}" onclick="toggleProjectPin(${project.id})">
                    <i class="fa-solid fa-thumbtack"></i>
                </button>
                <button class="project-action-btn" onclick="deleteProject(${project.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        projectsList.appendChild(item);
    });
    if (window.lucide) window.lucide.createIcons();
}

function renderTasks() {
    taskList.innerHTML = '';
    const project = projects.find(p => p.id === activeContext.projectId);
    const tab = project?.tabs.find(t => t.id === activeContext.tabId);

    // FIX: Re-enable/Disable logic
    if (!project || !tab) {
        taskInput.disabled = true;
        addTaskBtn.disabled = true;
        emptyState.style.display = 'flex';
        emptyState.innerHTML = `<p>Select or create a project to start</p>`;
        return;
    }

    taskInput.disabled = false;
    addTaskBtn.disabled = false;
    
    if (tab.tasks.length === 0) {
        emptyState.style.display = 'flex';
        emptyState.innerHTML = `<p>No tasks yet. Add one above!</p>`;
    } else {
        emptyState.style.display = 'none';
        tab.tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.done ? 'done' : ''}`;
            li.innerHTML = `
                <span>${task.text}</span>
                <div class="task-actions">
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
}

function renderTabs() {
    subTabsList.innerHTML = '';
    const project = projects.find(p => p.id === activeContext.projectId);
    
    if (!project) {
        currentProjectTitle.textContent = "FocusTask";
        addTabBtn.style.display = 'none';
        return;
    }

    addTabBtn.style.display = 'block';
    currentProjectTitle.textContent = project.name;
    updateProgress(project);

    project.tabs.forEach(tab => {
        const btn = document.createElement('div');
        btn.className = `tab-item ${tab.id === activeContext.tabId ? 'active' : ''}`;
        btn.innerHTML = `<span>${tab.name}</span>`;
        btn.onclick = () => switchTab(tab.id);
        subTabsList.appendChild(btn);
    });
}

// --- EVENT HANDLERS ---

function switchProject(id) {
    activeContext.projectId = id;
    const project = projects.find(p => p.id === id);
    if (project && project.tabs.length > 0) {
        activeContext.tabId = project.tabs[0].id;
    }
    saveData();
    renderAll();
}

function switchTab(id) {
    activeContext.tabId = id;
    saveData();
    renderAll();
}

function deleteProject(id) {
    if (!confirm("Delete this project and all tasks?")) return;
    projects = projects.filter(p => p.id !== id);
    if (activeContext.projectId === id) {
        activeContext.projectId = projects.length > 0 ? projects[0].id : null;
        activeContext.tabId = (activeContext.projectId && projects[0].tabs.length > 0) ? projects[0].tabs[0].id : null;
    }
    saveData();
    renderAll();
}

function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;
    const project = projects.find(p => p.id === activeContext.projectId);
    const tab = project?.tabs.find(t => t.id === activeContext.tabId);
    
    if (tab) {
        tab.tasks.push({ id: Date.now(), text, done: false, createdAt: new Date().toISOString() });
        taskInput.value = '';
        saveData();
        renderAll();
    }
}

function toggleTask(id) {
    const project = projects.find(p => p.id === activeContext.projectId);
    const tab = project?.tabs.find(t => t.id === activeContext.tabId);
    const task = tab?.tasks.find(tk => tk.id === id);
    
    if (task) {
        task.done = !task.done;
        task.completedAt = task.done ? new Date().toISOString() : null;
        if (task.done) triggerConfetti();
        saveData();
        renderAll();
    }
}

function deleteTask(id) {
    const project = projects.find(p => p.id === activeContext.projectId);
    const tab = project?.tabs.find(t => t.id === activeContext.tabId);
    if (tab) {
        tab.tasks = tab.tasks.filter(tk => tk.id !== id);
        saveData();
        renderAll();
    }
}

// --- MODAL ENGINE ---
function showModal(title, placeholder, callback, showColorPicker = false) {
    modalTitle.textContent = title;
    modalInput.placeholder = placeholder;
    modalInput.value = '';
    modalCallback = callback;
    modalOverlay.style.display = 'flex';

    // Handle Color Picker injection
    const picker = document.querySelector('.modal-color-options');
    if (picker) picker.style.display = showColorPicker ? 'flex' : 'none';

    setTimeout(() => modalInput.focus(), 50);
}

function hideModal() {
    modalOverlay.style.display = 'none';
    modalCallback = null;
}

modalConfirmBtn.onclick = () => {
    const val = modalInput.value.trim();
    if (val && modalCallback) {
        modalCallback(val, selectedModalColor);
        hideModal();
    }
};

// --- HELPERS ---
function getHexColor(name) {
    const colors = { purple: '#7c4dff', blue: '#2979ff', green: '#00e676', orange: '#ff9100', pink: '#f50057' };
    return colors[name] || colors.purple;
}

function getProjectIcon(name) {
    const n = name.toLowerCase();
    if (n.includes('work')) return 'briefcase';
    if (n.includes('school') || n.includes('study')) return 'graduation-cap';
    return 'folder';
}

function saveData() {
    ipcRenderer.send('data:save', { projects, activeContext });
}

function updateDate() {
    dateDisplay.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
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
addProjectBtn?.addEventListener('click', openNewProjectFlow);
addTaskBtn?.addEventListener('click', addTask);
taskInput?.addEventListener('keypress', (e) => e.key === 'Enter' && addTask());
modalCancelBtn.onclick = hideModal;

init();
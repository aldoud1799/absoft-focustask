const { ipcRenderer } = require('electron');

const tasksListEl = document.getElementById('tasksList');
const restoreBtn = document.getElementById('restoreBtn');
const closeBtn = document.getElementById('closeBtn');
const quickAddBtn = document.getElementById('quickAddBtn');
const toggleClickThroughBtn = document.getElementById('toggleClickThroughBtn');
const progressBar = document.getElementById('widgetProgressBar');
const widgetContainer = document.querySelector('.widget-container');
const controls = document.querySelector('.controls');

let tasks = [];
let clickThroughEnabled = false;

// Initial load
try {
  console.log('Widget initializing...');
  const initialData = ipcRenderer.sendSync('data:get') || {};
  console.log('Widget initial data:', initialData);
  tasks = Array.isArray(initialData.tasks) ? initialData.tasks : [];
  let settings = ipcRenderer.sendSync('settings:get') || {};
  console.log('Widget initial settings:', settings);

  applySettings(settings);
  updateDisplay();
} catch (error) {
  console.error('Widget initialization error:', error);
}

function applySettings(newSettings) {
  // Apply Theme
  if (newSettings.theme === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }

  // Apply Accent
  document.body.className = document.body.className.replace(/accent-\w+/g, ''); // Remove old accent
  /*
  if (newSettings.accent && newSettings.accent !== 'purple') {
    document.body.classList.add(`accent-${newSettings.accent}`);
  }
  */
  
  // Update progress bar color
  if (progressBar) {
      const colors = {
          purple: '#7c4dff',
          blue: '#2979ff',
          green: '#00e676',
          orange: '#ff9100',
          pink: '#f50057'
      };
      // progressBar.style.background = colors[newSettings.accent] || '#7c4dff';
  }
}

function updateDisplay() {
  // Find incomplete tasks
  const pendingTasks = tasks.filter(t => !t.done);
  
  // Filter for explicitly focused tasks
  const focusedTasks = pendingTasks.filter(t => t.focused);
  
  // Decide what to show: Focused tasks take priority. 
  // If no tasks are focused, show top pending tasks as fallback (or show nothing if preferred, but fallback is safer).
  // User said "remove the infocused task from the widget", implying strict filtering.
  // Let's show focused tasks if any exist. If NONE exist, show the top 1 as a "Next Up" suggestion, or maybe just empty?
  // Let's try showing ONLY focused tasks if any are focused. If none are focused, show top 3 normal tasks.
  
  let tasksToShow = [];
  let isFocusedMode = false;
  
  if (focusedTasks.length > 0) {
    tasksToShow = focusedTasks;
    isFocusedMode = true;
  } else {
    tasksToShow = pendingTasks.slice(0, 3);
  }
  
  // Clear list
  tasksListEl.innerHTML = '';

  if (tasksToShow.length > 0) {
    
    tasksToShow.forEach((task, index) => {
      const taskItem = document.createElement('div');
      taskItem.className = 'task-item';
      
      const btn = document.createElement('button');
      btn.className = 'circle-btn';
      btn.title = 'Complete Task';
      btn.onclick = () => {
        ipcRenderer.send('task:complete', task.id);
      };
      
      const content = document.createElement('div');
      content.style.display = 'flex';
      content.style.flexDirection = 'column';
      content.style.flex = '1';
      
      if (index === 0) {
        const context = document.createElement('span');
        context.className = 'context-text';
        context.textContent = isFocusedMode ? 'Focused Tasks' : 'Next Up';
        content.appendChild(context);
      }
      
      const text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = task.text;
      content.appendChild(text);
      
      taskItem.appendChild(btn);
      taskItem.appendChild(content);
      tasksListEl.appendChild(taskItem);
    });
    
    // If we are in fallback mode and have more tasks, show count
    if (!isFocusedMode && pendingTasks.length > 3) {
       const more = document.createElement('div');
       more.className = 'context-text';
       more.style.textAlign = 'center';
       more.textContent = `+ ${pendingTasks.length - 3} more tasks`;
       tasksListEl.appendChild(more);
    }

  } else {
    const empty = document.createElement('div');
    empty.className = 'empty-text';
    empty.textContent = 'All tasks completed!';
    tasksListEl.appendChild(empty);
  }
  
  // Update Progress Bar
  if (progressBar) {
      const total = tasks.length;
      const done = tasks.filter(t => t.done).length;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;
      progressBar.style.width = `${percent}%`;
  }

  // Resize widget to fit content
  requestAnimationFrame(() => {
    const height = document.body.scrollHeight;
    ipcRenderer.send('widget:resize', height);
  });
}

// Click-Through Logic
toggleClickThroughBtn?.addEventListener('click', () => {
  clickThroughEnabled = !clickThroughEnabled;
  updateClickThroughState();
});

function updateClickThroughState() {
  if (clickThroughEnabled) {
    ipcRenderer.send('widget:set-ignore-mouse', true);
    widgetContainer.classList.add('click-through');
    toggleClickThroughBtn.innerHTML = '<i data-lucide="eye-off"></i>';
    toggleClickThroughBtn.style.color = 'var(--accent-color)';
  } else {
    ipcRenderer.send('widget:set-ignore-mouse', false);
    widgetContainer.classList.remove('click-through');
    toggleClickThroughBtn.innerHTML = '<i data-lucide="eye"></i>';
    toggleClickThroughBtn.style.color = '';
  }
  if (window.lucide) window.lucide.createIcons();
}

// Hover Magic: Temporarily enable mouse events when hovering controls
controls?.addEventListener('mouseenter', () => {
  if (clickThroughEnabled) {
    ipcRenderer.send('widget:set-ignore-mouse', false);
  }
});

controls?.addEventListener('mouseleave', () => {
  if (clickThroughEnabled) {
    ipcRenderer.send('widget:set-ignore-mouse', true);
  }
});

// Alt Key Backup
window.addEventListener('keydown', (e) => {
  if (e.key === 'Alt' && clickThroughEnabled) {
    ipcRenderer.send('widget:set-ignore-mouse', false);
    widgetContainer.classList.remove('click-through'); // Visual feedback
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Alt' && clickThroughEnabled) {
    ipcRenderer.send('widget:set-ignore-mouse', true);
    widgetContainer.classList.add('click-through');
  }
});

// Listen for data updates
ipcRenderer.on('data:updated', (event, data) => {
  console.log('Widget received data update:', data);
  tasks = data.tasks || [];
  updateDisplay();
});

ipcRenderer.on('settings:updated', (event, newSettings) => {
  console.log('Widget received settings update:', newSettings);
  settings = newSettings;
  applySettings(settings);
});

// Removed single completeBtn listener as we now have dynamic buttons
// completeBtn.addEventListener('click', () => { ... });

restoreBtn.addEventListener('click', () => {
  ipcRenderer.send('app:restore');
});

quickAddBtn?.addEventListener('click', () => {
  ipcRenderer.send('quick-add:open');
});

closeBtn.addEventListener('click', () => {
  ipcRenderer.send('widget:close');
});

if (window.lucide) window.lucide.createIcons();

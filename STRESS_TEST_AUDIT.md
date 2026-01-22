# Stress Test Audit Report

## Executive Summary
This audit identified 5 critical scenarios where the application could crash, freeze, or lose data. Remediation steps have been applied to the codebase to ensure stability under stress conditions.

## Identified Crash Scenarios

### 1. IPC Sync Freeze on Initialization
**Severity:** Critical (App Crash/White Screen)
**Scenario:** If the main process fails to return a value for `ipcRenderer.sendSync('data:get')` (returns `null` or `undefined`) due to a store read error or race condition, the renderer process throws `TypeError: Cannot read property 'tasks' of null` immediately upon launch.
**Fix Applied:** Added `try-catch` blocks and default value fallbacks (`|| {}`) in `renderer.js` and `widget.js`.

### 2. Malformed Data Structure (The "Manual Check" Crash)
**Severity:** High (App Crash)
**Scenario:** If the persistent storage file (`user-preferences.json`) is manually edited or corrupted such that "tasks" becomes an Object instead of an Array, the `renderTasks` function crashes with `tasks.filter is not a function`.
**Fix Applied:** Enforced type checking `Array.isArray(tasks)` during initialization.

### 3. Input Flood (Denial of Service)
**Severity:** Medium (UI Freeze)
**Scenario:** A user pasting a 10MB string into the "Add Task" input would freeze the renderer process during DOM creation, potentially crashing the window.
**Fix Applied:** Added validation in `addTask` to limit input length to 500 characters.

### 4. Delete Race Condition
**Severity:** Medium (Action Failure)
**Scenario:** If a user clicks the "Delete" button twice rapidly (before the UI updates), the second click attempts to delete an ID that no longer exists in the state. While `filter` handles this gracefully, subsequent operations or stats updates might operate on undefined data depending on implementation changes.
**Fix Applied:** Added an existence check `tasks.some(t => t.id === id)` before proceeding with deletion.

### 5. Silent Data Loss on Corruption
**Severity:** Critical (Data Loss)
**Scenario:** If `user-preferences.json` has a syntax error, the app loads "default" empty data. When the user saves a new task, it **overwrites** the corrupted file, permanently destroying the user's previous data which might have been recoverable.
**Fix Applied:** Modified `store.js` to automatically backup the corrupted file (`.corrupted.<timestamp>`) before returning defaults, preserving the original data for recovery.

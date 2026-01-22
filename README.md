# FocusTask

FocusTask is a desktop application designed to help you focus on one task at a time.

## Features

- **Task Management**: Add, edit, and delete tasks in a clean interface.
- **Task Prioritization**: Star important tasks to keep them at the top.
- **Focus Mode**: Launch a floating, always-on-top widget that shows only your current task (prioritizing starred tasks).
- **Stats & Analytics**: Track your daily, monthly, and yearly productivity.
- **Customizable**: Dark/Light mode and accent colors.
- **Keyboard Shortcuts**:
  - `Cmd/Ctrl + Alt + N`: Add new task
  - `Cmd/Ctrl + Alt + W`: Toggle Widget
  - `Cmd/Ctrl + Alt + K`: Toggle Main Window
  - `Escape`: Close modals and panels

## How to Run

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Start the application:
    ```bash
    npm start
    ```

## Development

- Built with Electron.
- Data is stored locally in `user-preferences.json`.
- Backups are created automatically.

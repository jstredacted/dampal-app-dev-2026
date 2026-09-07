const STORAGE_KEY = "dampal-prelim-tasks";

// The task list and loading flag are the app's single source of truth.
let state = {
  tasks: [],
  nextId: 1,
  isDeleting: false,
  canUseStorage: true
};

const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const addButton = document.getElementById("add-button");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const taskSummary = document.getElementById("task-summary");
const inputError = document.getElementById("input-error");
const storageError = document.getElementById("storage-error");
const statusMessage = document.getElementById("status-message");
const deleteAllButton = document.getElementById("delete-all-button");

function loadTasks() {
  try {
    const savedTasks = localStorage.getItem(STORAGE_KEY);
    if (savedTasks !== null) {
      const tasks = JSON.parse(savedTasks);
      // Do not overwrite saved data if it cannot be read as a task list.
      if (!Array.isArray(tasks)) {
        throw new Error("Invalid task list");
      }
      for (let task of tasks) {
        if (!task || typeof task.id !== "number" ||
            typeof task.name !== "string" || task.name.trim() === "" ||
            typeof task.completed !== "boolean") {
          throw new Error("Invalid task");
        }
      }
      state.tasks = tasks;
      for (let task of state.tasks) {
        if (task.id >= state.nextId) {
          state.nextId = task.id + 1;
        }
      }
    }
  } catch (error) {
    state.canUseStorage = false;
    storageError.textContent =
      "Your saved list could not be read. Check browser storage access or saved data, then reload. Nothing has been overwritten.";
    statusMessage.textContent = "Storage needs attention.";
  }
}

// Save first so a storage failure does not pretend a change was successful.
function saveTasks(tasks) {
  try {
    if (tasks.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }
    state.tasks = tasks;
    storageError.textContent = "";
    return true;
  } catch (error) {
    storageError.textContent =
      "This change could not be saved. Your list has not changed. Check browser storage access and try again.";
    return false;
  }
}

function render() {
  taskList.innerHTML = "";
  const controlsDisabled = state.isDeleting || !state.canUseStorage;
  let completedCount = 0;

  for (let task of state.tasks) {
    const item = document.createElement("li");
    item.className = task.completed ? "task-item completed" : "task-item";
    item.innerHTML = `
      <label class="task-label">
        <input class="task-checkbox" type="checkbox">
        <span class="task-name"></span>
      </label>
      <span class="task-status"></span>
      <button class="delete-button" type="button">Delete</button>
    `;

    // User input is text, never HTML.
    item.querySelector(".task-name").textContent = task.name;
    item.querySelector(".task-status").textContent = task.completed ? "Done" : "To do";
    const checkbox = item.querySelector(".task-checkbox");
    checkbox.id = `task-${task.id}`;
    checkbox.checked = task.completed;
    checkbox.disabled = controlsDisabled;
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const deleteButton = item.querySelector(".delete-button");
    deleteButton.setAttribute("aria-label", `Delete task: ${task.name}`);
    deleteButton.disabled = controlsDisabled;
    deleteButton.addEventListener("click", () => deleteTask(task.id));
    taskList.appendChild(item);

    if (task.completed) {
      completedCount += 1;
    }
  }

  const taskWord = state.tasks.length === 1 ? "task" : "tasks";
  taskSummary.textContent = `${state.tasks.length} ${taskWord} · ${completedCount} done`;
  emptyState.hidden = state.tasks.length !== 0 || !state.canUseStorage;
  taskInput.disabled = controlsDisabled;
  addButton.disabled = controlsDisabled;
  deleteAllButton.disabled = controlsDisabled || state.tasks.length === 0;
  deleteAllButton.textContent = state.isDeleting ? "Deleting…" : "Delete all";
  taskList.setAttribute("aria-busy", state.isDeleting);
}

function addTask(event) {
  event.preventDefault();
  if (state.isDeleting || !state.canUseStorage) {
    return;
  }

  const name = taskInput.value.trim();
  if (name === "") {
    inputError.textContent = "Please write a task before adding it.";
    taskInput.setAttribute("aria-invalid", "true");
    taskInput.focus();
    return;
  }

  const task = { id: state.nextId, name: name, completed: false };
  const tasks = state.tasks.concat(task);
  if (saveTasks(tasks)) {
    state.nextId += 1;
    taskInput.value = "";
    clearInputError();
    render();
    statusMessage.textContent = "Task added.";
    taskInput.focus();
  }
}

function clearInputError() {
  inputError.textContent = "";
  taskInput.removeAttribute("aria-invalid");
}

function toggleTask(id) {
  if (state.isDeleting || !state.canUseStorage) {
    return;
  }
  let completed = false;
  const tasks = state.tasks.map((task) => {
    if (task.id === id) {
      completed = !task.completed;
      return { id: task.id, name: task.name, completed: completed };
    }
    return task;
  });
  if (saveTasks(tasks)) {
    statusMessage.textContent = completed
      ? "Task marked done."
      : "Task marked to do.";
  }
  render();
  document.getElementById(`task-${id}`).focus();
}

function deleteTask(id) {
  if (state.isDeleting || !state.canUseStorage) {
    return;
  }
  const tasks = state.tasks.filter((task) => task.id !== id);
  if (saveTasks(tasks)) {
    render();
    statusMessage.textContent = "Task deleted.";
    taskInput.focus();
  }
}

function deleteAllTasks() {
  if (state.isDeleting || !state.canUseStorage || state.tasks.length === 0) {
    return;
  }
  state.isDeleting = true;
  clearInputError();
  statusMessage.textContent = "Deleting…";
  render();

  // The callback runs later; the browser is not frozen during the wait.
  setTimeout(() => {
    const saved = saveTasks([]);
    state.isDeleting = false;
    render();
    statusMessage.textContent = saved
      ? "All tasks deleted."
      : "Deletion was not saved. Your tasks are still here.";
    taskInput.focus();
  }, 2000);
}

taskForm.addEventListener("submit", addTask);
taskInput.addEventListener("input", clearInputError);
deleteAllButton.addEventListener("click", deleteAllTasks);

loadTasks();
render();

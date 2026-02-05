// --- Config & State ---
const TOKEN_KEY = "bhml-admin-token";
let currentFilePath = null;
let editorInstance = null;
let originalContent = "";

// DOM Elements
const loginView = document.getElementById("login-view");
const editorView = document.getElementById("editor-view");
const loginInput = document.getElementById("login-input");
const loginMsg = document.getElementById("login-message");
const fileList = document.getElementById("file-list");
const saveBtn = document.getElementById("save-btn");
const statusMsg = document.getElementById("status-msg");
const filenameLabel = document.getElementById("current-filename");
const unsavedDot = document.getElementById("unsaved-indicator");

// --- Monaco Setup ---
require.config({
  paths: {
    vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs",
  },
});

const initMonaco = () => {
  return new Promise((resolve) => {
    require(["vs/editor/editor.main"], function () {
      editorInstance = monaco.editor.create(
        document.getElementById("monaco-container"),
        {
          value: "",
          language: "plaintext",
          theme: "vs-dark",
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
        }
      );

      // Listen for changes
      editorInstance.onDidChangeModelContent(() => {
        const isDirty = editorInstance.getValue() !== originalContent;
        unsavedDot.classList.toggle("hidden", !isDirty);
        saveBtn.disabled = !isDirty;
      });

      // Key binding for Ctrl+S
      editorInstance.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        saveFile
      );

      resolve();
    });
  });
};

// --- Auth Utils ---
const getToken = () => localStorage.getItem(TOKEN_KEY) || "";

const setHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  "Content-Type": "application/json",
});

const checkAuth = (res) => {
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
    throw new Error("Unauthorized");
  }
  return res;
};

// --- View Switching ---
const showLogin = () => {
  loginView.classList.remove("hidden");
  editorView.classList.add("hidden");
  loginInput.value = "";
  loginMsg.textContent = "";
};

const showEditor = async () => {
  loginView.classList.add("hidden");
  editorView.classList.remove("hidden");
  if (!editorInstance) {
    await initMonaco();
  }
  loadFiles();
};

const showStatus = (msg, type = "info") => {
  statusMsg.textContent = msg;
  statusMsg.className = `status-msg show ${type}`;
  setTimeout(() => {
    statusMsg.classList.remove("show");
  }, 3000);
};

// --- API Interactions ---
const loadFiles = async () => {
  try {
    const res = await fetch("/api/fs/list", { headers: setHeaders() });
    checkAuth(res);
    const data = await res.json();
    renderFileList(data.files);
  } catch (err) {
    if (err.message !== "Unauthorized") showStatus("Failed to load files", "error");
  }
};

const renderFileList = (files) => {
  fileList.innerHTML = "";
  files.forEach((file) => {
    const ext = file.substring(file.lastIndexOf("."));
    const el = document.createElement("div");
    el.className = "file-item";
    el.dataset.path = file;
    el.dataset.ext = ext;
    el.textContent = file;
    el.onclick = () => openFile(file);
    fileList.appendChild(el);
  });
};

const openFile = async (path) => {
  if (editorInstance.getModel() && editorInstance.getValue() !== originalContent) {
    if (!confirm("You have unsaved changes. Discard them?")) return;
  }

  currentFilePath = path;
  
  // UI active state
  document.querySelectorAll(".file-item").forEach(el => {
    el.classList.toggle("active", el.dataset.path === path);
  });

  filenameLabel.textContent = path;
  showStatus("Loading...", "info");

  try {
    const res = await fetch(`/api/fs/file?path=${encodeURIComponent(path)}`, {
      headers: setHeaders(),
    });
    checkAuth(res);
    if (!res.ok) throw new Error("File not found");

    const data = await res.json();
    originalContent = data.content;
    
    // Determine language
    let lang = "plaintext";
    if (path.endsWith(".html")) lang = "html";
    else if (path.endsWith(".css")) lang = "css";
    else if (path.endsWith(".js")) lang = "javascript";
    else if (path.endsWith(".json")) lang = "json";
    else if (path.endsWith(".py")) lang = "python";

    monaco.editor.setModelLanguage(editorInstance.getModel(), lang);
    editorInstance.setValue(originalContent);
    
    unsavedDot.classList.add("hidden");
    saveBtn.disabled = true;
    showStatus("Loaded", "success");
    
    // Hide empty state
    document.querySelector(".empty-state").style.display = "none";
  } catch (err) {
    showStatus(err.message, "error");
  }
};

const saveFile = async () => {
  if (!currentFilePath) return;

  const content = editorInstance.getValue();
  saveBtn.textContent = "Saving...";
  
  try {
    const res = await fetch(`/api/fs/file?path=${encodeURIComponent(currentFilePath)}`, {
      method: "POST",
      headers: setHeaders(),
      body: JSON.stringify({ content }),
    });
    checkAuth(res);
    
    if (!res.ok) throw new Error("Save error");
    
    originalContent = content;
    unsavedDot.classList.add("hidden");
    saveBtn.disabled = true;
    showStatus("Saved!", "success");
  } catch (err) {
    showStatus(`Error: ${err.message}`, "error");
  } finally {
    saveBtn.textContent = "Save (Ctrl+S)";
  }
};

// --- Event Listeners ---
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = loginInput.value.trim();
  if (!token) return;

  loginMsg.textContent = "Verifying...";
  try {
    localStorage.setItem(TOKEN_KEY, token); // Optimistic save
    const res = await fetch("/api/fs/list", { headers: setHeaders() });
    if (res.ok) {
        showEditor();
    } else {
        throw new Error("Invalid token");
    }
  } catch (err) {
    loginMsg.textContent = "Invalid token or network error.";
    localStorage.removeItem(TOKEN_KEY);
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  location.reload();
});

document.getElementById("save-btn").addEventListener("click", saveFile);

// --- Init ---
const storedToken = getToken();
if (storedToken) {
    // Verify first
    fetch("/api/fs/list", { headers: setHeaders() })
        .then(res => {
            if(res.ok) showEditor();
            else showLogin();
        })
        .catch(() => showLogin());
} else {
    showLogin();
}

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
const pathInput = document.getElementById("path-input");
const openPathBtn = document.getElementById("open-path-btn");
const newFileBtn = document.getElementById("new-file-btn");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");
const quickPathButtons = document.querySelectorAll(".path-chip");
const dropZone = document.getElementById("drop-zone");

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
    const lastDotIndex = file.lastIndexOf(".");
    const ext = lastDotIndex !== -1 ? file.substring(lastDotIndex).toLowerCase() : "";
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
  if (path.endsWith("/")) {
    pathInput.value = path;
    pathInput.focus();
    showStatus("Directory selected", "info");
    return;
  }

  if (editorInstance && editorInstance.getModel() && editorInstance.getValue() !== originalContent) {
    if (!confirm("You have unsaved changes. Discard them?")) return;
  }

  currentFilePath = path;
  
  // UI active state
  document.querySelectorAll(".file-item").forEach(el => {
    el.classList.toggle("active", el.dataset.path === path);
  });

  filenameLabel.textContent = path;
  showStatus("Loading...", "info");

  const lastDotIndex = path.lastIndexOf(".");
  const ext = lastDotIndex !== -1 ? path.substring(lastDotIndex).toLowerCase() : "";
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'];
  const isImage = imageExtensions.includes(ext);

  const previewContainer = document.getElementById("image-preview-container");
  const previewImg = document.getElementById("image-preview");
  const monacoEl = document.getElementById("monaco-container").querySelector(".monaco-editor");

  if (isImage) {
    // Show image preview
    if (monacoEl) monacoEl.style.display = "none";
    previewContainer.classList.remove("hidden");
    previewImg.src = `/${path}?t=${Date.now()}`; // Add cache buster
    
    originalContent = ""; // No text content to track
    unsavedDot.classList.add("hidden");
    saveBtn.disabled = true;
    showStatus("Image Preview", "success");
    document.querySelector(".empty-state").style.display = "none";
    return;
  }

  // Text file logic
  previewContainer.classList.add("hidden");
  if (monacoEl) monacoEl.style.display = "block";

  try {
    const res = await fetch(`/api/fs/file?path=${encodeURIComponent(path)}`, {
      headers: setHeaders(),
    });
    checkAuth(res);
    if (!res.ok) throw new Error("File not found or cannot be read");

    const data = await res.json();
    originalContent = data.content;
    
    // Determine language
    let lang = "plaintext";
    if (ext === ".html") lang = "html";
    else if (ext === ".css") lang = "css";
    else if (ext === ".js") lang = "javascript";
    else if (ext === ".json") lang = "json";
    else if (ext === ".py") lang = "python";

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

const createFile = async (path, content = "") => {
  if (!path) {
    showStatus("请输入文件路径", "error");
    return;
  }

  try {
    const res = await fetch(`/api/fs/file?path=${encodeURIComponent(path)}`, {
      method: "POST",
      headers: setHeaders(),
      body: JSON.stringify({ content }),
    });
    checkAuth(res);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Create failed");
    }

    showStatus("创建成功", "success");
    loadFiles();
    openFile(path);
  } catch (err) {
    showStatus(`Create error: ${err.message}`, "error");
  }
};

const uploadFile = async (file, path) => {
  if (!path) {
    showStatus("请输入保存路径", "error");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("path", path);

  showStatus("Uploading...", "info");

  try {
    const res = await fetch("/api/fs/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
      body: formData,
    });
    checkAuth(res);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Upload failed");
    }

    showStatus(`已上传到 ${path}`, "success");
    loadFiles();
  } catch (err) {
    showStatus(`Upload error: ${err.message}`, "error");
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

quickPathButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const base = btn.dataset.path || "";
    pathInput.value = base;
    pathInput.focus();
  });
});

openPathBtn.addEventListener("click", () => {
  const path = pathInput.value.trim();
  if (path) {
    openFile(path);
  }
});

newFileBtn.addEventListener("click", () => {
  const path = pathInput.value.trim();
  if (path) {
    createFile(path);
  } else {
    showStatus("请输入文件路径", "error");
  }
});

uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    const file = e.target.files[0];
    const defaultPath = file.name;
    const path = (pathInput.value || defaultPath).trim();
    uploadFile(file, path);
    e.target.value = "";
  }
});

if (dropZone) {
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("is-active");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("is-active");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("is-active");

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const defaultPath = file.name;
    const path = (pathInput.value || defaultPath).trim();
    uploadFile(file, path);
  });
}

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

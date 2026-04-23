'use strict';

// ─── State ───────────────────────────────────────────────────────────────────

let vaultPath = null;
let currentFilePath = null;
let qEditor = null;
let nEditor = null;
let qMarks = [];
let nMarks = [];
let saveTimer = null;
let isLoading = false;

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initEditors();
  bindUI();
  loadVaultState();
});

function bindUI() {
  document.getElementById('open-vault-btn').addEventListener('click', openVault);
  document.getElementById('change-vault-btn').addEventListener('click', showVaultDialog);
  document.getElementById('new-note-btn').addEventListener('click', newNote);
  document.getElementById('vault-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') openVault();
  });
}

// ─── Editors ──────────────────────────────────────────────────────────────────

function initEditors() {
  const cfg = {
    mode: 'markdown',
    lineWrapping: true,
    indentUnit: 2,
    tabSize: 2,
    extraKeys: { Enter: 'newlineAndIndentContinueMarkdownList' }
  };

  qEditor = CodeMirror(document.getElementById('questions-editor'), cfg);
  nEditor = CodeMirror(document.getElementById('notes-editor'), cfg);

  qEditor.on('change', onEditorChange);
  nEditor.on('change', onEditorChange);

  qEditor.getWrapperElement().addEventListener('mousedown', handleQuestionsMousedown);
  nEditor.getWrapperElement().addEventListener('mousedown', handleNotesMousedown);
}

function onEditorChange() {
  if (isLoading) return;
  updateMarks();
  scheduleAutoSave();
}

// ─── Vault ────────────────────────────────────────────────────────────────────

async function loadVaultState() {
  const data = await apiFetch('/api/vault');
  if (data.vaultPath) {
    vaultPath = data.vaultPath;
    document.getElementById('vault-path').textContent = prettyPath(vaultPath);
    document.getElementById('vault-overlay').classList.add('hidden');
    await loadFiles();
  } else {
    showVaultDialog();
  }
}

function showVaultDialog() {
  document.getElementById('vault-input').value = vaultPath || '';
  document.getElementById('vault-error').textContent = '';
  document.getElementById('vault-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('vault-input').focus(), 50);
}

async function openVault() {
  const inputPath = document.getElementById('vault-input').value.trim();
  if (!inputPath) return;

  const res = await fetch('/api/vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaultPath: inputPath })
  });
  const data = await res.json();

  if (res.ok) {
    vaultPath = data.vaultPath;
    document.getElementById('vault-path').textContent = prettyPath(vaultPath);
    document.getElementById('vault-overlay').classList.add('hidden');
    await loadFiles();
  } else {
    document.getElementById('vault-error').textContent = data.error || 'Invalid path';
  }
}

function prettyPath(p) {
  const parts = p.split('/');
  if (parts[1] === 'Users' && parts[2]) {
    return '~/' + parts.slice(3).join('/');
  }
  return p;
}

// ─── File List ────────────────────────────────────────────────────────────────

async function loadFiles() {
  const data = await apiFetch('/api/files');
  const list = document.getElementById('file-list');
  list.innerHTML = '';

  data.files
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(file => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.textContent = file.name.replace(/\.md$/, '');
      item.dataset.path = file.path;
      if (file.path === currentFilePath) item.classList.add('active');
      item.addEventListener('click', () => openFile(file.path, file.name));
      list.appendChild(item);
    });
}

// ─── Open / New File ─────────────────────────────────────────────────────────

async function openFile(filePath, name) {
  if (currentFilePath && saveTimer) {
    clearTimeout(saveTimer);
    await saveFile();
  }

  isLoading = true;
  currentFilePath = filePath;
  document.getElementById('current-file').textContent = name.replace(/\.md$/, '');

  document.querySelectorAll('.file-item').forEach(el => {
    el.classList.toggle('active', el.dataset.path === filePath);
  });

  const data = await apiFetch('/api/file?' + new URLSearchParams({ filePath }));
  const { questions, notes } = parseContent(data.content);

  qEditor.setValue(questions);
  nEditor.setValue(notes);

  isLoading = false;
  updateMarks();
}

async function newNote() {
  if (!vaultPath) return;
  const name = prompt('Note name:');
  if (!name || !name.trim()) return;

  const res = await fetch('/api/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() })
  });
  const data = await res.json();

  if (res.ok) {
    await loadFiles();
    await openFile(data.filePath, data.name);
  } else {
    alert(data.error || 'Could not create note');
  }
}

// ─── Content ─────────────────────────────────────────────────────────────────

function parseContent(content) {
  const lines = content.split('\n');
  let qIdx = -1, nIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trimEnd();
    if (t === '# Questions' && qIdx === -1) qIdx = i;
    if (t === '# Notes' && nIdx === -1 && qIdx !== -1) nIdx = i;
  }

  if (qIdx === -1 || nIdx === -1) {
    return { questions: '', notes: content.trim() };
  }

  return {
    questions: lines.slice(qIdx + 1, nIdx).join('\n').trim(),
    notes: lines.slice(nIdx + 1).join('\n').trim()
  };
}

function serializeContent() {
  const q = qEditor.getValue().trim();
  const n = nEditor.getValue().trim();
  return `# Questions\n\n${q}\n\n# Notes\n\n${n}\n`;
}

// ─── Auto-save ───────────────────────────────────────────────────────────────

function scheduleAutoSave() {
  if (!currentFilePath) return;
  if (saveTimer) clearTimeout(saveTimer);
  document.title = '● Cornell Notes';
  saveTimer = setTimeout(saveFile, 1000);
}

async function saveFile() {
  if (!currentFilePath) return;
  saveTimer = null;
  await fetch('/api/file?' + new URLSearchParams({ filePath: currentFilePath }), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: serializeContent() })
  });
  document.title = 'Cornell Notes';
}

// ─── Marks ───────────────────────────────────────────────────────────────────

function updateMarks() {
  qMarks.forEach(m => m.clear());
  nMarks.forEach(m => m.clear());
  qMarks = [];
  nMarks = [];

  // [N] references in the notes editor
  nEditor.eachLine(lh => {
    const lineNum = nEditor.getLineNumber(lh);
    const text = lh.text;
    const pat = /\[(\d+)\]/g;
    let m;
    while ((m = pat.exec(text)) !== null) {
      nMarks.push(nEditor.markText(
        { line: lineNum, ch: m.index },
        { line: lineNum, ch: m.index + m[0].length },
        { className: 'ref-link', title: `Jump to question ${m[1]}` }
      ));
    }
  });

  // N. question numbers in the questions editor
  qEditor.eachLine(lh => {
    const lineNum = qEditor.getLineNumber(lh);
    const m = lh.text.match(/^(\d+)\./);
    if (m) {
      qMarks.push(qEditor.markText(
        { line: lineNum, ch: 0 },
        { line: lineNum, ch: m[0].length },
        { className: 'question-num', title: `Highlight references to [${m[1]}]` }
      ));
    }
  });
}

// ─── Link Navigation ─────────────────────────────────────────────────────────

function handleNotesMousedown(e) {
  const pos = nEditor.coordsChar(
    { left: e.clientX + window.pageXOffset, top: e.clientY + window.pageYOffset }
  );
  const line = nEditor.getLine(pos.line);
  if (!line) return;

  const pat = /\[(\d+)\]/g;
  let m;
  while ((m = pat.exec(line)) !== null) {
    if (pos.ch >= m.index && pos.ch < m.index + m[0].length) {
      navigateToQuestion(parseInt(m[1]));
      return;
    }
  }
}

function handleQuestionsMousedown(e) {
  const pos = qEditor.coordsChar(
    { left: e.clientX + window.pageXOffset, top: e.clientY + window.pageYOffset }
  );
  const line = qEditor.getLine(pos.line);
  if (!line) return;

  const m = line.match(/^(\d+)\./);
  if (m && pos.ch <= m[0].length) {
    highlightNoteRefs(parseInt(m[1]));
  }
}

function navigateToQuestion(n) {
  const lines = qEditor.getValue().split('\n');
  const re = new RegExp(`^${n}\\.`);
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      qEditor.scrollIntoView({ line: i, ch: 0 }, 80);
      flashLine(qEditor, i);
      return;
    }
  }
}

function highlightNoteRefs(n) {
  const lines = nEditor.getValue().split('\n');
  const re = new RegExp(`\\[${n}\\]`);
  let first = -1;
  lines.forEach((line, i) => {
    if (re.test(line)) {
      if (first === -1) first = i;
      flashLine(nEditor, i);
    }
  });
  if (first !== -1) nEditor.scrollIntoView({ line: first, ch: 0 }, 80);
}

function flashLine(editor, lineNum) {
  editor.addLineClass(lineNum, 'background', 'flash-line');
  setTimeout(() => editor.removeLineClass(lineNum, 'background', 'flash-line'), 1500);
}

// ─── Util ─────────────────────────────────────────────────────────────────────

async function apiFetch(url) {
  const res = await fetch(url);
  return res.json();
}

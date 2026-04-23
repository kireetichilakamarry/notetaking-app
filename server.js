const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const CONFIG_FILE = path.join(__dirname, '.vault-config.json');
const TEMPLATE = '# Questions\n\n# Notes\n\n';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/codemirror', express.static(path.join(__dirname, 'node_modules/codemirror')));

// ─── Vault config ────────────────────────────────────────────────────────────

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return {}; }
}

function writeConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

function getVaultPath() {
  return readConfig().vaultPath || null;
}

// ─── Path safety ─────────────────────────────────────────────────────────────

function isInsideVault(filePath, vaultPath) {
  const resolved = path.resolve(filePath);
  const vault = path.resolve(vaultPath);
  return resolved === vault || resolved.startsWith(vault + path.sep);
}

function guardPath(filePath, vaultPath, res) {
  if (!filePath || !vaultPath || !isInsideVault(filePath, vaultPath)) {
    res.status(400).json({ error: 'Path is outside the vault' });
    return false;
  }
  return true;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get('/api/vault', (req, res) => {
  res.json({ vaultPath: getVaultPath() });
});

app.post('/api/vault', (req, res) => {
  const { vaultPath } = req.body;
  if (!vaultPath || typeof vaultPath !== 'string') {
    return res.status(400).json({ error: 'No path provided' });
  }
  const resolved = path.resolve(vaultPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return res.status(400).json({ error: 'Path does not exist or is not a directory' });
  }
  writeConfig({ vaultPath: resolved });
  res.json({ success: true, vaultPath: resolved });
});

app.get('/api/files', (req, res) => {
  const vaultPath = getVaultPath();
  if (!vaultPath) return res.status(400).json({ error: 'No vault set' });

  const files = fs.readdirSync(vaultPath)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: f, path: path.join(vaultPath, f) }));

  res.json({ files });
});

app.get('/api/file', (req, res) => {
  const vaultPath = getVaultPath();
  const { filePath } = req.query;
  if (!guardPath(filePath, vaultPath, res)) return;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ content });
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});

app.put('/api/file', (req, res) => {
  const vaultPath = getVaultPath();
  const { filePath } = req.query;
  if (!guardPath(filePath, vaultPath, res)) return;
  if (!filePath.endsWith('.md')) return res.status(400).json({ error: 'Only .md files allowed' });

  const { content } = req.body;
  if (typeof content !== 'string') return res.status(400).json({ error: 'Invalid content' });

  fs.writeFileSync(filePath, content, 'utf8');
  res.json({ success: true });
});

app.post('/api/file', (req, res) => {
  const vaultPath = getVaultPath();
  if (!vaultPath) return res.status(400).json({ error: 'No vault set' });

  let { name } = req.body;
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'No name provided' });

  name = name.trim().replace(/[/\\?%*:|"<>]/g, '-');
  if (!name.endsWith('.md')) name += '.md';

  const filePath = path.join(vaultPath, name);
  if (!isInsideVault(filePath, vaultPath)) return res.status(400).json({ error: 'Invalid name' });

  if (fs.existsSync(filePath)) return res.status(409).json({ error: 'File already exists' });

  fs.writeFileSync(filePath, TEMPLATE, 'utf8');
  res.json({ filePath, name });
});

app.delete('/api/file', (req, res) => {
  const vaultPath = getVaultPath();
  const { filePath } = req.query;
  if (!guardPath(filePath, vaultPath, res)) return;

  try {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Cornell Notes running at http://localhost:${PORT}`);
});

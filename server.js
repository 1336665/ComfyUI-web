import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188';
const WORKFLOW_FILE = process.env.WORKFLOW_FILE || path.join(__dirname, 'Aaalice的工作流_一键包_v12.2_正式版.cpack (1).json');
const DATA_DIR = path.join(__dirname, 'data');
const MODELS_FILE = path.join(DATA_DIR, 'models.json');

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(MODELS_FILE);
  } catch {
    await fs.writeFile(MODELS_FILE, JSON.stringify({ models: [] }, null, 2));
  }
}

async function loadWorkflow() {
  const raw = await fs.readFile(WORKFLOW_FILE, 'utf-8');
  return JSON.parse(raw);
}

async function saveWorkflow(workflow) {
  await fs.writeFile(WORKFLOW_FILE, JSON.stringify(workflow, null, 2));
}

async function loadModels() {
  const raw = await fs.readFile(MODELS_FILE, 'utf-8');
  return JSON.parse(raw);
}

async function saveModels(models) {
  await fs.writeFile(MODELS_FILE, JSON.stringify(models, null, 2));
}

function comfyUrl(pathname) {
  const base = new URL(COMFYUI_BASE_URL);
  return new URL(pathname, base).toString();
}

async function proxyToComfyUI(req, res, pathnameOverride) {
  const targetPath = pathnameOverride || req.params[0];
  const targetUrl = comfyUrl(`/${targetPath}`);
  const headers = { ...req.headers };
  delete headers.host;

  const proxyResponse = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
  });

  res.status(proxyResponse.status);
  proxyResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-encoding') {
      return;
    }
    res.setHeader(key, value);
  });
  const contentType = proxyResponse.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await proxyResponse.json();
    return res.json(data);
  }
  const buffer = Buffer.from(await proxyResponse.arrayBuffer());
  return res.send(buffer);
}

app.get('/api/config', (req, res) => {
  res.json({ comfyuiBaseUrl: COMFYUI_BASE_URL });
});

app.get('/api/workflow', async (req, res) => {
  try {
    const workflow = await loadWorkflow();
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/workflow', async (req, res) => {
  try {
    await saveWorkflow(req.body);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/models', async (req, res) => {
  try {
    const models = await loadModels();
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/models', async (req, res) => {
  try {
    const { name, type, path: modelPath, note } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }
    const models = await loadModels();
    const entry = {
      id: crypto.randomUUID(),
      name,
      type,
      path: modelPath || '',
      note: note || '',
      addedAt: new Date().toISOString(),
    };
    models.models.push(entry);
    await saveModels(models);
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/models/:id', async (req, res) => {
  try {
    const models = await loadModels();
    const before = models.models.length;
    models.models = models.models.filter((model) => model.id !== req.params.id);
    if (models.models.length === before) {
      return res.status(404).json({ error: 'model not found' });
    }
    await saveModels(models);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/run', async (req, res) => {
  try {
    const targetUrl = comfyUrl('/prompt');
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/comfyui/object_info', (req, res) => proxyToComfyUI(req, res, 'object_info'));
app.get('/api/comfyui/history/:id', (req, res) => proxyToComfyUI(req, res, `history/${req.params.id}`));
app.get('/api/comfyui/view', (req, res) => proxyToComfyUI(req, res, `view?${req.url.split('?')[1] || ''}`));
app.all('/api/comfyui/*', (req, res) => proxyToComfyUI(req, res));

await ensureDataFiles();

app.listen(PORT, () => {
  console.log(`ComfyUI web server running at http://localhost:${PORT}`);
});

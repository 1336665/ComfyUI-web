const workflowList = document.querySelector('#workflow-list');
const nodeCount = document.querySelector('#node-count');
const comfyuiUrl = document.querySelector('#comfyui-url');
const refreshMetaButton = document.querySelector('#refresh-meta');
const saveWorkflowButton = document.querySelector('#save-workflow');
const runWorkflowButton = document.querySelector('#run-workflow');
const outputLog = document.querySelector('#output-log');
const refreshHistoryButton = document.querySelector('#refresh-history');
const historyList = document.querySelector('#history-list');
const galleryGrid = document.querySelector('#gallery-grid');
const modelForm = document.querySelector('#model-form');
const modelList = document.querySelector('#model-list');

let workflow = null;
let objectInfo = null;
let modelRegistry = [];
let promptHistory = [];

const formatValue = (value) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
};

const parseChoices = (meta) => {
  if (!meta) return null;
  if (Array.isArray(meta)) {
    const last = meta[meta.length - 1];
    if (Array.isArray(last)) return last;
  }
  if (Array.isArray(meta?.choices)) return meta.choices;
  return null;
};

const inferModelChoices = (inputName) => {
  const lower = inputName.toLowerCase();
  if (!lower.includes('model') && !lower.includes('ckpt') && !lower.includes('vae')) {
    return null;
  }
  return modelRegistry.map((model) => model.name);
};

const getInputMeta = (nodeType, inputName) => {
  if (!objectInfo || !objectInfo[nodeType]) return null;
  const input = objectInfo[nodeType].input || {};
  return input.required?.[inputName] || input.optional?.[inputName] || null;
};

const applyModelOverride = (node, inputName, value) => {
  const inputIndex = node.inputs?.findIndex((input) => input.name === inputName);
  if (inputIndex !== undefined && inputIndex >= 0) {
    node.widgets_values = node.widgets_values || [];
    node.widgets_values[inputIndex] = value;
  }
};

const renderModels = () => {
  modelList.innerHTML = '';
  if (modelRegistry.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = '暂无登记模型';
    empty.className = 'muted';
    modelList.appendChild(empty);
    return;
  }
  modelRegistry.forEach((model) => {
    const item = document.createElement('li');
    item.className = 'model-item';
    item.innerHTML = `
      <div>
        <strong>${model.name}</strong>
        <div class="muted">${model.type}${model.path ? ` · ${model.path}` : ''}</div>
        ${model.note ? `<div class="muted">${model.note}</div>` : ''}
      </div>
      <button data-id="${model.id}" class="danger">删除</button>
    `;
    item.querySelector('button')?.addEventListener('click', async () => {
      await fetch(`/api/models/${model.id}`, { method: 'DELETE' });
      await loadModels();
    });
    modelList.appendChild(item);
  });
};

const renderWorkflow = () => {
  if (!workflow) return;
  workflowList.innerHTML = '';
  const nodes = workflow.nodes || [];
  nodeCount.textContent = nodes.length;

  nodes
    .slice()
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    .forEach((node) => {
      const card = document.createElement('div');
      card.className = 'node-card';

      const header = document.createElement('div');
      header.className = 'node-header';
      const title = document.createElement('div');
      title.innerHTML = `
        <h3>${node.title || node.type}</h3>
        <div class="muted">${node.type} · ID ${node.id}</div>
      `;

      const toggle = document.createElement('label');
      toggle.className = 'switch';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = node.mode !== 4;
      checkbox.addEventListener('change', () => {
        node.mode = checkbox.checked ? 0 : 4;
      });
      toggle.appendChild(checkbox);
      toggle.appendChild(document.createElement('span'));
      header.appendChild(title);
      header.appendChild(toggle);

      const body = document.createElement('div');
      body.className = 'node-body';

      const inputs = node.inputs || [];
      if (inputs.length === 0) {
        body.innerHTML = '<p class="muted">无可编辑输入</p>';
      } else {
        inputs.forEach((input, index) => {
          const wrapper = document.createElement('label');
          wrapper.className = 'input-row';
          const meta = getInputMeta(node.type, input.name);
          const choices = parseChoices(meta) || inferModelChoices(input.name);
          const currentValue = node.widgets_values?.[index];
          const value = currentValue ?? input.default ?? '';

          const label = document.createElement('span');
          label.textContent = `${input.name} (${input.type})`;
          wrapper.appendChild(label);

          let control;
          if (choices) {
            control = document.createElement('select');
            choices.forEach((choice) => {
              const option = document.createElement('option');
              option.value = choice;
              option.textContent = choice;
              control.appendChild(option);
            });
            control.value = value || choices[0] || '';
          } else if (input.type === 'INT') {
            control = document.createElement('input');
            control.type = 'number';
            control.step = '1';
            control.value = value ?? 0;
          } else if (input.type === 'FLOAT') {
            control = document.createElement('input');
            control.type = 'number';
            control.step = '0.01';
            control.value = value ?? 0;
          } else {
            control = document.createElement('input');
            control.type = 'text';
            control.value = formatValue(value);
          }
          control.addEventListener('change', () => {
            node.widgets_values = node.widgets_values || [];
            node.widgets_values[index] = control.value;
          });
          wrapper.appendChild(control);
          body.appendChild(wrapper);
        });
      }

      card.appendChild(header);
      card.appendChild(body);
      workflowList.appendChild(card);
    });
};

const renderOutput = (content, type = 'info') => {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = content;
  outputLog.prepend(entry);
};

const renderGallery = (entries) => {
  historyList.innerHTML = '';
  galleryGrid.innerHTML = '';

  if (!entries || entries.length === 0) {
    historyList.innerHTML = '<p class="muted">暂无历史记录</p>';
    galleryGrid.innerHTML = '<p class="muted">暂无图片</p>';
    return;
  }

  entries.forEach((entry) => {
    const button = document.createElement('button');
    button.className = 'secondary';
    button.textContent = `任务 ${entry.promptId}`;
    button.addEventListener('click', () => {
      renderGallery([entry]);
    });
    historyList.appendChild(button);
  });

  const images = entries.flatMap((entry) => entry.images);
  if (images.length === 0) {
    galleryGrid.innerHTML = '<p class="muted">此任务暂无输出图</p>';
    return;
  }

  images.forEach((image) => {
    const card = document.createElement('div');
    card.className = 'gallery-card';

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = image.url;
    img.alt = image.label;

    const caption = document.createElement('div');
    caption.className = 'muted';
    caption.textContent = image.label;

    card.appendChild(img);
    card.appendChild(caption);
    galleryGrid.appendChild(card);
  });
};

const collectImagesFromHistory = (promptId, historyData) => {
  const historyEntry = historyData?.[promptId];
  if (!historyEntry?.outputs) {
    return [];
  }
  const images = [];
  Object.entries(historyEntry.outputs).forEach(([nodeId, output]) => {
    (output.images || []).forEach((image) => {
      const query = new URLSearchParams({
        filename: image.filename,
        type: image.type,
        subfolder: image.subfolder || '',
      });
      images.push({
        url: `/api/comfyui/view?${query.toString()}`,
        label: `${image.filename} · 节点 ${nodeId}`,
      });
    });
  });
  return images;
};

const loadConfig = async () => {
  const response = await fetch('/api/config');
  const data = await response.json();
  comfyuiUrl.textContent = data.comfyuiBaseUrl;
};

const loadWorkflow = async () => {
  const response = await fetch('/api/workflow');
  workflow = await response.json();
  renderWorkflow();
};

const loadObjectInfo = async () => {
  try {
    const response = await fetch('/api/comfyui/object_info');
    if (!response.ok) throw new Error('无法获取 ComfyUI 元数据');
    objectInfo = await response.json();
    renderOutput('已刷新 ComfyUI 元数据', 'success');
    renderWorkflow();
  } catch (error) {
    renderOutput(error.message, 'warning');
  }
};

const loadModels = async () => {
  const response = await fetch('/api/models');
  const data = await response.json();
  modelRegistry = data.models || [];
  renderModels();
};

const loadHistory = async (promptId) => {
  if (!promptId) return;
  try {
    const response = await fetch(`/api/comfyui/history/${promptId}`);
    if (!response.ok) throw new Error('无法获取历史记录');
    const data = await response.json();
    const images = collectImagesFromHistory(promptId, data);
    const existing = promptHistory.find((item) => item.promptId === promptId);
    if (existing) {
      existing.images = images;
    } else {
      promptHistory.unshift({ promptId, images });
    }
    renderGallery(promptHistory);
  } catch (error) {
    renderOutput(error.message, 'warning');
  }
};

refreshMetaButton.addEventListener('click', loadObjectInfo);
refreshHistoryButton.addEventListener('click', () => {
  if (promptHistory.length === 0) {
    renderOutput('暂无历史任务，请先运行工作流', 'warning');
    return;
  }
  loadHistory(promptHistory[0].promptId);
});

modelForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(modelForm);
  const payload = Object.fromEntries(formData.entries());
  await fetch('/api/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  modelForm.reset();
  await loadModels();
});

saveWorkflowButton.addEventListener('click', async () => {
  await fetch('/api/workflow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  renderOutput('工作流已保存', 'success');
});

runWorkflowButton.addEventListener('click', async () => {
  if (!workflow) return;
  const payload = { prompt: workflow };
  renderOutput('正在提交工作流…', 'info');
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '运行失败');
    }
    renderOutput(`已提交任务: ${data.prompt_id || 'unknown'}`, 'success');
    if (data.prompt_id) {
      promptHistory.unshift({ promptId: data.prompt_id, images: [] });
      renderGallery(promptHistory);
      setTimeout(() => loadHistory(data.prompt_id), 2000);
    }
  } catch (error) {
    renderOutput(error.message, 'error');
  }
});

const init = async () => {
  await loadConfig();
  await loadWorkflow();
  await loadModels();
  await loadObjectInfo();
  renderGallery(promptHistory);
};

init();

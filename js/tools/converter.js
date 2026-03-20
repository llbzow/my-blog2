(function () {
  const DEFAULT_BASE_URL = 'https://doc.luozili.work';
  const DEFAULT_API_KEY = '8731cca342588026f6d62570de37d556';
  const POLL_INTERVAL_MS = 3000;
  const MAX_POLL_ROUNDS = 120;
  const MAX_CONCURRENCY = 2;
  const DEBUG_PREFIX = '[ConvertX-Debug]';
  const DEBUG_LOG_LIMIT = 200;
  const ASSET_STORAGE_KEY = 'convertx_asset_center_v1';

  const FALLBACK_CONVERTER_MAP = {
    jpg: 'imagemagick', png: 'imagemagick', webp: 'imagemagick',
    pdf: 'libreoffice', docx: 'libreoffice', csv: 'dasel',
    xlsx: 'libreoffice', md: 'markitDown', txt: 'pandoc',
    gif: 'ffmpeg', mp4: 'ffmpeg', mp3: 'ffmpeg'
  };

  const Bus = {
    listeners: {},
    on(event, handler) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(handler);
    },
    emit(event, payload) {
      (this.listeners[event] || []).forEach((fn) => {
        try { fn(payload); } catch (e) { console.warn(e); }
      });
    }
  };

  const Store = {
    state: {
      files: [],
      targetFormat: null,
      tasks: {},
      running: 0,
      converterCapabilities: {}
    },
    setFiles(files) {
      this.state.files = files;
      Bus.emit('files:changed', files);
    },
    setTargetFormat(fmt) {
      this.state.targetFormat = fmt;
      Bus.emit('target:changed', fmt);
    },
    upsertTask(task) {
      this.state.tasks[task.id] = { ...(this.state.tasks[task.id] || {}), ...task };
      Bus.emit('task:updated', this.state.tasks[task.id]);
    },
    getTask(id) {
      return this.state.tasks[id] || null;
    },
    getTasks() {
      return Object.values(this.state.tasks).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    },
    clearTasks() {
      this.state.tasks = {};
      Bus.emit('queue:reset');
    }
  };

  const Api = {
    getBaseUrl() {
      const val = (document.getElementById('convertx-base-url')?.value || '').trim();
      return (val || DEFAULT_BASE_URL).replace(/\/+$/, '');
    },
    getApiKey() {
      const val = (document.getElementById('api-key')?.value || '').trim();
      return val || DEFAULT_API_KEY;
    },
    getAuthMode(apiKey) {
      return apiKey ? 'X-API-Key + Cookie' : 'Cookie';
    },
    async request(path, options = {}) {
      const baseUrl = this.getBaseUrl();
      const apiKey = this.getApiKey();
      const url = `${baseUrl}${path}`;
      const pageOrigin = window.location.origin;
      let credentialsMode = 'include';
      let sameOrigin = true;
      try {
        sameOrigin = new URL(url, window.location.href).origin === window.location.origin;
        credentialsMode = sameOrigin ? 'include' : 'omit';
      } catch (_) {
        credentialsMode = 'include';
        sameOrigin = true;
      }
      const traceId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const headers = { ...(options.headers || {}) };
      const useApiKey = options.useApiKey !== false;
      if (useApiKey && apiKey) headers['X-API-Key'] = apiKey;
      const debugMeta = options.debugMeta || null;

      const parseResponse = async (res, traceIdForLog, requestUrl) => {
        const text = await res.text();
        debugLog('api.response', { traceId: traceIdForLog, status: res.status, url: requestUrl, body_preview: (text || '').slice(0, 300) });
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
        return { ok: res.ok, status: res.status, text, data, headers: res.headers, traceId: traceIdForLog };
      };

      debugLog('api.request', {
        traceId,
        url,
        method: options.method || 'GET',
        auth: this.getAuthMode(useApiKey ? apiKey : ''),
        page_origin: pageOrigin,
        online: navigator.onLine,
        has_custom_headers: Object.keys(headers).length > 0,
        use_api_key: useApiKey,
        credentials_mode: credentialsMode,
        same_origin: sameOrigin,
        debug_meta: debugMeta
      });

      let res;
      try {
        res = await fetch(url, { ...options, headers, credentials: credentialsMode });
      } catch (err) {
        debugLog('api.network_error', {
          traceId,
          url,
          page_origin: pageOrigin,
          error_name: err?.name || 'UnknownError',
          error_message: err?.message || 'Failed to fetch',
          online: navigator.onLine,
          protocol_mode: (document.getElementById('protocol-mode')?.value || 'auto'),
          credentials_mode: credentialsMode,
          same_origin: sameOrigin,
          debug_meta: debugMeta,
          curl_probe: {
            options: `curl -i -X OPTIONS "${url}" -H "Origin: ${pageOrigin}" -H "Access-Control-Request-Method: ${options.method || 'POST'}" -H "Access-Control-Request-Headers: x-api-key,content-type"`,
            post_no_key: `curl -i -X ${(options.method || 'POST').toUpperCase()} "${url}" -H "Origin: ${pageOrigin}"`,
            post_with_key: `curl -i -X ${(options.method || 'POST').toUpperCase()} "${url}" -H "Origin: ${pageOrigin}" -H "X-API-Key: <api_key>"`
          }
        });
        if (url.includes('/convert')) {
          throw new Error('网络层失败：浏览器未拿到可用的跨域响应（非业务 4xx/5xx）。请检查 POST /convert 是否返回 Access-Control-Allow-Origin，以及 OPTIONS/POST 的 CORS 头是否一致，并确认放行 X-API-Key');
        }
        throw new Error('网络层失败（可能是 CSP connect-src / 跨域预检 / 浏览器安全策略），请检查浏览器 Network 与响应头');
      }

      return await parseResponse(res, traceId, url);
    }
  };

  function createTaskFromFile(file) {
    const id = Date.now() + Math.floor(Math.random() * 100000);
    const manualConverter = (document.getElementById('converter-name')?.value || '').trim();
    const converter = manualConverter || getRecommendedConverter(Store.state.targetFormat) || FALLBACK_CONVERTER_MAP[Store.state.targetFormat] || '';
    return {
      id,
      createdAt: Date.now(),
      file,
      filename: file.name,
      targetFormat: Store.state.targetFormat,
      converter,
      status: 'pending',
      attempts: 0,
      message: '等待中...'
    };
  }

  async function runScheduler() {
    const pending = Store.getTasks().filter((t) => t.status === 'pending');
    if (!pending.length) return;

    while (Store.state.running < MAX_CONCURRENCY && pending.length) {
      const task = pending.shift();
      Store.state.running += 1;
      processTask(task.id).finally(() => {
        Store.state.running -= 1;
        runScheduler();
      });
    }
  }

  async function processTask(taskId) {
    const task = Store.getTask(taskId);
    if (!task) return;

    Store.upsertTask({ id: taskId, status: 'running', message: '准备提交任务...', attempts: (task.attempts || 0) + 1 });

    try {
      const formData = new FormData();
      formData.append('file', task.file);
      formData.append('target_format', task.targetFormat);
      if (task.converter) formData.append('converter', task.converter);

      debugLog('task.submit.meta', {
        taskId,
        filename: task.filename,
        file_size: task.file?.size || 0,
        file_size_bucket: (function () {
          const size = task.file?.size || 0;
          if (size < 100 * 1024) return '<100KB';
          if (size < 1024 * 1024) return '100KB-1MB';
          if (size < 10 * 1024 * 1024) return '1MB-10MB';
          return '>=10MB';
        })(),
        target_format: task.targetFormat,
        converter: task.converter || null,
        protocol_mode: (document.getElementById('protocol-mode')?.value || 'auto')
      });

      let submit;
      try {
        submit = await Api.request('/convert', {
          method: 'POST',
          body: formData,
          useApiKey: true,
          debugMeta: { filename: task.filename, file_size: task.file?.size || 0, target_format: task.targetFormat }
        });
      } catch (firstErr) {
        const msg = String(firstErr?.message || firstErr || '');
        const looksLikeCors = /Failed to fetch|CORS|预检|跨域|X-API-Key/i.test(msg);
        if (!looksLikeCors) throw firstErr;

        debugLog('task.submit.fallback_without_api_key', {
          taskId,
          reason: msg,
          hint: '首次带 X-API-Key 网络失败，降级为不带自定义头重试一次'
        });
        submit = await Api.request('/convert', {
          method: 'POST',
          body: formData,
          useApiKey: false,
          debugMeta: { filename: task.filename, file_size: task.file?.size || 0, target_format: task.targetFormat, retry_without_api_key: true }
        });
      }
      if (!submit.ok) throw new Error(`提交失败(${submit.status}): ${(submit.text || '').slice(0, 200)}`);

      const protocolMode = (document.getElementById('protocol-mode')?.value || 'auto').toLowerCase();

      const isSyncPayload = Boolean(submit.data && (submit.data.status === 'completed' || Array.isArray(submit.data.files)));
      if (protocolMode !== 'async' && isSyncPayload) {
        persistAsset(task, submit.data, null);
        Store.upsertTask({
          id: taskId,
          status: 'done',
          message: '同步模式完成',
          submitData: submit.data,
          statusData: submit.data,
          downloadData: { kind: 'json', data: submit.data }
        });
        return;
      }

      const jobId = submit.data?.job_id || submit.data?.jobId;
      if (protocolMode === 'sync' && !isSyncPayload) {
        throw new Error('当前协议模式为仅同步，但后端返回非同步结构');
      }
      if (!jobId) throw new Error('后端返回成功但无 job_id / files');
      Store.upsertTask({ id: taskId, jobId, submitData: submit.data, message: `任务已提交: ${jobId}` });

      for (let round = 1; round <= MAX_POLL_ROUNDS; round++) {
        const st = await Api.request(`/job/${encodeURIComponent(jobId)}/status`, { method: 'GET' });
        if (!st.ok) throw new Error(`状态查询失败(${st.status}): ${(st.text || '').slice(0, 160)}`);

        if (st.data && st.data.success === false && /unauthorized/i.test(st.data.message || '')) {
          throw new Error('状态接口鉴权失败（Unauthorized）');
        }

        const status = st.data?.status || 'processing';
        Store.upsertTask({ id: taskId, statusData: st.data, message: `状态: ${status} (${round}/${MAX_POLL_ROUNDS})` });

        if (status === 'completed') {
          const dl = await fetchDownloadPayload(jobId);
          persistAsset(Store.getTask(taskId) || task, st.data, dl);
          Store.upsertTask({ id: taskId, status: 'done', message: '转换完成', downloadData: dl });
          return;
        }

        if (status === 'failed' || status === 'timeout') throw new Error(`任务结束状态: ${status}`);
        await wait(POLL_INTERVAL_MS);
      }

      throw new Error('轮询超时，请稍后重试');
    } catch (err) {
      Store.upsertTask({ id: taskId, status: 'error', message: err.message || '未知错误' });
    }
  }

  async function fetchDownloadPayload(jobId) {
    const res = await Api.request(`/job/${encodeURIComponent(jobId)}/download`, { method: 'GET' });
    if (!res.ok) throw new Error(`下载接口失败(${res.status})`);
    if (res.data) return { kind: 'json', data: res.data };
    const blob = new Blob([res.text || ''], { type: 'text/plain' });
    return { kind: 'blob', blob, filename: `convertx-${jobId}.txt` };
  }

  function initConverterTool() {
    const container = document.getElementById('tool-converter-container');
    if (!container) return;

    const fileInput = document.getElementById('file-input');
    const dropZone = container.querySelector('.drop-zone');
    const baseUrlEl = document.getElementById('convertx-base-url');
    const apiKeyEl = document.getElementById('api-key');
    if (baseUrlEl && !baseUrlEl.value) baseUrlEl.value = DEFAULT_BASE_URL;
    if (apiKeyEl && !apiKeyEl.value) apiKeyEl.value = DEFAULT_API_KEY;

    fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files));

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.background = '#eff6ff';
    });
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.style.background = 'white';
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.background = 'white';
      if (!e.dataTransfer.files.length) return;
      fileInput.files = e.dataTransfer.files;
      handleFileSelect(e.dataTransfer.files);
    });

    window.filterFormats = function (type) {
      document.querySelectorAll('.format-tab').forEach((t) => t.classList.remove('active'));
      if (window.event?.target) window.event.target.classList.add('active');
      document.querySelectorAll('.format-item').forEach((item) => {
        item.style.display = (type === 'all' || item.dataset.type === type) ? 'flex' : 'none';
      });
    };

    window.selectFormat = function (fmt) {
      if (!Store.state.files.length) {
        alert('请先选择文件');
        return;
      }
      Store.setTargetFormat(fmt);
      document.getElementById('target-format-name').innerText = fmt.toUpperCase();
      document.getElementById('action-bar').style.display = 'block';
      suggestConverterForTarget(fmt);
      document.querySelectorAll('.format-item').forEach((el) => el.classList.remove('selected'));
      if (window.event?.currentTarget) window.event.currentTarget.classList.add('selected');
    };

    window.startConversion = startBatchConversion;
    window.startBatchConversion = startBatchConversion;
    window.retryFailedTasks = retryFailedTasks;
    window.clearTaskQueue = clearTaskQueue;
    window.downloadResult = downloadResult;
    window.filterTaskView = renderAllTasks;
    window.exportDiagnostics = exportDiagnostics;
    window.clearDebugLogs = clearDebugLogs;
    window.refreshAssetCenter = renderAssetCenter;
    window.clearAssetCenter = clearAssetCenter;
    window.checkBackendConnectivity = refreshBackendMeta;

    Bus.on('task:updated', renderTaskRow);
    Bus.on('queue:reset', renderQueueEmpty);

    setBackendStatus('未检测后端（点击“手动检测后端”）', 'warn');
    renderAssetCenter();
  }

  function handleFileSelect(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    Store.setFiles(files);

    const selectedFileName = document.getElementById('selected-file-name');
    const uploadTitle = document.querySelector('.upload-section h3');
    if (selectedFileName) selectedFileName.innerText = files[0].name;
    if (uploadTitle) {
      uploadTitle.innerText = files.length === 1
        ? `已选择: ${files[0].name}`
        : `已选择 ${files.length} 个文件（首个: ${files[0].name}）`;
    }
  }

  async function startBatchConversion() {
    if (!Store.state.files.length || !Store.state.targetFormat) return;
    Store.state.files.forEach((file) => {
      const task = createTaskFromFile(file);
      Store.upsertTask(task);
    });
    runScheduler();
  }

  function retryFailedTasks() {
    Store.getTasks().filter((t) => t.status === 'error').forEach((t) => {
      Store.upsertTask({ id: t.id, status: 'pending', message: '重试排队中...' });
    });
    runScheduler();
  }

  function clearTaskQueue() {
    Store.clearTasks();
  }

  async function downloadResult(id) {
    const task = Store.getTask(id);
    if (!task) return;
    try {
      const payload = task.downloadData || (task.jobId ? await fetchDownloadPayload(task.jobId) : { kind: 'json', data: task.submitData || {} });
      if (payload.kind === 'blob') {
        saveAs(payload.blob, payload.filename || `result-${id}.bin`);
      } else {
        const blob = new Blob([JSON.stringify(payload.data || {}, null, 2)], { type: 'application/json' });
        saveAs(blob, `convertx-${id}-result.json`);
      }
    } catch (err) {
      alert(`下载失败: ${err.message || err}`);
    }
  }

  function renderTaskRow(task) {
    const filter = (document.getElementById('task-filter')?.value || 'all');

    const q = document.getElementById('conversion-queue');
    if (!q) return;
    if (q.children[0] && q.children[0].innerText.includes('暂无任务')) q.innerHTML = '';

    let row = document.getElementById(`task-${task.id}`);
    if (!row) {
      row = document.createElement('div');
      row.className = 'queue-item';
      row.id = `task-${task.id}`;
      q.prepend(row);
    }

    if (filter !== 'all' && task.status !== filter) {
      row.style.display = 'none';
      return;
    }
    row.style.display = 'flex';

    const statusClass = task.status === 'done' ? 'status-done'
      : task.status === 'error' ? 'status-error'
        : task.status === 'running' ? 'status-processing'
          : 'status-pending';

    const action = task.status === 'done'
      ? `完成 <a href="#" onclick="downloadResult(${task.id});return false;">下载</a>`
      : task.status === 'error'
        ? `失败: ${task.message || '未知错误'}`
        : (task.message || '处理中...');

    row.innerHTML = `<div><strong>${task.filename}</strong> <span style="color:#999">→ ${(task.targetFormat || '').toUpperCase()}</span> <span style="font-size:11px;color:#bbb">#${task.attempts || 0}</span></div><div class="queue-status ${statusClass}">${action}</div>`;
  }

  function renderAllTasks() {
    const q = document.getElementById('conversion-queue');
    if (!q) return;
    q.innerHTML = '<div class="queue-item" style="color:#999; justify-content:center;">暂无任务</div>';
    Store.getTasks().forEach((task) => renderTaskRow(task));
  }

  function renderQueueEmpty() {
    const q = document.getElementById('conversion-queue');
    if (!q) return;
    q.innerHTML = '<div class="queue-item" style="color:#999; justify-content:center;">暂无任务</div>';
  }

  async function refreshBackendMeta() {
    try {
      const health = await Api.request('/health', { method: 'GET', useApiKey: false });
      if (!health.ok) throw new Error(`health ${health.status}`);

      const converters = await Api.request('/converters', { method: 'GET', useApiKey: false });
      if (converters.ok && converters.data) {
        Store.state.converterCapabilities = converters.data || {};
        const names = Object.keys(converters.data || {});
        setBackendStatus(`后端在线，已加载 ${names.length} 个转换器`, 'ok');
      } else {
        setBackendStatus('初始化告警：转换器列表不可用，仍可尝试手动转换', 'warn');
      }
    } catch (err) {
      setBackendStatus(`初始化告警: ${err.message || err}（不阻断，可继续尝试转换）`, 'warn');
      debugLog('init.non_blocking_warning', {
        reason: String(err?.message || err),
        hint: '请检查 CSP connect-src / CORS / 代理策略'
      });
    }
  }

  function getRecommendedConverter(targetFormat) {
    const caps = Store.state.converterCapabilities || {};
    const names = Object.keys(caps);
    for (const name of names) {
      const targets = caps[name]?.targets || [];
      if (targets.includes(targetFormat)) return name;
    }
    return '';
  }

  function suggestConverterForTarget(targetFormat) {
    const input = document.getElementById('converter-name');
    if (!input || input.value.trim()) return;
    const rec = getRecommendedConverter(targetFormat);
    if (rec) input.value = rec;
  }

  function getAssetList() {
    try {
      return JSON.parse(localStorage.getItem(ASSET_STORAGE_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function setAssetList(list) {
    localStorage.setItem(ASSET_STORAGE_KEY, JSON.stringify(list));
  }

  function persistAsset(task, statusData, downloadData) {
    const list = getAssetList();
    const item = {
      id: task.id,
      filename: task.filename,
      targetFormat: task.targetFormat,
      converter: task.converter,
      jobId: task.jobId || null,
      createdAt: Date.now(),
      statusData: statusData || null,
      hasDownloadBlob: Boolean(downloadData && downloadData.kind === 'blob')
    };
    list.unshift(item);
    setAssetList(list.slice(0, 500));
    renderAssetCenter();
  }

  function renderAssetCenter() {
    const el = document.getElementById('asset-center-list');
    if (!el) return;
    const list = getAssetList();
    if (!list.length) {
      el.innerHTML = '暂无本地资产';
      return;
    }
    el.innerHTML = list.slice(0, 50).map((x) => {
      const t = new Date(x.createdAt || Date.now()).toLocaleString();
      return `<div style="padding:6px 0; border-bottom:1px dashed #eee;"><strong>${x.filename}</strong> → ${String(x.targetFormat || '').toUpperCase()} <span style="color:#999; font-size:12px;">${t}</span></div>`;
    }).join('');
  }

  function clearAssetCenter() {
    localStorage.removeItem(ASSET_STORAGE_KEY);
    renderAssetCenter();
  }

  function exportDiagnostics() {
    const payload = {
      exportedAt: new Date().toISOString(),
      baseUrl: Api.getBaseUrl(),
      taskCount: Store.getTasks().length,
      tasks: Store.getTasks(),
      assets: getAssetList(),
      logs: window.__convertxDebugLogs || []
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    saveAs(blob, `convertx-diagnostics-${Date.now()}.json`);
  }

  function clearDebugLogs() {
    window.__convertxDebugLogs = [];
    const panel = document.getElementById('debug-log-panel');
    if (panel) panel.innerHTML = '<div style="color:#6b7280;">暂无日志</div>';
  }

  function setBackendStatus(text, type) {
    const el = document.getElementById('backend-status');
    if (!el) return;
    const color = type === 'ok' ? '#16a34a' : type === 'warn' ? '#d97706' : '#ef4444';
    el.style.color = color;
    el.innerText = text;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function debugLog(event, payload) {
    try {
      const entry = { ts: new Date().toISOString(), event, payload: payload || {} };
      window.__convertxDebugLogs = window.__convertxDebugLogs || [];
      window.__convertxDebugLogs.push(entry);
      if (window.__convertxDebugLogs.length > DEBUG_LOG_LIMIT) window.__convertxDebugLogs.shift();

      const panel = document.getElementById('debug-log-panel');
      if (panel) {
        if (panel.innerText.includes('暂无日志')) panel.innerHTML = '';
        const line = document.createElement('div');
        line.textContent = `[${entry.ts}] ${event} ${JSON.stringify(entry.payload)}`;
        panel.appendChild(line);
        panel.scrollTop = panel.scrollHeight;
      }
      console.log(`${DEBUG_PREFIX} ${event}`, payload || {});
    } catch (_) {
      // ignore
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConverterTool);
  } else {
    initConverterTool();
  }
})();

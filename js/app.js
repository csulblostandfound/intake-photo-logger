(function () {
  'use strict';

  /* ── DOM refs ── */
  const form        = document.getElementById('intake-form');
  const photoArea   = document.getElementById('photo-area');
  const fileInput   = document.getElementById('file-input');
  const placeholder = document.getElementById('photo-placeholder');
  const preview     = document.getElementById('photo-preview');
  const previewImg  = document.getElementById('preview-img');
  const retakeBtn   = document.getElementById('retake-btn');
  const submitBtn   = document.getElementById('submit-btn');
  const itemCode    = document.getElementById('item-code');
  const recentList  = document.getElementById('recent-list');
  const recentCount = document.getElementById('recent-count');
  const subCount    = document.getElementById('submission-count');
  const toastCtr    = document.getElementById('toast-container');
  const paUrlInput  = document.getElementById('power-automate-url');

  const segments    = document.querySelectorAll('.type-toggle .segment');

  var selectedImage = null;
  var selectedType  = 'lost';

  var STORAGE_KEY   = 'intake_logger_submissions';
  var PAURL_KEY     = 'intake_logger_pa_url';

  /* ── Init ── */
  var savedUrl = localStorage.getItem(PAURL_KEY);
  if (savedUrl) paUrlInput.value = savedUrl;
  paUrlInput.addEventListener('change', function () {
    localStorage.setItem(PAURL_KEY, this.value.trim());
  });

  /* ── Type toggle ── */
  segments.forEach(function (seg) {
    seg.addEventListener('click', function () {
      segments.forEach(function (s) { s.classList.remove('active'); });
      seg.classList.add('active');
      selectedType = seg.dataset.value;
    });
  });

  /* ── Submit button state ── */
  function updateSubmitState() {
    submitBtn.disabled = !(itemCode.value.trim() && selectedImage);
  }

  itemCode.addEventListener('input', updateSubmitState);

  /* ── Photo capture / upload ── */
  photoArea.addEventListener('click', function () {
    if (selectedImage) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length) loadFile(fileInput.files[0]);
  });

  photoArea.addEventListener('dragover', function (e) {
    e.preventDefault();
    if (!selectedImage) photoArea.classList.add('drag-over');
  });

  photoArea.addEventListener('dragleave', function () {
    photoArea.classList.remove('drag-over');
  });

  photoArea.addEventListener('drop', function (e) {
    e.preventDefault();
    photoArea.classList.remove('drag-over');
    if (selectedImage) return;
    var file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  });

  retakeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    clearImage();
  });

  function loadFile(file) {
    if (!file.type.match(/^image\//)) {
      showToast('Please select an image file.', 'error');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast('Image must be under 15MB.', 'error');
      return;
    }

    var reader = new FileReader();
    reader.onload = function (e) {
      previewImg.src = e.target.result;
      placeholder.classList.add('hidden');
      preview.classList.remove('hidden');
      selectedImage = file;
      updateSubmitState();
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    selectedImage = null;
    placeholder.classList.remove('hidden');
    preview.classList.add('hidden');
    previewImg.src = '';
    fileInput.value = '';
    updateSubmitState();
  }

  /* ── Form submit ── */
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var paUrl = (paUrlInput.value || '').trim();
    if (!paUrl) {
      showToast('Configure your Power Automate URL in Settings below.', 'warning');
      var settings = document.querySelector('.settings-panel');
      if (settings) settings.open = true;
      paUrlInput.focus();
      return;
    }

    if (!itemCode.value.trim() || !selectedImage) return;

    var code = itemCode.value.trim().toUpperCase();

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    var entry = {
      itemCode:    code,
      type:        selectedType,
      submittedAt: new Date().toISOString(),
      imageName:   code + '.' + (selectedImage.name.split('.').pop() || 'jpg'),
      id:          Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
    };

    fileToBase64(selectedImage).then(function (base64) {
      entry.imageBase64 = base64;

      var payload = {
        itemCode:    entry.itemCode,
        type:        entry.type,
        imageBase64: base64,
        imageName:   entry.imageName,
        submittedAt: entry.submittedAt
      };

      return fetch(paUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (resp) {
        if (!resp.ok) {
          return resp.text().catch(function () { return ''; }).then(function (t) {
            throw new Error('Server ' + resp.status + (t ? ': ' + t.substring(0, 200) : ''));
          });
        }
        return resp;
      });
    }).then(function () {
      entry.status = 'sent';
      saveSubmission(entry);
      showToast('Logged: ' + code, 'success');
      form.reset();
      clearImage();
      itemCode.focus();
      renderRecent();
    }).catch(function (err) {
      entry.status = 'failed';
      saveSubmission(entry);
      showToast(err.message || 'Failed to send. Check your connection and URL.', 'error');
      renderRecent();
    }).finally(function () {
      submitBtn.classList.remove('loading');
      updateSubmitState();
    });
  });

  /* ── Helpers ── */
  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload  = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('Failed to read image.')); };
      reader.readAsDataURL(file);
    });
  }

  /* ── Local storage ── */
  function getSubmissions() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveSubmission(entry) {
    var items = getSubmissions();
    items.unshift(entry);
    if (items.length > 200) items = items.slice(0, 200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  /* ── Render recent ── */
  function renderRecent() {
    var items = getSubmissions();
    recentCount.textContent = items.length + ' total';

    var today = new Date().toDateString();
    var todayCount = items.filter(function (i) {
      return new Date(i.submittedAt).toDateString() === today;
    }).length;
    subCount.textContent = todayCount + ' logged today';

    if (!items.length) {
      recentList.innerHTML =
        '<div class="empty-state">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" class="empty-icon">' +
            '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
          '</svg>' +
          '<p>No submissions yet</p>' +
          '<span>Logged items will appear here</span>' +
        '</div>';
      return;
    }

    var html = '';
    items.slice(0, 30).forEach(function (item) {
      var thumbHtml = item.imageBase64
        ? '<img class="recent-thumb" src="' + esc(item.imageBase64) + '" alt="' + esc(item.itemCode) + '" loading="lazy">'
        : '<div class="recent-thumb-placeholder">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
              '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' +
            '</svg>' +
          '</div>';

      var statusHtml = '';
      if (item.status === 'sent') {
        statusHtml = '<span class="recent-status sent"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Sent</span>';
      } else if (item.status === 'pending') {
        statusHtml = '<span class="recent-status pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Pending</span>';
      } else if (item.status === 'failed') {
        statusHtml = '<span class="recent-status failed"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Failed</span>';
      }

      html +=
        '<div class="recent-item">' +
          thumbHtml +
          '<div class="recent-info">' +
            '<div class="recent-code">' + esc(item.itemCode) + '</div>' +
            '<div class="recent-meta">' +
              formatTime(item.submittedAt) +
              '<span class="recent-badge ' + item.type + '">' + item.type + '</span>' +
            '</div>' +
          '</div>' +
          statusHtml +
        '</div>';
    });

    recentList.innerHTML = html;
  }

  function formatTime(iso) {
    var d = new Date(iso);
    var now = new Date();
    var diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
           d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function esc(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ── Toast ── */
  function showToast(message, type) {
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'success');

    var icons = {
      success: '<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error:   '<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };

    toast.innerHTML =
      (icons[type] || icons.success) +
      '<span class="toast-message">' + esc(message) + '</span>' +
      '<button class="toast-close" aria-label="Dismiss">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
        '</svg>' +
      '</button>';

    toastCtr.appendChild(toast);

    var closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', function () { dismiss(toast); });

    setTimeout(function () { dismiss(toast); }, 5000);
  }

  function dismiss(toast) {
    if (!toast.parentNode) return;
    toast.classList.add('toast-out');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }

  /* ── Init render ── */
  renderRecent();
  itemCode.focus();
})();

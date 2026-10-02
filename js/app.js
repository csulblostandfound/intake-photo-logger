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
  const description = document.getElementById('item-description');
  const dateReceived = document.getElementById('date-received');
  const dropOffLocation = document.getElementById('drop-off-location');
  const srwcIdentifier = document.getElementById('srwc-identifier');
  const lfAction = document.getElementById('lf-action');
  const packageTrackingNumber = document.getElementById('package-tracking-number');
  const recentList  = document.getElementById('recent-list');
  const recentCount = document.getElementById('recent-count');
  const subCount    = document.getElementById('submission-count');
  const toastCtr    = document.getElementById('toast-container');
  const paUrlInput  = document.getElementById('power-automate-url');

  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const clearConfirm    = document.getElementById('clear-confirm');
  const adminPassword   = document.getElementById('admin-password');
  const clearCancel     = document.getElementById('clear-cancel');
  const clearConfirmBtn = document.getElementById('clear-confirm-btn');

  const settingsPanel     = document.querySelector('.settings-panel');
  const settingsGate      = document.getElementById('settings-gate');
  const settingsBody      = document.getElementById('settings-body');
  const settingsPassword  = document.getElementById('settings-password');
  const settingsUnlockBtn = document.getElementById('settings-unlock-btn');

  const segments    = document.querySelectorAll('.type-toggle .segment');

  var selectedImage = null;
  var selectedType  = 'lost';

  var STORAGE_KEY   = 'intake_logger_submissions';
  var PAURL_KEY     = 'intake_logger_pa_url';
  var THEME_KEY     = 'intake_logger_theme';
  var CODE_PREFIX   = '26-';
  var ADMIN_PASSWORD = 'csulb1949';

  // Shared CSULB Lost & Found flow, baked in so devices work out of the box
  // with no setup. Overridable per-device via the (admin-gated) Settings URL
  // field if a different flow is ever needed.
  var DEFAULT_PA_URL = 'https://defaultd175679bacd34644be82af04198297.7a.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/17/workflows/e955bd901b1549afa744453296ed87dd/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=TU94uRDBE_0UDNXtd8AirgiYmqa3gDxn1xDtGcBzF0k';

  /* ── Theme (light / dark) ──
     data-theme is set as early as possible by an inline script in <head> so
     there's no flash of the wrong theme; this just wires up the toggle. */
  var themeToggle   = document.getElementById('theme-toggle');
  var themeColorMeta = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeColorMeta) themeColorMeta.setAttribute('content', theme === 'light' ? '#f4f4f9' : '#0a0a0f');
  }

  applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      applyTheme(next);
    });
  }

  /* ── Init ── */
  var savedUrl = localStorage.getItem(PAURL_KEY);
  paUrlInput.value = savedUrl || DEFAULT_PA_URL;
  paUrlInput.addEventListener('change', function () {
    localStorage.setItem(PAURL_KEY, this.value.trim());
  });

  /* ── Admin: gate the whole Settings panel behind the admin password.
     Re-locks every time the panel is collapsed, so it prompts again next
     time rather than staying unlocked for the rest of the session. ── */
  function unlockSettings() {
    if (settingsPassword.value !== ADMIN_PASSWORD) {
      showToast('Incorrect admin password.', 'error');
      settingsPassword.focus();
      settingsPassword.select();
      return;
    }
    settingsGate.classList.add('hidden');
    settingsBody.classList.remove('hidden');
  }

  settingsUnlockBtn.addEventListener('click', unlockSettings);
  settingsPassword.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); unlockSettings(); }
  });

  settingsPanel.addEventListener('toggle', function () {
    if (!settingsPanel.open) {
      settingsGate.classList.remove('hidden');
      settingsBody.classList.add('hidden');
      settingsPassword.value = '';
    }
  });

  /* ── Admin: clear submission history (password-gated) ── */
  function showClearConfirm(show) {
    clearConfirm.classList.toggle('hidden', !show);
    if (show) {
      adminPassword.value = '';
      adminPassword.focus();
    }
  }

  clearHistoryBtn.addEventListener('click', function () { showClearConfirm(true); });
  clearCancel.addEventListener('click', function () { showClearConfirm(false); });

  clearConfirmBtn.addEventListener('click', function () {
    if (adminPassword.value !== ADMIN_PASSWORD) {
      showToast('Incorrect admin password.', 'error');
      adminPassword.focus();
      adminPassword.select();
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    showClearConfirm(false);
    renderRecent();
    showToast('Submission history cleared.', 'success');
  });

  adminPassword.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); clearConfirmBtn.click(); }
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

    var paUrl = (paUrlInput.value || '').trim() || DEFAULT_PA_URL;
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
      description: description.value.trim(),
      dateReceived: dateReceived.value,
      dropOffLocation: dropOffLocation.value.trim(),
      srwcIdentifier: srwcIdentifier.value.trim(),
      lfAction: lfAction.value.trim(),
      packageTrackingNumber: packageTrackingNumber.value.trim(),
      submittedAt: new Date().toISOString(),
      imageName:   code + '.' + (selectedImage.name.split('.').pop() || 'jpg'),
      id:          Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
    };

    fileToBase64(selectedImage).then(function (base64) {
      var payload = {
        itemCode:    entry.itemCode,
        type:        entry.type,
        description: entry.description,
        dateReceived: entry.dateReceived,
        dropOffLocation: entry.dropOffLocation,
        srwcIdentifier: entry.srwcIdentifier,
        lfAction: entry.lfAction,
        packageTrackingNumber: entry.packageTrackingNumber,
        imageBase64: base64,
        imageName:   entry.imageName,
        submittedAt: entry.submittedAt
      };

      // The full-res photo goes to Power Automate, but a small thumbnail is
      // what we keep in localStorage for the recent list -- storing full
      // camera photos there blows past the ~5MB quota after one or two
      // submissions and silently breaks history.
      return makeThumbnail(base64, 160, 0.6).then(function (thumb) {
        entry.imageBase64 = thumb || base64;

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
      });
    }).then(function () {
      entry.status = 'sent';
      if (!saveSubmission(entry)) {
        showToast('Logged, but local history couldn\'t be saved (storage full or disabled).', 'warning');
      } else {
        showToast('Logged: ' + code, 'success');
      }
      form.reset();
      clearImage();
      setDateReceivedToToday();
      resetCodeField();
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

  // Downscales a data URL to a small JPEG for the local recent-submissions
  // list. Resolves to null (never rejects) if it can't be produced, so
  // callers can fall back to skipping the thumbnail.
  function makeThumbnail(dataUrl, maxDim, quality) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        try {
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality || 0.6));
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = function () { resolve(null); };
      img.src = dataUrl;
    });
  }

  /* ── Local storage ── */
  function getSubmissions() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }

  // Returns true if the entry (and its thumbnail) made it into local
  // history, false if storage is full/disabled and we couldn't save it even
  // after dropping images -- callers should surface that instead of failing
  // silently, since the item may still have been sent successfully.
  function saveSubmission(entry) {
    var items = getSubmissions();
    items.unshift(entry);
    if (items.length > 200) items = items.slice(0, 200);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch (e) {
      // Quota exceeded even with thumbnails -- drop all images and retry so
      // the item codes/timestamps aren't lost, just the pictures.
      var stripped = items.map(function (i) {
        var copy = {};
        for (var k in i) { if (k !== 'imageBase64') copy[k] = i[k]; }
        return copy;
      });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
        return true;
      } catch (e2) {
        return false;
      }
    }
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

  /* ── Default the item code to the year prefix ── */
  function resetCodeField() {
    itemCode.value = CODE_PREFIX;
    updateSubmitState();
    itemCode.focus();
    // place the cursor after the prefix so the user types the number straight away
    var end = itemCode.value.length;
    try { itemCode.setSelectionRange(end, end); } catch (e) {}
  }

  function setDateReceivedToToday() {
    var now = new Date();
    var localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    dateReceived.value = localDate;
  }

  /* ── Prefill from the URL ──
     Lets another tool hand this one an item straight off, e.g.
     ?code=AP-2026-0001&type=found — so an operator never retypes a code that
     the calling tool already knows. Both params are optional; anything missing
     falls back to the normal defaults. */
  function applyUrlPrefill() {
    var params = new URLSearchParams(window.location.search);

    var type = (params.get('type') || '').toLowerCase();
    if (type === 'lost' || type === 'found') {
      selectedType = type;
      segments.forEach(function (s) {
        s.classList.toggle('active', s.dataset.value === type);
      });
    }

    var code = (params.get('code') || '').trim();
    if (!code) return false;
    itemCode.value = code;
    updateSubmitState();
    // Focus the photo area instead of the code box -- the code is already
    // right, so the only thing left to do is take the picture.
    if (photoArea && typeof photoArea.focus === 'function') photoArea.focus();
    return true;
  }

  /* ── Init render ── */
  renderRecent();
  setDateReceivedToToday();
  if (!applyUrlPrefill()) resetCodeField();
})();

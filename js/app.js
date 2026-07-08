(function () {
  'use strict';

  /* ── DOM references ── */
  const form          = document.getElementById('report-form');
  const dropZone      = document.getElementById('drop-zone');
  const fileInput     = document.getElementById('file-input');
  const preview       = document.getElementById('image-preview');
  const previewImg    = document.getElementById('preview-img');
  const removeBtn     = document.getElementById('remove-image');
  const placeholder   = dropZone.querySelector('.upload-placeholder');
  const submitBtn     = document.getElementById('submit-btn');
  const description   = document.getElementById('item-description');
  const charCounter   = document.getElementById('char-counter');
  const bentoGrid     = document.getElementById('bento-grid');
  const toastContainer = document.getElementById('toast-container');

  const segments      = document.querySelectorAll('.segmented-control .segment');
  const tabs          = document.querySelectorAll('.nav-tabs .tab');
  const filterChips   = document.querySelectorAll('.filter-chip');

  const STORAGE_KEY   = 'foundit_items';
  const POWERAUTOMATE_URL_KEY = 'foundit_powerautomate_url';

  let selectedType    = 'lost';
  let selectedImage   = null;
  let editingImage    = null;

  /* ── URL persistence ── */
  const paUrlInput = document.getElementById('power-automate-url');
  const savedUrl = localStorage.getItem(POWERAUTOMATE_URL_KEY);
  if (savedUrl) paUrlInput.value = savedUrl;
  paUrlInput.addEventListener('change', function () {
    localStorage.setItem(POWERAUTOMATE_URL_KEY, this.value.trim());
  });

  /* ── Tab switching ── */
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');

      var target = tab.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
      document.getElementById('tab-' + target).classList.add('active');

      if (target === 'browse') renderBento();
    });
  });

  /* ── Segment control ── */
  segments.forEach(function (seg) {
    seg.addEventListener('click', function () {
      segments.forEach(function (s) { s.classList.remove('active'); });
      seg.classList.add('active');
      selectedType = seg.dataset.value;
    });
  });

  /* ── Image upload ── */
  dropZone.addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length) loadImage(fileInput.files[0]);
  });

  dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', function () {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    var file = e.dataTransfer.files[0];
    if (file) loadImage(file);
  });

  removeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    clearImage();
  });

  function loadImage(file) {
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      showToast('Please upload a PNG, JPG, or WEBP image.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Image must be under 10MB.', 'error');
      return;
    }

    var reader = new FileReader();
    reader.onload = function (e) {
      previewImg.src = e.target.result;
      placeholder.classList.add('hidden');
      preview.classList.remove('hidden');
      selectedImage = file;
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    selectedImage = null;
    placeholder.classList.remove('hidden');
    preview.classList.add('hidden');
    previewImg.src = '';
    fileInput.value = '';
  }

  /* ── Character counter ── */
  description.addEventListener('input', function () {
    var len = description.value.length;
    charCounter.textContent = len;
    charCounter.style.color = len > 450 ? 'var(--warning)' : len > 490 ? 'var(--danger)' : '';
  });

  /* ── Form submission ── */
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!validateForm()) return;

    var paUrl = (paUrlInput.value || '').trim();
    if (!paUrl) {
      showToast('Please enter your Power Automate trigger URL.', 'error');
      paUrlInput.focus();
      return;
    }

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    var itemData = {
      type:        selectedType,
      name:        document.getElementById('item-name').value.trim(),
      category:    document.getElementById('item-category').value,
      location:    document.getElementById('item-location').value.trim(),
      date:        document.getElementById('item-date').value,
      description: description.value.trim().substring(0, 500),
      email:       document.getElementById('contact-email').value.trim(),
      phone:       document.getElementById('contact-phone').value.trim(),
      submittedAt: new Date().toISOString(),
      id:          generateId()
    };

    submitToPowerAutomate(paUrl, itemData, selectedImage)
      .then(function () {
        itemData.imageBase64 = selectedImage ? previewImg.src : null;
        saveItemLocally(itemData);
        showToast('Item reported successfully!', 'success');
        form.reset();
        clearImage();
        segments.forEach(function (s) { s.classList.remove('active'); });
        segments[0].classList.add('active');
        selectedType = 'lost';
        description.dispatchEvent(new Event('input'));

        /* Switch to browse tab */
        document.querySelector('.tab[data-tab="browse"]').click();
        renderBento();
      })
      .catch(function (err) {
        showToast(err.message || 'Failed to submit. Check the URL and try again.', 'error');
      })
      .finally(function () {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      });
  });

  function validateForm() {
    var name     = document.getElementById('item-name');
    var location = document.getElementById('item-location');
    var date     = document.getElementById('item-date');
    var desc     = description;
    var email    = document.getElementById('contact-email');
    var valid    = true;

    [name, location, date, desc, email].forEach(function (el) {
      if (!el.value.trim()) {
        el.style.borderColor = 'rgba(239,68,68,0.5)';
        el.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.1)';
        valid = false;
      } else {
        el.style.borderColor = '';
        el.style.boxShadow = '';
      }
    });

    if (!valid) {
      showToast('Please fill in all required fields.', 'error');
    }

    return valid;
  }

  /* ── Power Automate submission ── */
  async function submitToPowerAutomate(url, item, imageFile) {
    var body;

    if (imageFile) {
      var base64 = await fileToBase64(imageFile);
      body = JSON.stringify({
        type:        item.type,
        name:        item.name,
        category:    item.category,
        location:    item.location,
        date:        item.date,
        description: item.description,
        email:       item.email,
        phone:       item.phone,
        submittedAt: item.submittedAt,
        imageBase64: base64,
        imageName:   imageFile.name
      });
    } else {
      body = JSON.stringify(item);
    }

    var resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });

    if (!resp.ok) {
      var text = await resp.text().catch(function () { return ''; });
      throw new Error('Server responded with ' + resp.status + (text ? ': ' + text.substring(0, 200) : ''));
    }

    return resp;
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload  = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('Failed to read image file.')); };
      reader.readAsDataURL(file);
    });
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
  }

  /* ── Local storage ── */
  function getItems() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveItemLocally(item) {
    var items = getItems();
    items.unshift(item);
    if (items.length > 100) items = items.slice(0, 100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  /* ── Bento Grid rendering ── */
  var currentFilter = 'all';

  filterChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      filterChips.forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderBento();
    });
  });

  function renderBento() {
    var items = getItems();

    if (currentFilter !== 'all') {
      items = items.filter(function (i) { return i.type === currentFilter; });
    }

    bentoGrid.innerHTML = '';

    if (!items.length) {
      bentoGrid.innerHTML =
        '<div class="empty-state">' +
          '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" class="empty-icon">' +
            '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
          '</svg>' +
          '<p>' + (currentFilter === 'all' ? 'No items reported yet' : 'No ' + currentFilter + ' items') + '</p>' +
          '<span>Submitted items will appear here</span>' +
        '</div>';
      return;
    }

    items.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'bento-card';

      var imageHtml = item.imageBase64
        ? '<img class="bento-card-img" src="' + escapeHtml(item.imageBase64) + '" alt="' + escapeHtml(item.name) + '" loading="lazy">'
        : '<div class="bento-card-img" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted)">' +
            '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
              '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' +
            '</svg>' +
          '</div>';

      card.innerHTML =
        imageHtml +
        '<span class="bento-card-badge ' + item.type + '">' + item.type + '</span>' +
        '<div class="bento-card-title">' + escapeHtml(item.name) + '</div>' +
        '<div class="bento-card-meta">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' +
          '</svg>' +
          ' ' + formatDate(item.date) +
        '</div>' +
        '<div class="bento-card-location">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' +
          '</svg>' +
          ' ' + escapeHtml(item.location) +
        '</div>';

      card.addEventListener('mousemove', function (ev) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', ((ev.clientX - rect.left) / rect.width * 100) + '%');
        card.style.setProperty('--mouse-y', ((ev.clientY - rect.top) / rect.height * 100) + '%');
      });

      bentoGrid.appendChild(card);
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ── Toast notifications ── */
  function showToast(message, type) {
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'success');

    var iconSvg = type === 'error'
      ? '<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
      : '<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';

    toast.innerHTML =
      iconSvg +
      '<span class="toast-message">' + escapeHtml(message) + '</span>' +
      '<button class="toast-close" aria-label="Dismiss">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
        '</svg>' +
      '</button>';

    toastContainer.appendChild(toast);

    var closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', function () { dismissToast(toast); });

    setTimeout(function () { dismissToast(toast); }, 5000);
  }

  function dismissToast(toast) {
    if (toast.parentNode) {
      toast.classList.add('toast-out');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }
  }

  /* ── Initial render ── */
  renderBento();
})();

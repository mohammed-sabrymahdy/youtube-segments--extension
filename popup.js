/**
 * popup.js — SegmentSaver Popup Dashboard
 * Handles rendering, search, filter, tag system, modals,
 * export/import, dark mode, and segment CRUD operations.
 */

(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────

  const state = {
    segments: [],
    searchQuery: '',
    dateFilter: 'all',   // 'all' | 'today' | 'week'
    activeTag: null,
    editingId: null,
    theme: 'dark',
  };

  // ─── DOM References ───────────────────────────────────────────────────────────

  const els = {
    segmentsList: document.getElementById('segments-list'),
    emptyState: document.getElementById('empty-state'),
    statsLine: document.getElementById('stats-line'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    filterChips: document.getElementById('filter-chips'),
    tagFilterRow: document.getElementById('tag-filter-row'),
    tagFilterChips: document.getElementById('tag-filter-chips'),
    tagClearBtn: document.getElementById('tag-clear-btn'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalNotes: document.getElementById('modal-notes'),
    modalTags: document.getElementById('modal-tags'),
    modalSave: document.getElementById('modal-save'),
    modalCancel: document.getElementById('modal-cancel'),
    modalClose: document.getElementById('modal-close'),
    btnTheme: document.getElementById('btn-theme'),
    btnExport: document.getElementById('btn-export'),
    btnImport: document.getElementById('btn-import'),
    importFileInput: document.getElementById('import-file-input'),
    popupToast: document.getElementById('popup-toast'),
  };

  // ─── Init ─────────────────────────────────────────────────────────────────────

  async function init() {
    loadTheme();
    await loadData();
    bindEvents();
    render();
  }

  // ─── Data Loading ─────────────────────────────────────────────────────────────

  async function loadData() {
    state.segments = await SegmentUtils.loadSegments();
  }

  // ─── Theme ────────────────────────────────────────────────────────────────────

  function loadTheme() {
    const saved = localStorage.getItem('ss-theme') || 'dark';
    applyTheme(saved);
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.body.className = theme;
    els.btnTheme.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('ss-theme', theme);
  }

  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  // ─── Filter & Search ──────────────────────────────────────────────────────────

  function getFilteredSegments() {
    let list = [...state.segments];

    // Text search
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.channelName || '').toLowerCase().includes(q) ||
        (s.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (s.notes || '').toLowerCase().includes(q)
      );
    }

    // Date filter
    const now = Date.now();
    if (state.dateFilter === 'today') {
      const start = new Date(); start.setHours(0,0,0,0);
      list = list.filter(s => s.createdAt >= start.getTime());
    } else if (state.dateFilter === 'week') {
      list = list.filter(s => s.createdAt >= now - 7 * 86400 * 1000);
    }

    // Tag filter
    if (state.activeTag) {
      list = list.filter(s => (s.tags || []).includes(state.activeTag));
    }

    return list;
  }

  function getAllTags() {
    const tagSet = new Set();
    for (const s of state.segments) {
      (s.tags || []).forEach(t => tagSet.add(t));
    }
    return [...tagSet].sort();
  }

  // ─── Rendering ────────────────────────────────────────────────────────────────

  function render() {
    const filtered = getFilteredSegments();

    // Stats line
    const total = state.segments.length;
    const totalTime = SegmentUtils.getTotalSavedTime(state.segments);
    els.statsLine.textContent = `${total} segment${total !== 1 ? 's' : ''} · ${SegmentUtils.formatTime(totalTime)} saved`;

    // Tag filter row
    renderTagFilter();

    // Empty state
    if (filtered.length === 0) {
      els.emptyState.style.display = 'flex';
      els.segmentsList.innerHTML = '';
      return;
    }
    els.emptyState.style.display = 'none';

    // Render segments (grouped by date)
    renderSegments(filtered);
  }

  function renderTagFilter() {
    const tags = getAllTags();
    if (tags.length === 0) {
      els.tagFilterRow.style.display = 'none';
      return;
    }
    els.tagFilterRow.style.display = 'flex';
    els.tagFilterChips.innerHTML = tags.map(tag =>
      `<button class="tag-chip-filter ${state.activeTag === tag ? 'active' : ''}" data-tag="${escHtml(tag)}">#${escHtml(tag)}</button>`
    ).join('');

    els.tagFilterChips.querySelectorAll('.tag-chip-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        state.activeTag = state.activeTag === tag ? null : tag;
        render();
      });
    });
  }

  function renderSegments(segments) {
    // Group by date
    const groups = {};
    for (const seg of segments) {
      const dateKey = getDateLabel(seg.createdAt);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(seg);
    }

    let html = '';
    for (const [label, segs] of Object.entries(groups)) {
      html += `<div class="date-divider">${label}</div>`;
      for (const seg of segs) {
        html += buildCardHtml(seg);
      }
    }

    els.segmentsList.innerHTML = html;

    // Bind card buttons
    els.segmentsList.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', handleCardAction);
    });
  }

  function buildCardHtml(seg) {
    const start = SegmentUtils.formatTime(seg.startTime);
    const end = SegmentUtils.formatTime(seg.endTime);
    const dur = SegmentUtils.getDuration(seg.startTime, seg.endTime);
    const thumb = seg.thumbnail || '';
    const title = escHtml(seg.title || 'Untitled');
    const channel = escHtml(seg.channelName || '');
    const tags = (seg.tags || []).map(t => `<span class="tag">#${escHtml(t)}</span>`).join('');
    const noteHtml = seg.notes
      ? `<div class="card-notes"><div class="card-note-text">${escHtml(seg.notes)}</div></div>`
      : '';

    return `
      <div class="segment-card" data-id="${seg.id}">
        <div class="card-top">
          <img class="card-thumb" src="${thumb}" alt="" loading="lazy" onerror="this.style.opacity=0.3" />
          <div class="card-meta">
            <div class="card-title" title="${title}">${title}</div>
            <div class="card-channel">${channel}</div>
            <div class="card-time-row">
              <span class="time-badge time-start">${start}</span>
              <span class="time-arrow">→</span>
              <span class="time-badge time-end">${end}</span>
              <span class="time-duration">${dur}</span>
            </div>
          </div>
        </div>
        ${tags ? `<div class="card-tags">${tags}</div>` : ''}
        ${noteHtml}
        <div class="card-actions">
          <button class="card-action-btn btn-play" data-action="play" data-id="${seg.id}" title="Play segment">
            <span class="btn-icon">▶</span> Play
          </button>
          <button class="card-action-btn btn-copy" data-action="copy" data-id="${seg.id}" title="Copy link with timestamp">
            <span class="btn-icon">📋</span> Copy
          </button>
          <button class="card-action-btn btn-edit" data-action="edit" data-id="${seg.id}" title="Edit notes & tags">
            <span class="btn-icon">✏️</span> Edit
          </button>
          <button class="card-action-btn btn-delete" data-action="delete" data-id="${seg.id}" title="Delete segment">
            <span class="btn-icon">🗑</span>
          </button>
        </div>
      </div>
    `;
  }

  // ─── Card Action Handling ─────────────────────────────────────────────────────

  function handleCardAction(e) {
    const btn = e.currentTarget;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const seg = state.segments.find(s => s.id === id);
    if (!seg) return;

    switch (action) {
      case 'play': playSegment(seg); break;
      case 'copy': copySegmentLink(seg); break;
      case 'edit': openEditModal(seg); break;
      case 'delete': deleteSegmentById(id); break;
    }
  }

  // ─── Play Segment ─────────────────────────────────────────────────────────────

  async function playSegment(seg) {
    // Build URL with start time + custom end param
    const url = `${seg.url}&t=${Math.floor(seg.startTime)}s&ss_end=${seg.endTime}`;

    // Find or open YouTube tab
    const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/watch*' });
    const videoId = SegmentUtils.extractVideoId(seg.url);

    const matchingTab = tabs.find(t => t.url.includes(`v=${videoId}`));
    if (matchingTab) {
      await chrome.tabs.update(matchingTab.id, { active: true, url });
    } else {
      await chrome.tabs.create({ url });
    }
    window.close();
  }

  // ─── Copy Link ────────────────────────────────────────────────────────────────

  async function copySegmentLink(seg) {
    const url = SegmentUtils.buildTimestampUrl(seg.url, seg.startTime);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied! ✓');
    } catch {
      showToast('Copy failed');
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────

  async function deleteSegmentById(id) {
    await SegmentUtils.deleteSegment(id);
    state.segments = state.segments.filter(s => s.id !== id);
    render();
    showToast('Segment deleted');
  }

  // ─── Edit Modal ───────────────────────────────────────────────────────────────

  function openEditModal(seg) {
    state.editingId = seg.id;
    els.modalTitle.textContent = 'Edit Segment';
    els.modalNotes.value = seg.notes || '';
    els.modalTags.value = (seg.tags || []).join(', ');
    els.modalOverlay.style.display = 'flex';
    els.modalNotes.focus();
  }

  function closeModal() {
    els.modalOverlay.style.display = 'none';
    state.editingId = null;
  }

  async function saveModal() {
    if (!state.editingId) return;

    const notes = els.modalNotes.value.trim();
    const tags = els.modalTags.value
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    await SegmentUtils.updateSegment(state.editingId, { notes, tags });
    await loadData();
    render();
    closeModal();
    showToast('Changes saved');
  }

  // ─── Export / Import ─────────────────────────────────────────────────────────

  async function handleExport() {
    const segments = await SegmentUtils.loadSegments();
    if (segments.length === 0) { showToast('Nothing to export'); return; }
    SegmentUtils.exportSegments(segments);
    showToast(`Exported ${segments.length} segments`);
  }

  async function handleImport(file) {
    try {
      const result = await SegmentUtils.importSegments(file);
      await loadData();
      render();
      showToast(`Imported ${result.imported}, skipped ${result.skipped}`);
    } catch (err) {
      showToast('Import failed — invalid file');
    }
  }

  // ─── Toast ────────────────────────────────────────────────────────────────────

  let toastTimer;
  function showToast(msg) {
    els.popupToast.textContent = msg;
    els.popupToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.popupToast.classList.remove('show'), 2200);
  }

  // ─── Bind Events ─────────────────────────────────────────────────────────────

  function bindEvents() {
    // Search
    els.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      els.clearSearch.style.display = state.searchQuery ? '' : 'none';
      render();
    });

    els.clearSearch.addEventListener('click', () => {
      state.searchQuery = '';
      els.searchInput.value = '';
      els.clearSearch.style.display = 'none';
      render();
    });

    // Date filter chips
    els.filterChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      state.dateFilter = chip.dataset.filter;
      els.filterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      render();
    });

    // Tag clear
    els.tagClearBtn.addEventListener('click', () => {
      state.activeTag = null;
      render();
    });

    // Modal
    els.modalClose.addEventListener('click', closeModal);
    els.modalCancel.addEventListener('click', closeModal);
    els.modalSave.addEventListener('click', saveModal);
    els.modalOverlay.addEventListener('click', (e) => {
      if (e.target === els.modalOverlay) closeModal();
    });

    // Keyboard: Escape closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // Theme toggle
    els.btnTheme.addEventListener('click', toggleTheme);

    // Export
    els.btnExport.addEventListener('click', handleExport);

    // Import
    els.btnImport.addEventListener('click', () => els.importFileInput.click());
    els.importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleImport(file);
      e.target.value = '';
    });

    // Storage change listener (e.g. segment added from content script)
    chrome.storage.onChanged.addListener(async (changes) => {
      if (changes.segments) {
        state.segments = changes.segments.newValue || [];
        render();
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getDateLabel(timestamp) {
    const now = new Date();
    const d = new Date(timestamp);

    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', init);

})();

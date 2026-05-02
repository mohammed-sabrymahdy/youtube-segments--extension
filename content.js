/**
 * content.js — SegmentSaver YouTube Content Script
 * Injects the floating overlay UI onto YouTube video pages.
 * Handles segment start/end selection, progress bar markers,
 * and keyboard shortcuts.
 */

(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────

  const state = {
    startTime: null,
    endTime: null,
    overlayVisible: true,
    tickInterval: null,
    markerElements: [],
    initialized: false,
  };

  // ─── Wait for YouTube Player ──────────────────────────────────────────────────

  function waitForPlayer(callback) {
    const check = () => {
      const player = document.querySelector('.html5-main-video');
      const controls = document.querySelector('.ytp-chrome-bottom');
      if (player && controls) {
        callback(player, controls);
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  }

  // ─── Get Current Video Info ───────────────────────────────────────────────────

  function getVideoInfo() {
    const player = document.querySelector('.html5-main-video');
    const videoId = SegmentUtils.extractVideoId(location.href);

    // Try multiple selectors for video title (YouTube changes these)
    const titleEl =
      document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string') ||
      document.querySelector('h1.title yt-formatted-string') ||
      document.querySelector('#title h1') ||
      document.querySelector('ytd-video-primary-info-renderer h1');

    const channelEl =
      document.querySelector('#channel-name a') ||
      document.querySelector('ytd-channel-name a') ||
      document.querySelector('.ytd-video-owner-renderer a');

    return {
      videoId,
      title: titleEl?.textContent?.trim() || document.title.replace(' - YouTube', '').trim(),
      channelName: channelEl?.textContent?.trim() || 'Unknown Channel',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: SegmentUtils.getThumbnailUrl(videoId),
      currentTime: player?.currentTime || 0,
    };
  }

  // ─── Build Overlay HTML ───────────────────────────────────────────────────────

  function buildOverlay() {
    const wrapper = document.createElement('div');
    wrapper.id = 'ss-overlay-wrapper';
    wrapper.style.cssText = `
      position: absolute;
      bottom: 0; left: 0; right: 0; top: 0;
      pointer-events: none;
      z-index: 9998;
    `;

    // Toggle button
    const toggleBtn = document.createElement('div');
    toggleBtn.id = 'ss-toggle-btn';
    toggleBtn.title = 'Toggle SegmentSaver';
    toggleBtn.innerHTML = '✂️';
    toggleBtn.addEventListener('click', toggleOverlay);

    // Main panel
    const panel = document.createElement('div');
    panel.id = 'ss-panel';
    panel.innerHTML = `
      <button class="ss-btn ss-btn-start" id="ss-btn-start" title="Start segment (S)">
        <span>⬤</span> Start
      </button>
      <button class="ss-btn ss-btn-end" id="ss-btn-end" title="End segment (E)" disabled>
        <span>◼</span> End
      </button>
      <div class="ss-divider"></div>
      <div id="ss-timestamp-display">
        <span class="ss-time-badge" id="ss-start-badge">--:--</span>
        <span class="ss-arrow">→</span>
        <span class="ss-time-badge" id="ss-end-badge">--:--</span>
        <span id="ss-duration-badge" style="display:none"></span>
      </div>
      <div class="ss-divider"></div>
      <button class="ss-btn ss-btn-save" id="ss-btn-save" title="Save segment" disabled>
        💾 Save
      </button>
      <div class="ss-divider"></div>
      <div id="ss-kb-hint">
        <span class="ss-key">Alt+S</span>
        <span class="ss-key">Alt+E</span>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'ss-overlay';
    overlay.appendChild(panel);

    wrapper.appendChild(toggleBtn);
    wrapper.appendChild(overlay);

    return wrapper;
  }

  // ─── Toast Notification ───────────────────────────────────────────────────────

  let toastTimeout;
  function showToast(message, type = 'info', icon = '') {
    let toast = document.getElementById('ss-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ss-toast';
      document.body.appendChild(toast);
    }

    clearTimeout(toastTimeout);
    toast.className = `ss-toast-${type}`;
    toast.innerHTML = `${icon ? `<span>${icon}</span>` : ''}<span>${message}</span>`;

    // Force reflow for animation
    toast.classList.remove('ss-toast-show');
    void toast.offsetWidth;
    toast.classList.add('ss-toast-show');

    toastTimeout = setTimeout(() => {
      toast.classList.remove('ss-toast-show');
    }, 2800);
  }

  // ─── Update UI State ──────────────────────────────────────────────────────────

  function updateUI() {
    const startBadge = document.getElementById('ss-start-badge');
    const endBadge = document.getElementById('ss-end-badge');
    const durationBadge = document.getElementById('ss-duration-badge');
    const btnStart = document.getElementById('ss-btn-start');
    const btnEnd = document.getElementById('ss-btn-end');
    const btnSave = document.getElementById('ss-btn-save');

    if (!startBadge) return;

    if (state.startTime !== null) {
      startBadge.textContent = SegmentUtils.formatTime(state.startTime);
      startBadge.classList.add('ss-start-set');
      btnStart.classList.add('ss-active');
      btnEnd.disabled = false;
    } else {
      startBadge.textContent = '--:--';
      startBadge.classList.remove('ss-start-set');
      btnStart.classList.remove('ss-active');
      btnEnd.disabled = true;
    }

    if (state.endTime !== null) {
      endBadge.textContent = SegmentUtils.formatTime(state.endTime);
      endBadge.classList.add('ss-end-set');
      durationBadge.textContent = SegmentUtils.getDuration(state.startTime, state.endTime);
      durationBadge.style.display = '';
    } else {
      endBadge.textContent = '--:--';
      endBadge.classList.remove('ss-end-set');
      durationBadge.style.display = 'none';
    }

    btnSave.disabled = !(state.startTime !== null && state.endTime !== null && state.endTime > state.startTime);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  function handleStart() {
    const player = document.querySelector('.html5-main-video');
    if (!player) return;
    state.startTime = player.currentTime;
    state.endTime = null;
    updateUI();
    showToast(`Segment started at ${SegmentUtils.formatTime(state.startTime)}`, 'success', '🟢');
  }

  function handleEnd() {
    const player = document.querySelector('.html5-main-video');
    if (!player || state.startTime === null) return;

    const current = player.currentTime;
    if (current <= state.startTime) {
      showToast('End time must be after start time', 'error', '⚠️');
      return;
    }
    state.endTime = current;
    updateUI();
    showToast(`Segment ends at ${SegmentUtils.formatTime(state.endTime)}`, 'info', '🔴');
  }

  async function handleSave() {
    if (state.startTime === null || state.endTime === null) return;

    const info = getVideoInfo();
    const segment = {
      id: SegmentUtils.generateId(),
      videoId: info.videoId,
      title: info.title,
      channelName: info.channelName,
      url: info.url,
      thumbnail: info.thumbnail,
      startTime: state.startTime,
      endTime: state.endTime,
      tags: [],
      notes: '',
      createdAt: Date.now(),
    };

    const result = await SegmentUtils.addSegment(segment);

    if (result.success) {
      showToast('Segment saved!', 'success', '✅');
      // Reset state
      state.startTime = null;
      state.endTime = null;
      updateUI();
      // Refresh markers
      setTimeout(renderProgressMarkers, 300);
    } else if (result.reason === 'duplicate') {
      showToast('This segment already exists', 'error', '⚠️');
    }
  }

  function toggleOverlay() {
    const overlay = document.getElementById('ss-overlay');
    if (!overlay) return;
    state.overlayVisible = !state.overlayVisible;
    overlay.style.display = state.overlayVisible ? '' : 'none';
  }

  // ─── Progress Bar Markers ─────────────────────────────────────────────────────

  async function renderProgressMarkers() {
    const progressBar = document.querySelector('.ytp-progress-bar');
    if (!progressBar) return;

    const player = document.querySelector('.html5-main-video');
    if (!player || !player.duration) return;

    const duration = player.duration;

    // Remove old markers
    document.querySelectorAll('.ss-progress-marker, .ss-progress-segment').forEach(el => el.remove());

    const segments = await SegmentUtils.loadSegments();
    const videoId = SegmentUtils.extractVideoId(location.href);
    const videoSegments = segments.filter(s => s.videoId === videoId);

    for (const seg of videoSegments) {
      // Draw segment range
      const segEl = document.createElement('div');
      segEl.className = 'ss-progress-segment';
      const startPct = (seg.startTime / duration) * 100;
      const endPct = (seg.endTime / duration) * 100;
      segEl.style.left = `${startPct}%`;
      segEl.style.width = `${endPct - startPct}%`;
      progressBar.appendChild(segEl);

      // Start marker
      const startMarker = document.createElement('div');
      startMarker.className = 'ss-progress-marker';
      startMarker.style.left = `${startPct}%`;
      startMarker.style.background = '#00e676';
      progressBar.appendChild(startMarker);

      // End marker
      const endMarker = document.createElement('div');
      endMarker.className = 'ss-progress-marker';
      endMarker.style.left = `${endPct}%`;
      endMarker.style.background = '#ff3b5c';
      progressBar.appendChild(endMarker);
    }
  }

  // ─── Auto-Pause at End Time (for "Play Segment" from popup) ──────────────────

  function setupPlaybackWatcher() {
    const player = document.querySelector('.html5-main-video');
    if (!player) return;

    player.addEventListener('timeupdate', () => {
      const params = new URLSearchParams(location.search);
      const ssEnd = parseFloat(params.get('ss_end'));
      if (!isNaN(ssEnd) && player.currentTime >= ssEnd) {
        player.pause();
        // Remove param from URL without reload
        params.delete('ss_end');
        const newUrl = `${location.pathname}?${params.toString()}`;
        history.replaceState(null, '', newUrl);
        showToast('Segment finished', 'info', '⏸');
      }
    });
  }

  // ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only fire if not typing in a text field
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleStart();
      } else if (e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleEnd();
      }
    });
  }

  // ─── Mount Overlay ────────────────────────────────────────────────────────────

  function mountOverlay() {
    const playerContainer = document.querySelector('#movie_player') ||
                            document.querySelector('.html5-video-player');
    if (!playerContainer) return;

    // Remove any old overlay
    document.getElementById('ss-overlay-wrapper')?.remove();

    const overlay = buildOverlay();
    playerContainer.appendChild(overlay);

    // Wire up buttons
    document.getElementById('ss-btn-start')?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleStart();
    });
    document.getElementById('ss-btn-end')?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleEnd();
    });
    document.getElementById('ss-btn-save')?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleSave();
    });

    // Start live timestamp ticking
    if (state.tickInterval) clearInterval(state.tickInterval);
    state.tickInterval = setInterval(updateUI, 500);

    // Render markers after a short delay
    setTimeout(renderProgressMarkers, 1500);

    // Auto-pause watcher
    setupPlaybackWatcher();
  }

  // ─── Handle YouTube SPA Navigation ───────────────────────────────────────────

  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (location.pathname === '/watch') {
        state.startTime = null;
        state.endTime = null;
        setTimeout(mountOverlay, 1500);
        setTimeout(renderProgressMarkers, 3000);
      }
    }
  });

  // ─── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    waitForPlayer((player) => {
      mountOverlay();
      setupKeyboardShortcuts();

      // Watch for SPA navigation
      observer.observe(document.body, { childList: true, subtree: true });

      // Re-render markers when video duration loads
      player.addEventListener('loadedmetadata', () => {
        setTimeout(renderProgressMarkers, 500);
      });
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

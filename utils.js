

const SegmentUtils = (() => {

  // ─── Time Formatting ────────────────────────────────────────────────────────

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Converts mm:ss or hh:mm:ss string back to seconds
   * @param {string} timeStr
   * @returns {number}
   */
  function parseTime(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }

  function getDuration(start, end) {
    return formatTime(end - start);
  }

  // ─── ID Generation ───────────────────────────────────────────────────────────

  function generateId() {
    return `seg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // ─── URL Helpers ─────────────────────────────────────────────────────────────


  function extractVideoId(url) {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }


  function buildTimestampUrl(videoUrl, startTime) {
    const base = videoUrl.split('&t=')[0].split('#')[0];
    return `${base}&t=${Math.floor(startTime)}s`;
  }


  function getThumbnailUrl(videoId) {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }

  // ─── Storage API ─────────────────────────────────────────────────────────────

  async function loadSegments() {
    return new Promise((resolve) => {
      chrome.storage.local.get('segments', (result) => {
        resolve(result.segments || []);
      });
    });
  }

  async function saveSegments(segments) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ segments }, resolve);
    });
  }


  async function addSegment(segment) {
    const segments = await loadSegments();

    const isDuplicate = segments.some(s =>
      s.videoId === segment.videoId &&
      Math.abs(s.startTime - segment.startTime) < 2 &&
      Math.abs(s.endTime - segment.endTime) < 2
    );

    if (isDuplicate) {
      return { success: false, reason: 'duplicate' };
    }

    segments.unshift(segment); // newest first
    await saveSegments(segments);
    return { success: true };
  }


  async function deleteSegment(id) {
    const segments = await loadSegments();
    await saveSegments(segments.filter(s => s.id !== id));
  }


  async function updateSegment(id, updates) {
    const segments = await loadSegments();
    const idx = segments.findIndex(s => s.id === id);
    if (idx !== -1) {
      segments[idx] = { ...segments[idx], ...updates };
      await saveSegments(segments);
    }
  }

  // ─── Stats ────────────────────────────────────────────────────────────────────

  function getTotalSavedTime(segments) {
    return segments.reduce((acc, s) => acc + (s.endTime - s.startTime), 0);
  }

  // ─── Export / Import ─────────────────────────────────────────────────────────

  function exportSegments(segments) {
    const json = JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString(), segments }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `segment-saver-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }


  async function importSegments(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const incoming = data.segments || [];
          const existing = await loadSegments();
          const existingIds = new Set(existing.map(s => s.id));

          let imported = 0;
          let skipped = 0;
          for (const seg of incoming) {
            if (existingIds.has(seg.id)) { skipped++; continue; }
            existing.push(seg);
            imported++;
          }
          await saveSegments(existing);
          resolve({ imported, skipped });
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────────
  return {
    formatTime,
    parseTime,
    getDuration,
    generateId,
    extractVideoId,
    buildTimestampUrl,
    getThumbnailUrl,
    loadSegments,
    saveSegments,
    addSegment,
    deleteSegment,
    updateSegment,
    getTotalSavedTime,
    exportSegments,
    importSegments,
  };
})();

if (typeof module !== 'undefined') module.exports = SegmentUtils;

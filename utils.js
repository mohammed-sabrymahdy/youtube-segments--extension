/**
 * utils.js — Shared utilities for SegmentSaver
 * Used by both content.js and popup.js
 */

const SegmentUtils = (() => {

  // ─── Time Formatting ────────────────────────────────────────────────────────

  /**
   * Converts raw seconds to mm:ss or hh:mm:ss string
   * @param {number} seconds
   * @returns {string}
   */
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

  /**
   * Returns duration string between two timestamps
   * @param {number} start
   * @param {number} end
   * @returns {string}
   */
  function getDuration(start, end) {
    return formatTime(end - start);
  }

  // ─── ID Generation ───────────────────────────────────────────────────────────

  /**
   * Generates a unique segment ID
   * @returns {string}
   */
  function generateId() {
    return `seg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // ─── URL Helpers ─────────────────────────────────────────────────────────────

  /**
   * Extracts YouTube video ID from a URL
   * @param {string} url
   * @returns {string|null}
   */
  function extractVideoId(url) {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }

  /**
   * Builds a YouTube URL with start time
   * @param {string} videoUrl
   * @param {number} startTime
   * @returns {string}
   */
  function buildTimestampUrl(videoUrl, startTime) {
    const base = videoUrl.split('&t=')[0].split('#')[0];
    return `${base}&t=${Math.floor(startTime)}s`;
  }

  /**
   * Gets YouTube thumbnail URL for a video ID
   * @param {string} videoId
   * @returns {string}
   */
  function getThumbnailUrl(videoId) {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }

  // ─── Storage API ─────────────────────────────────────────────────────────────

  /**
   * Loads all saved segments from chrome.storage.local
   * @returns {Promise<Array>}
   */
  async function loadSegments() {
    return new Promise((resolve) => {
      chrome.storage.local.get('segments', (result) => {
        resolve(result.segments || []);
      });
    });
  }

  /**
   * Saves the full segments array to chrome.storage.local
   * @param {Array} segments
   * @returns {Promise<void>}
   */
  async function saveSegments(segments) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ segments }, resolve);
    });
  }

  /**
   * Adds a single segment, checking for duplicates first
   * @param {Object} segment
   * @returns {Promise<{success: boolean, reason?: string}>}
   */
  async function addSegment(segment) {
    const segments = await loadSegments();

    // Duplicate detection: same video + overlapping start/end within 2 seconds
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

  /**
   * Deletes a segment by ID
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function deleteSegment(id) {
    const segments = await loadSegments();
    await saveSegments(segments.filter(s => s.id !== id));
  }

  /**
   * Updates a segment by ID
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<void>}
   */
  async function updateSegment(id, updates) {
    const segments = await loadSegments();
    const idx = segments.findIndex(s => s.id === id);
    if (idx !== -1) {
      segments[idx] = { ...segments[idx], ...updates };
      await saveSegments(segments);
    }
  }

  // ─── Stats ────────────────────────────────────────────────────────────────────

  /**
   * Calculates total saved time across all segments
   * @param {Array} segments
   * @returns {number} total seconds
   */
  function getTotalSavedTime(segments) {
    return segments.reduce((acc, s) => acc + (s.endTime - s.startTime), 0);
  }

  // ─── Export / Import ─────────────────────────────────────────────────────────

  /**
   * Serializes segments to JSON and triggers download
   * @param {Array} segments
   */
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

  /**
   * Imports segments from a JSON file, merging with existing
   * @param {File} file
   * @returns {Promise<{imported: number, skipped: number}>}
   */
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

// Make available globally (both content script and popup)
if (typeof module !== 'undefined') module.exports = SegmentUtils;

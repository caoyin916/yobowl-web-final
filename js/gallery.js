/* ===== Yo Bowl Gallery =====
 *
 * HOW PUBLISHING WORKS (no backend / static hosting):
 *  - PUBLIC visitors always see the real image files inside the gallery-photo/
 *    folder, listed in gallery-photo/photos.json. These are the live photos.
 *  - The OWNER uses admin mode as a PREVIEW + PACKAGING tool. New photos added
 *    in admin mode are kept locally in this browser (IndexedDB) ONLY — they are
 *    NOT visible to the public yet. To publish, the owner clicks
 *    "Download publish bundle", which produces a gallery-photo.zip containing
 *    every photo + an auto-generated photos.json. They upload + extract that zip
 *    on Hostinger, and then everyone sees the new gallery.
 */
(function () {
  const DB_NAME = 'yobowl-gallery';
  const STORE = 'photos';
  let db;
  let loaded = [];         // [{id, url, w, h, file?}]  file=true => published folder photo
  let adminOn = false;
  let hiddenCount = 0;     // published photos the owner has marked for removal

  /* ---------- IndexedDB (admin working set only) ---------- */
  function openDB() {
    return new Promise((resolve) => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      let r;
      try { r = indexedDB.open(DB_NAME, 1); }
      catch (e) { db = null; return done(); }
      r.onupgradeneeded = (e) =>
        e.target.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      r.onsuccess = (e) => { db = e.target.result; done(); };
      r.onerror = () => { db = null; done(); };
      r.onblocked = () => { db = null; done(); };
      setTimeout(done, 2000);
    });
  }
  function addPhoto(blob) {
    return new Promise((res, rej) => {
      if (!db) return rej(new Error('no-db'));
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add({ blob, ts: Date.now() });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }
  function allPhotos() {
    return new Promise((res, rej) => {
      if (!db) return res([]);
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
  }
  function getBlob(id) {
    return new Promise((res) => {
      if (!db) return res(null);
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => res(req.result ? req.result.blob : null);
      req.onerror = () => res(null);
    });
  }
  function deletePhoto(id) {
    return new Promise((res, rej) => {
      if (!db) return res();
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }

  const grid = () => document.getElementById('galleryGrid');
  const empty = () => document.getElementById('galleryEmpty');
  const count = () => document.getElementById('galleryCount');

  /* ---------- Load images + natural dimensions ---------- */
  function loadDims(photo) {
    return new Promise((res) => {
      const url = URL.createObjectURL(photo.blob);
      const im = new Image();
      im.onload = () =>
        res({ id: photo.id, key: 'idb:' + photo.id, url, w: im.naturalWidth || 1, h: im.naturalHeight || 1 });
      im.onerror = () => res({ id: photo.id, key: 'idb:' + photo.id, url, w: 1, h: 1 });
      im.src = url;
    });
  }

  // Published photos: real files in gallery-photo/, listed in photos.json.
  // Shown to EVERY visitor.
  async function folderPhotos() {
    try {
      const res = await fetch('gallery-photo/photos.json', { cache: 'no-store' });
      if (!res.ok) return [];
      const list = await res.json();
      if (!Array.isArray(list)) return [];
      const dims = await Promise.all(list.map((name, i) => new Promise((resolve) => {
        const url = 'gallery-photo/' + name;
        const im = new Image();
        im.onload = () => resolve({ id: 'file-' + i, key: 'file:' + name, name, url, w: im.naturalWidth || 1, h: im.naturalHeight || 1, file: true });
        im.onerror = () => resolve(null);
        im.src = url;
      })));
      return dims.filter(Boolean);
    } catch (e) { return []; }
  }

  /* ---------- Custom display order (admin drag-to-reorder) ----------
     Persisted as an array of stable photo keys in localStorage. Items not
     present in the saved order (e.g. brand-new uploads, or photos renamed
     after a publish) fall to the end in their natural order, so the order
     self-heals and never loses a photo. */
  const ORDER_KEY = 'yobowl-gallery-order';
  function loadOrder() {
    try { const a = JSON.parse(localStorage.getItem(ORDER_KEY)); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function saveCurrentOrder() {
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(loaded.map((it) => it.key))); }
    catch (e) {}
  }
  function applyOrder(items) {
    const order = loadOrder();
    if (!order.length) return items;
    const pos = new Map(order.map((k, i) => [k, i]));
    // Stable sort: known keys by saved index, unknown keys keep relative order.
    return items
      .map((it, i) => ({ it, i, p: pos.has(it.key) ? pos.get(it.key) : Infinity }))
      .sort((a, b) => (a.p - b.p) || (a.i - b.i))
      .map((x) => x.it);
  }
  function reorder(srcKey, targetKey, before) {
    if (!srcKey || srcKey === targetKey) return;
    const from = loaded.findIndex((x) => x.key === srcKey);
    if (from < 0) return;
    const [item] = loaded.splice(from, 1);
    let to = loaded.findIndex((x) => x.key === targetKey);
    if (to < 0) { loaded.push(item); }
    else { if (!before) to += 1; loaded.splice(to, 0, item); }
    saveCurrentOrder();
    build();
  }
  function clearDropMarkers() {
    document.querySelectorAll('.g-item.drop-before, .g-item.drop-after')
      .forEach((el) => el.classList.remove('drop-before', 'drop-after'));
  }

  /* ---------- Pending removal of published (Live) photos ----------
     Static hosting can't delete a server file from the browser, so removing a
     Live photo records its key locally and simply leaves it out of the preview
     and the next publish bundle. Once the owner publishes, the regenerated
     photos.json no longer lists it, so it disappears for everyone. */
  const REMOVED_KEY = 'yobowl-gallery-removed';
  function loadRemoved() {
    try { const a = JSON.parse(localStorage.getItem(REMOVED_KEY)); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function setRemoved(key, on) {
    const s = new Set(loadRemoved());
    if (on) s.add(key); else s.delete(key);
    try { localStorage.setItem(REMOVED_KEY, JSON.stringify([...s])); } catch (e) {}
  }
  function restoreRemoved() {
    try { localStorage.removeItem(REMOVED_KEY); } catch (e) {}
  }

  async function refresh() {
    loaded.forEach((it) => { if (!it.file) URL.revokeObjectURL(it.url); });
    loaded = [];
    const folder = await folderPhotos();
    let browser = [];
    try {
      const photos = (await allPhotos()).sort((a, b) => a.ts - b.ts);
      browser = await Promise.all(photos.map(loadDims));
    } catch (e) { browser = []; }
    loaded = applyOrder(folder.concat(browser));

    // Apply the owner's pending removals (hide photos marked for deletion).
    hiddenCount = 0;
    const removed = loadRemoved();
    if (removed.length) {
      loaded = loaded.filter((it) => {
        if (removed.indexOf(it.key) >= 0) { if (it.file) hiddenCount++; return false; }
        return true;
      });
    }

    const em = empty();
    if (em) em.style.display = loaded.length ? 'none' : 'block';
    updateCount();
    updateRestore();
    build();
  }

  function updateRestore() {
    const btn = document.getElementById('galleryRestore');
    if (!btn) return;
    btn.hidden = !(adminOn && hiddenCount > 0);
    btn.textContent = `Restore ${hiddenCount} removed`;
  }

  function updateCount() {
    const c = count();
    if (!c) return;
    const live = loaded.filter((it) => it.file).length;
    const preview = loaded.length - live;
    if (!loaded.length) { c.textContent = ''; return; }
    if (adminOn && preview > 0) {
      c.textContent = `${live} live · ${preview} preview (unpublished)`;
    } else {
      c.textContent = `${loaded.length} photo${loaded.length > 1 ? 's' : ''}`;
    }
  }

  /* ---------- Single-column full-width stacked layout ---------- */
  function build() {
    const g = grid();
    if (!g) return;
    const wrap = g.closest('.wrap');
    if (wrap && getComputedStyle(wrap).maxWidth === 'none') {
      requestAnimationFrame(build);
      return;
    }
    const W = g.clientWidth;
    if (!W || W < 40) { requestAnimationFrame(build); return; }
    g.innerHTML = '';
    if (!loaded.length) return;

    let dragSrcKey = null;
    loaded.forEach((it) => {
      const ar = Math.max(it.w / it.h, 0.2);
      const w = W;
      const h = W / ar; // full width, natural aspect ratio

      const rowEl = document.createElement('div');
      rowEl.className = 'g-row';

      const fig = document.createElement('figure');
      fig.className = 'g-item';
      fig.style.width = w + 'px';
      fig.style.height = h + 'px';

      const img = document.createElement('img');
      img.src = it.url;
      img.alt = 'Yo Bowl Carrollton dish photo';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.draggable = false; // let the figure own the drag, not the image
      if (it.w && it.h) { img.width = it.w; img.height = it.h; }
      fig.appendChild(img);

      // Admin-only overlays: status tag, delete, and drag-to-reorder.
      if (adminOn) {
        const tag = document.createElement('span');
        tag.className = 'g-tag ' + (it.file ? 'g-tag--live' : 'g-tag--preview');
        tag.textContent = it.file ? 'Live' : 'Preview · not yet published';
        fig.appendChild(tag);

        const grip = document.createElement('span');
        grip.className = 'g-grip';
        grip.title = 'Drag to reorder';
        grip.setAttribute('aria-label', 'Drag to reorder');
        grip.innerHTML = '&#x2059;'; // dotted grip glyph
        fig.appendChild(grip);

        const del = document.createElement('button');
        del.className = 'g-del';
        del.type = 'button';
        del.setAttribute('aria-label', 'Remove photo');
        del.innerHTML = '&times;';
        if (!it.file) {
          // Preview photo: delete from this device's working set.
          del.title = 'Remove this photo';
          del.addEventListener('click', async () => { await deletePhoto(it.id); refresh(); });
        } else {
          // Live photo: mark for removal from the next publish bundle.
          del.title = 'Remove this photo from your gallery';
          del.addEventListener('click', () => {
            if (!confirm('Remove this published photo from your gallery?\n\nIt disappears from the preview now and from your live site once you publish the next bundle. You can Restore it until then.')) return;
            setRemoved(it.key, true);
            refresh();
          });
        }
        fig.appendChild(del);

        // Drag-to-reorder (desktop). Each photo is its own full-width row.
        fig.draggable = true;
        fig.addEventListener('dragstart', (e) => {
          dragSrcKey = it.key;
          fig.classList.add('dragging');
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', it.key); } catch (_) {}
          }
        });
        fig.addEventListener('dragend', () => { fig.classList.remove('dragging'); clearDropMarkers(); });
        fig.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          const r = fig.getBoundingClientRect();
          const before = e.clientY < r.top + r.height / 2;
          fig.classList.toggle('drop-before', before);
          fig.classList.toggle('drop-after', !before);
        });
        fig.addEventListener('dragleave', () => fig.classList.remove('drop-before', 'drop-after'));
        fig.addEventListener('drop', (e) => {
          e.preventDefault();
          const before = fig.classList.contains('drop-before');
          clearDropMarkers();
          reorder(dragSrcKey, it.key, before);
        });
      }

      rowEl.appendChild(fig);
      g.appendChild(rowEl);
    });
  }

  /* ---------- Upload handling (admin working set) ---------- */
  async function handleFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    if (!db) { alert('This browser is blocking local photo storage, so previews can\u2019t be saved here. Try a normal (non-private) window.'); return; }
    for (const f of files) await addPhoto(f);
    refresh();
  }

  /* ---------- Publish bundle (zip) ---------- */
  let CRC_TABLE;
  function crc32(bytes) {
    if (!CRC_TABLE) {
      CRC_TABLE = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        CRC_TABLE[n] = c >>> 0;
      }
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  // Minimal store-only (no compression) ZIP writer. Images are already
  // compressed, so storing them as-is keeps this tiny and dependency-free.
  function makeZip(entries) {
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    const u16 = (n) => [n & 0xff, (n >> 8) & 0xff];
    const u32 = (n) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];

    for (const f of entries) {
      const nameBytes = enc.encode(f.name);
      const crc = crc32(f.data);
      const size = f.data.length;
      const local = new Uint8Array([].concat(
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0)
      ));
      chunks.push(local, nameBytes, f.data);
      const cen = new Uint8Array([].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(size), u32(size), u16(nameBytes.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)
      ));
      central.push({ header: cen, name: nameBytes });
      offset += local.length + nameBytes.length + size;
    }

    const centralStart = offset;
    let centralSize = 0;
    for (const c of central) { chunks.push(c.header, c.name); centralSize += c.header.length + c.name.length; }
    chunks.push(new Uint8Array([].concat(
      u32(0x06054b50), u16(0), u16(0),
      u16(central.length), u16(central.length),
      u32(centralSize), u32(centralStart), u16(0)
    )));
    return new Blob(chunks, { type: 'application/zip' });
  }

  function extFromType(type) {
    if (type === 'image/png') return 'png';
    if (type === 'image/webp') return 'webp';
    if (type === 'image/gif') return 'gif';
    return 'jpg';
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  const HOWTO = [
    'HOW TO PUBLISH YOUR GALLERY PHOTOS (Hostinger)',
    '==============================================',
    '',
    'This bundle is your COMPLETE gallery. Whatever you saw in the preview is',
    'exactly what visitors will see once you upload it.',
    '',
    '1. Log in to Hostinger -> hPanel -> Websites -> Manage -> File Manager.',
    '2. Open your website folder (usually "public_html").',
    '3. Click Upload and upload this file: gallery-photo.zip',
    '4. Right-click the uploaded gallery-photo.zip -> Extract.',
    '   When asked, allow it to OVERWRITE existing files.',
    '   (This refreshes the gallery-photo folder with your new photos + list.)',
    '5. Delete gallery-photo.zip afterwards (optional, keeps things tidy).',
    '6. Open your Gallery page and refresh - the photos are now live for everyone.',
    '',
    'Notes:',
    '- You never need to edit any code or the photos.json file by hand;',
    '  this bundle regenerates it for you automatically.',
    '- To remove a photo later, either delete it here and re-export the bundle,',
    '  or delete its file directly in the gallery-photo folder on Hostinger.'
  ].join('\n');

  async function exportBundle() {
    if (!loaded.length) { alert('Add at least one photo before downloading the bundle.'); return; }
    const btn = document.getElementById('galleryExport');
    const prev = btn ? btn.textContent : '';
    if (btn) { btn.textContent = 'Packaging…'; btn.disabled = true; }
    try {
      const entries = [];
      const names = [];
      let i = 0;
      for (const it of loaded) {
        let blob;
        if (it.file) {
          const r = await fetch(it.url, { cache: 'no-store' });
          if (!r.ok) continue;
          blob = await r.blob();
        } else {
          blob = await getBlob(it.id);
        }
        if (!blob) continue;
        i++;
        const name = 'photo-' + i + '.' + extFromType(blob.type);
        names.push(name);
        entries.push({ name: 'gallery-photo/' + name, data: new Uint8Array(await blob.arrayBuffer()) });
      }
      if (!entries.length) { alert('Could not read the photos to package. Please try again.'); return; }
      const enc = new TextEncoder();
      entries.push({ name: 'gallery-photo/photos.json', data: enc.encode(JSON.stringify(names, null, 2)) });
      entries.push({ name: 'gallery-photo/HOW-TO-PUBLISH.txt', data: enc.encode(HOWTO) });
      downloadBlob(makeZip(entries), 'gallery-photo.zip');
    } catch (e) {
      alert('Sorry, something went wrong building the bundle. Please try again.');
    } finally {
      if (btn) { btn.textContent = prev; btn.disabled = false; }
    }
  }

  async function init() {
    try { await openDB(); } catch (e) { db = null; }
    await refresh();
    setupAdmin();

    const input = document.getElementById('galleryInput');
    const drop = document.getElementById('galleryDrop');

    if (input) input.addEventListener('change', (e) => { handleFiles(e.target.files); input.value = ''; });

    if (drop) {
      ['dragenter', 'dragover'].forEach((ev) =>
        drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach((ev) =>
        drop.addEventListener(ev, (e) => {
          e.preventDefault();
          if (ev === 'dragleave' && drop.contains(e.relatedTarget)) return;
          drop.classList.remove('drag');
        }));
      drop.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
      });
    }

    const exportBtn = document.getElementById('galleryExport');
    if (exportBtn) exportBtn.addEventListener('click', exportBundle);

    const clearBtn = document.getElementById('galleryClear');
    if (clearBtn) clearBtn.addEventListener('click', async () => {
      if (!confirm('Remove all the preview photos you added on this device? (Live published photos are not affected.)')) return;
      const photos = await allPhotos();
      for (const p of photos) await deletePhoto(p.id);
      refresh();
    });

    const restoreBtn = document.getElementById('galleryRestore');
    if (restoreBtn) restoreBtn.addEventListener('click', () => { restoreRemoved(); refresh(); });

    let lastW = grid() ? grid().clientWidth : 0;
    let t;
    if (window.ResizeObserver && grid()) {
      const ro = new ResizeObserver(() => {
        const w = grid().clientWidth;
        if (w && w !== lastW) { lastW = w; clearTimeout(t); t = setTimeout(build, 60); }
      });
      ro.observe(grid());
    }
    window.addEventListener('load', () => { if (grid()) { lastW = grid().clientWidth; build(); } });
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 120); });
  }

  /* ---------- Discreet owner-only admin ----------
     Unlock: visit Gallery.html#admin and enter the passcode.
     Stays unlocked in this browser (localStorage) until "Lock". */
  const ADMIN_PASSCODE = 'yobowl';
  const ADMIN_KEY = 'yobowl-gallery-admin';

  function applyAdmin(on) {
    adminOn = on;
    const bar = document.getElementById('galleryToolbar');
    const drop = document.getElementById('galleryDrop');
    const note = document.getElementById('galleryAdminNote');
    const em = document.getElementById('galleryEmpty');
    if (bar) bar.hidden = !on;
    if (drop) drop.hidden = !on;
    if (note) note.hidden = !on;
    if (em) {
      em.textContent = on
        ? 'No photos yet. Use “Upload Photos” to add your first one.'
        : 'Photos coming soon — check back shortly!';
    }
    updateCount();
    updateRestore();
    build();
  }

  function promptUnlock() {
    const entry = prompt('Enter gallery admin passcode:');
    if (entry !== null && entry === ADMIN_PASSCODE) {
      localStorage.setItem(ADMIN_KEY, 'yes');
      history.replaceState(null, '', location.pathname);
      applyAdmin(true);
      return true;
    } else if (entry !== null) {
      alert('Incorrect passcode.');
    }
    return false;
  }

  function setupAdmin() {
    const unlocked = localStorage.getItem(ADMIN_KEY) === 'yes';
    if (!unlocked && location.hash.toLowerCase() === '#admin') {
      promptUnlock();
    } else {
      applyAdmin(unlocked);
    }

    const lockBtn = document.getElementById('galleryLock');
    if (lockBtn) lockBtn.addEventListener('click', () => {
      localStorage.removeItem(ADMIN_KEY);
      applyAdmin(false);
    });

    window.addEventListener('hashchange', () => {
      if (localStorage.getItem(ADMIN_KEY) === 'yes') return;
      if (location.hash.toLowerCase() !== '#admin') return;
      promptUnlock();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

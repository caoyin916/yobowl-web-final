/* Yo Bowl — Menu page: category filter + dish photo dialog.
   Dishes are static buttons in Menu.html; a button's data-photo (if any)
   is the image shown, otherwise the dialog shows "Picture coming soon". */
(function () {
  'use strict';

  var list = document.querySelector('.menu-cats');
  if (!list) return;

  var items = Array.prototype.slice.call(list.querySelectorAll('.menu-item'));
  var cats = Array.prototype.slice.call(list.querySelectorAll('.menu-cat'));

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function clones(nodes) {
    return Array.prototype.map.call(nodes, function (n) { return n.cloneNode(true); });
  }

  /* --- Camera icon on dishes that have a photo (inserted right after the name) --- */
  items.forEach(function (item) {
    if (!item.hasAttribute('data-photo')) return;
    var en = item.querySelector('.menu-item-en');
    var icon = el('span', 'photo-icon');
    icon.setAttribute('aria-hidden', 'true');
    en.insertBefore(icon, en.firstChild.nextSibling);
  });

  /* --- Category filter --- */
  var filter = document.querySelector('.menu-filter');
  if (filter) {
    var buttons = Array.prototype.slice.call(filter.querySelectorAll('[data-filter]'));
    filter.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter]');
      if (!btn) return;
      var key = btn.getAttribute('data-filter');
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      cats.forEach(function (c) { c.hidden = key !== 'all' && c.id !== key; });
      list.classList.toggle('is-filtered', key !== 'all');

      // If the bar is stuck over the list, bring the top of the results back up under it.
      var barBottom = filter.getBoundingClientRect().bottom;
      var listTop = list.getBoundingClientRect().top;
      if (listTop < barBottom) window.scrollTo(0, window.scrollY + listTop - barBottom);
    });
  }

  /* --- Dish photo dialog --- */
  var dialog = document.getElementById('dishDialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  var media = dialog.querySelector('.dish-dialog-media');
  var catEl = dialog.querySelector('.dish-dialog-cat');
  var titleEl = dialog.querySelector('#dishDialogTitle');
  var priceEl = dialog.querySelector('.dish-dialog-price');
  var cnEl = dialog.querySelector('.dish-dialog-cn');
  var noteEl = dialog.querySelector('.dish-dialog-note');
  var flagsEl = dialog.querySelector('.dish-dialog-flags');

  function showPlaceholder() {
    var box = el('div', 'dish-dialog-placeholder');
    var logo = el('img');
    logo.src = 'logo.png';
    logo.alt = '';
    box.append(logo, el('strong', '', 'Picture coming soon'), el('span', '', '图片即将上线'));
    media.appendChild(box);
  }

  // contain = show the whole image on white (product cutouts), instead of crop-to-fill.
  function showPhoto(src, alt, contain) {
    var img = el('img', 'dish-photo');
    img.alt = alt;
    media.classList.add('is-loading');
    if (contain) media.classList.add('is-contain');
    // Guards: a slow image from a previously opened dish must not touch the current one.
    img.onload = function () {
      if (img.parentNode !== media) return;
      if (!contain && img.naturalHeight > img.naturalWidth) media.classList.add('is-portrait');
      media.classList.remove('is-loading');
      img.classList.add('is-loaded');
    };
    img.onerror = function () {
      if (img.parentNode !== media) return;
      media.classList.remove('is-loading');
      media.replaceChildren();
      showPlaceholder();
    };
    img.src = src;
    media.appendChild(img);
  }

  function openDish(item) {
    var en = item.querySelector('.menu-item-en').firstChild.textContent.trim();
    var cn = item.querySelector('.menu-item-cn');
    var note = item.querySelector('.menu-item-note');
    var photo = item.getAttribute('data-photo');

    media.replaceChildren();
    media.className = 'dish-dialog-media';
    if (photo) showPhoto(photo, en, item.getAttribute('data-photo-fit') === 'contain'); else showPlaceholder();

    catEl.textContent = item.closest('.menu-cat').querySelector('.menu-cat-head h3').textContent;
    titleEl.textContent = en;
    priceEl.replaceChildren.apply(priceEl, clones(item.querySelector('.menu-item-price').childNodes));
    cnEl.textContent = cn ? cn.textContent : '';
    noteEl.textContent = note ? note.textContent : '';
    flagsEl.replaceChildren.apply(flagsEl, clones(item.querySelectorAll('.menu-flag')));

    document.documentElement.classList.add('dialog-open');
    dialog.showModal();
  }

  list.addEventListener('click', function (e) {
    var item = e.target.closest('.menu-item');
    if (item) openDish(item);
  });

  // Backdrop click, the X, or "Order Online" (order-locations.js opens its picker,
  // which would otherwise sit underneath this modal) all close the dialog.
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog || e.target.closest('[data-dialog-close], [data-order-toggle]')) dialog.close();
  });

  // 'close' fires async, so a quick reopen may already have happened by now.
  dialog.addEventListener('close', function () {
    if (!dialog.open) document.documentElement.classList.remove('dialog-open');
  });
})();

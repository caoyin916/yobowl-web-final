/* Yo Bowl — progressive enhancement: header scroll-state, scroll reveals,
   and a subtle hero parallax. All motion respects prefers-reduced-motion.
   This script never hides content unless JS is running (the CSS that hides
   [data-reveal] is scoped under html.js, set in each page's <head>). */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Header: add .scrolled past a small threshold --- */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 16);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* --- Scroll reveals --- */
  var els = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  if (els.length) {
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var delay = el.getAttribute('data-reveal-delay');
          if (delay) el.style.transitionDelay = delay + 'ms';
          el.classList.add('is-visible');
          io.unobserve(el);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      els.forEach(function (el) { io.observe(el); });
    }
  }

  /* --- Subtle hero parallax (skipped when reduced motion) --- */
  var bg = document.querySelector('.hero-bg');
  if (bg && !reduce) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        var y = window.scrollY;
        if (y < 760) bg.style.transform = 'scale(1.12) translateY(' + (y * 0.12) + 'px)';
        ticking = false;
      });
    }, { passive: true });
  }
})();

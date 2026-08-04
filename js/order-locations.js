(function () {
  var ORDER_LOCATIONS = [
    {
      name: "Carrollton, TX",
      addr: "2700 Old Denton Rd Unit 110, Carrollton, TX 75007",
      url: "https://order.toasttab.com/online/yobowl"
    },
    {
      name: "Plano, TX",
      addr: "4701 W Park Blvd #105, Plano, TX 75093",
      url: "https://order.toasttab.com/online/yo-bowl-plano-em-4701-west-park-boulevard"
    }
  ];

  var REVIEW_LOCATIONS = [
    {
      name: "Carrollton, TX",
      addr: "2700 Old Denton Rd Unit 110, Carrollton, TX 75007",
      url: "https://www.google.com/search?q=Yo+Bowl+Carrollton"
    },
    {
      name: "Plano, TX",
      addr: "4701 W Park Blvd #105, Plano, TX 75093",
      url: "https://www.google.com/search?q=Yo+Bowl+Plano"
    }
  ];

  function buildModal(locations, idPrefix, eyebrow, title) {
    var overlay = document.createElement("div");
    overlay.className = "order-modal-overlay";
    overlay.innerHTML =
      '<div class="order-modal" role="dialog" aria-modal="true" aria-labelledby="' + idPrefix + 'Title">' +
        '<button class="order-modal-close" type="button" aria-label="Close">&times;</button>' +
        '<p class="section-eyebrow">' + eyebrow + '</p>' +
        '<h3 id="' + idPrefix + 'Title">' + title + '</h3>' +
        '<div class="order-modal-list">' +
          locations.map(function (l) {
            return '<a class="order-modal-option" href="' + l.url + '" target="_blank" rel="noopener">' +
              '<span class="order-modal-name">' + l.name + '</span>' +
              '<span class="order-modal-addr">' + l.addr + '</span>' +
            '</a>';
          }).join("") +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    function close() { overlay.classList.remove("open"); }
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    overlay.querySelector(".order-modal-close").addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    return overlay;
  }

  function wire(selector, overlay) {
    var toggles = document.querySelectorAll(selector);
    if (!toggles.length) return;
    toggles.forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        overlay.classList.add("open");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (document.querySelectorAll("[data-order-toggle]").length) {
      wire("[data-order-toggle]", buildModal(ORDER_LOCATIONS, "orderModal", "Choose A Location", "Where would you like to order from?"));
    }
    if (document.querySelectorAll("[data-review-toggle]").length) {
      wire("[data-review-toggle]", buildModal(REVIEW_LOCATIONS, "reviewModal", "Choose A Location", "Which location would you like to review?"));
    }
  });
})();

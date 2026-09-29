(function () {
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  var path = location.pathname.replace(/\/+$/, "") || "/";
  document.querySelectorAll(".nav-links a[data-nav]").forEach(function (a) {
    var key = a.getAttribute("data-nav");
    var map = {
      home: ["/WineOnTheWall", "/WineOnTheWall/index.html", "/WineOnTheWall/", "/"],
      collections: ["/WineOnTheWall/collections", "/WineOnTheWall/collections.html"],
      about: ["/WineOnTheWall/about", "/WineOnTheWall/about.html"],
      contact: ["/WineOnTheWall/contact", "/WineOnTheWall/contact.html"]
    };
    var hits = map[key] || [];
    if (hits.some(function (h) { return path === h || path.endsWith(h.replace("/WineOnTheWall", "")); })) {
      a.classList.add("active");
    }
  });
})();

(function () {
  var openBtn = document.getElementById("open-tour");
  var modal = document.getElementById("tour-modal");
  var viewerEl = document.getElementById("pannellum-viewer");
  if (!openBtn || !modal || !viewerEl || typeof pannellum === "undefined") return;

  var viewer = null;
  var lastFocus = null;

  // GPano: Full 7168x3584, crop 7168x1560 at top 1316 → band FOV, not black poles
  var VAOV = (1560 / 3584) * 180;
  var V_OFFSET = 90 - ((1316 + 1560 / 2) / 3584) * 180;
  var INITIAL_YAW = -127;
  var INITIAL_PITCH = -12;
  var INITIAL_HFOV = 85;

  var PANO_DESKTOP = "/WineOnTheWall/assets/pano/cellar-band.jpg";
  var PANO_MOBILE = "/WineOnTheWall/assets/pano/cellar-band-2048.jpg";

  function panoramaUrl() {
    try {
      if (window.matchMedia && window.matchMedia("(max-width: 900px)").matches) {
        return PANO_MOBILE;
      }
    } catch (e) {}
    return PANO_DESKTOP;
  }

  function ensureViewer() {
    if (viewer) {
      if (viewer.resize) viewer.resize();
      return viewer;
    }
    viewer = pannellum.viewer(viewerEl, {
      type: "equirectangular",
      panorama: panoramaUrl(),
      autoLoad: true,
      haov: 360,
      vaov: VAOV,
      vOffset: V_OFFSET,
      showControls: true,
      showFullscreenCtrl: true,
      showZoomCtrl: true,
      mouseZoom: true,
      draggable: true,
      yaw: INITIAL_YAW,
      pitch: INITIAL_PITCH,
      hfov: INITIAL_HFOV,
      minHfov: 45,
      maxHfov: Math.min(100, VAOV + 10),
      minPitch: V_OFFSET - VAOV / 2 + 2,
      maxPitch: V_OFFSET + VAOV / 2 - 2,
      compass: false,
      strings: {
        loadButtonLabel: "Click to<br>Load<br>Panorama",
        loadingLabel: "Loading…",
        bylineLabel: "Wine On the Wall cellar",
        noPanoramaError: "No panorama source found.",
        fileAccessError: "The file %s could not be accessed.",
        malformedURLError: "Malformed URL.",
        iOSError: "This panorama requires WebGL.",
        genericError: "Something went wrong with the tour.",
        textureSizeError: "This panorama is too large for this device.",
        unknownError: "Unknown error."
      }
    });
    return viewer;
  }

  function openTour() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("tour-open");
    ensureViewer();
    requestAnimationFrame(function () {
      if (viewer && viewer.resize) viewer.resize();
      requestAnimationFrame(function () {
        if (viewer && viewer.resize) viewer.resize();
      });
      var closeBtn = modal.querySelector(".tour-modal-close");
      if (closeBtn) closeBtn.focus();
    });
  }

  function closeTour() {
    if (modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("tour-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  openBtn.addEventListener("click", function (e) {
    e.preventDefault();
    openTour();
  });

  modal.querySelectorAll("[data-tour-close]").forEach(function (el) {
    el.addEventListener("click", closeTour);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeTour();
  });

  window.addEventListener("resize", function () {
    if (!modal.hidden && viewer && viewer.resize) viewer.resize();
  });

  function maybeAutoOpen() {
    var params = new URLSearchParams(location.search);
    if (params.get("tour") === "1" || location.hash === "#tour") openTour();
  }
  maybeAutoOpen();
})();

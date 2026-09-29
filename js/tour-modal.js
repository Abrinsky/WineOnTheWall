(function () {
  var openBtn = document.getElementById("open-tour");
  var modal = document.getElementById("tour-modal");
  var viewerEl = document.getElementById("pannellum-viewer");
  if (!openBtn || !modal || !viewerEl || typeof pannellum === "undefined") return;

  var viewer = null;
  var lastFocus = null;
  var INITIAL_YAW = -127;
  var INITIAL_PITCH = -12;
  var INITIAL_HFOV = 95;

  var PANO_DESKTOP = "/WineOnTheWall/assets/pano/cellar-equirect.jpg";
  var PANO_MOBILE = "/WineOnTheWall/assets/pano/cellar-equirect-2048.jpg";
  var PREVIEW_URL = "/WineOnTheWall/assets/pano/cellar-equirect-preview.jpg";

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
      preview: PREVIEW_URL,
      autoLoad: true,
      showControls: true,
      showFullscreenCtrl: true,
      showZoomCtrl: true,
      mouseZoom: true,
      draggable: true,
      yaw: INITIAL_YAW,
      pitch: INITIAL_PITCH,
      hfov: INITIAL_HFOV,
      minHfov: 50,
      maxHfov: 120,
      compass: false,
      horizonPitch: 0,
      minPitch: -40,
      maxPitch: 25,
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

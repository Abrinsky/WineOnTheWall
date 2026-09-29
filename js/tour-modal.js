(function () {
  var openBtn = document.getElementById("open-tour");
  var modal = document.getElementById("tour-modal");
  var viewerEl = document.getElementById("pannellum-viewer");
  if (!openBtn || !modal || !viewerEl || typeof pannellum === "undefined") return;

  var viewer = null;
  var lastFocus = null;
  // Crop center of hero still on the source pano → continuous open
  var INITIAL_YAW = -127;
  var INITIAL_PITCH = -12;
  var INITIAL_HFOV = 95;

  var panoramaUrl = "/WineOnTheWall/assets/pano/cellar-equirect.jpg";
  var previewUrl = "/WineOnTheWall/assets/pano/cellar-equirect-preview.jpg";

  function ensureViewer() {
    if (viewer) return viewer;
    viewer = pannellum.viewer(viewerEl, {
      type: "equirectangular",
      panorama: panoramaUrl,
      preview: previewUrl,
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
      // GPano band is mid-latitude; keep look within sensible range
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
    // Resize after layout so WebGL canvas fills the dialog
    requestAnimationFrame(function () {
      if (viewer && viewer.resize) viewer.resize();
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
    if (e.key === "Escape" && !modal.hidden) {
      closeTour();
    }
  });

  // Deep-link support: ?tour=1 or #tour opens modal
  function maybeAutoOpen() {
    var params = new URLSearchParams(location.search);
    if (params.get("tour") === "1" || location.hash === "#tour") {
      openTour();
    }
  }
  maybeAutoOpen();
})();

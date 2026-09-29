(function () {
  var openBtn = document.getElementById("open-tour");
  var modal = document.getElementById("tour-modal");
  var viewerEl = document.getElementById("pannellum-viewer");
  if (!openBtn || !modal || !viewerEl || typeof pannellum === "undefined") return;

  var viewer = null;
  var lastFocus = null;
  var resizeObserver = null;
  var opening = false;
  var openGeneration = 0;

  // Crop center of hero still on the source pano → continuous open
  var INITIAL_YAW = -127;
  var INITIAL_PITCH = -12;
  var INITIAL_HFOV = 95;

  var PANO_DESKTOP = "/WineOnTheWall/assets/pano/cellar-equirect.jpg"; // 4096×2048
  var PANO_MOBILE = "/WineOnTheWall/assets/pano/cellar-equirect-2048.jpg"; // 2048×1024
  var PREVIEW_URL = "/WineOnTheWall/assets/pano/cellar-equirect-preview.jpg";

  function prefersMobilePano() {
    // Mobile Chrome/Vivaldi often black-screens after a brief preview when the
    // equirect hits the GPU texture ceiling (4096). Serve 2048 there; keep 4096 on desktop.
    // Do NOT probe WebGL / call WEBGL_lose_context here — creating a throwaway
    // context then losing it can poison the page GPU and black-out Pannellum
    // on desktop and mobile after a brief paint.
    if (window.matchMedia) {
      if (window.matchMedia("(max-width: 900px)").matches) return true;
      if (window.matchMedia("(pointer: coarse)").matches) return true;
    }
    if (navigator.maxTouchPoints && navigator.maxTouchPoints > 1) return true;
    return false;
  }

  function panoramaUrl() {
    return prefersMobilePano() ? PANO_MOBILE : PANO_DESKTOP;
  }

  function containerHasSize() {
    var r = viewerEl.getBoundingClientRect();
    return r.width >= 64 && r.height >= 64;
  }

  function destroyViewer() {
    if (resizeObserver) {
      try {
        resizeObserver.disconnect();
      } catch (e) {}
      resizeObserver = null;
    }
    if (viewer) {
      try {
        viewer.destroy();
      } catch (e) {}
      viewer = null;
    }
    // Clear leftover pannellum DOM so recreate starts clean
    viewerEl.innerHTML = "";
  }

  function scheduleResizes() {
    function doResize() {
      if (viewer && viewer.resize && containerHasSize()) {
        try {
          viewer.resize();
        } catch (e) {}
      }
    }
    // Layout may settle across multiple frames (esp. mobile address-bar / vh)
    requestAnimationFrame(function () {
      doResize();
      requestAnimationFrame(function () {
        doResize();
        setTimeout(doResize, 50);
        setTimeout(doResize, 200);
        setTimeout(doResize, 500);
      });
    });
  }

  function bindResizeObserver() {
    if (typeof ResizeObserver === "undefined") return;
    if (resizeObserver) {
      try {
        resizeObserver.disconnect();
      } catch (e) {}
    }
    resizeObserver = new ResizeObserver(function () {
      if (viewer && viewer.resize && !modal.hidden) {
        try {
          viewer.resize();
        } catch (e) {}
      }
    });
    resizeObserver.observe(viewerEl);
  }

  function createViewer() {
    destroyViewer();
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

    viewer.on("load", function () {
      scheduleResizes();
    });
    viewer.on("error", function () {
      scheduleResizes();
    });

    // Recover from WebGL context loss (common on mobile Chrome/Vivaldi after brief paint)
    var canvas = viewerEl.querySelector("canvas");
    if (canvas) {
      canvas.addEventListener(
        "webglcontextlost",
        function (ev) {
          ev.preventDefault();
        },
        false
      );
      canvas.addEventListener(
        "webglcontextrestored",
        function () {
          if (!modal.hidden) {
            createViewer();
            scheduleResizes();
          }
        },
        false
      );
    }

    bindResizeObserver();
    scheduleResizes();
    return viewer;
  }

  function afterLayout(cb) {
    // Wait until the un-hidden modal has a real non-zero viewer box
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (containerHasSize()) {
          cb();
          return;
        }
        var tries = 0;
        var id = setInterval(function () {
          tries += 1;
          if (containerHasSize() || tries > 20) {
            clearInterval(id);
            cb();
          }
        }, 50);
      });
    });
  }

  function openTour() {
    if (opening && !modal.hidden) return;
    opening = true;
    var gen = ++openGeneration;
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("tour-open");

    afterLayout(function () {
      if (gen !== openGeneration || modal.hidden) {
        opening = false;
        return;
      }
      // Always recreate on open so a prior context-loss / zero-size init can't stick
      createViewer();
      var closeBtn = modal.querySelector(".tour-modal-close");
      if (closeBtn) closeBtn.focus();
      opening = false;
    });
  }

  function closeTour() {
    if (modal.hidden) return;
    openGeneration += 1;
    opening = false;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("tour-open");
    // Free the WebGL context on mobile so the next open starts clean
    destroyViewer();
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

  window.addEventListener("orientationchange", function () {
    if (!modal.hidden) scheduleResizes();
  });
  window.addEventListener("resize", function () {
    if (!modal.hidden) scheduleResizes();
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

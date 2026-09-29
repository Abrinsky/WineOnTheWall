(function () {
  var openBtn = document.getElementById("open-tour");
  var modal = document.getElementById("tour-modal");
  var viewerEl = document.getElementById("pannellum-viewer");
  var subtitleEl = document.getElementById("tour-modal-subtitle");
  if (!openBtn || !modal || !viewerEl) return;

  var viewer = null;
  var lastFocus = null;
  var mode = "none"; // "pannellum" | "fallback"
  var loadWatchdog = null;
  var blankChecks = [];
  var fallbackState = null;
  var loadSeen = false;

  // GPano: Full 7168x3584, crop 7168x1560 at top 1316 → band FOV, not black poles
  var VAOV = (1560 / 3584) * 180;
  var V_OFFSET = 90 - ((1316 + 1560 / 2) / 3584) * 180;
  var INITIAL_YAW = -127;
  var INITIAL_PITCH = -12;
  var INITIAL_HFOV = 85;

  var PANO_DESKTOP = "/WineOnTheWall/assets/pano/cellar-band.jpg";
  var PANO_MOBILE = "/WineOnTheWall/assets/pano/cellar-band-2048.jpg";
  var FALLBACK_PANO = PANO_DESKTOP;

  var DEFAULT_SUBTITLE = "Drag to look around. Scroll or pinch to zoom.";
  var FALLBACK_SUBTITLE = "Basic tour (WebGL unavailable). Drag to pan.";
  var LOAD_TIMEOUT_MS = 4500;
  // After load: nudge+readPixels (WebGL clears without preserveDrawingBuffer)
  var BLANK_CHECK_MS = [350, 1200];

  function panoramaUrl() {
    try {
      if (window.matchMedia && window.matchMedia("(max-width: 900px)").matches) {
        return PANO_MOBILE;
      }
    } catch (e) {}
    return PANO_DESKTOP;
  }

  // Touch/coarse-pointer and narrow layouts use the reliable cylindrical drag view.
  // This also catches mobile browsers running in desktop-site mode.
  function shouldUseFallback() {
    var coarse = false;
    var narrow = false;
    var touchPoints = 0;

    try {
      if (window.matchMedia) {
        coarse = window.matchMedia("(pointer: coarse)").matches;
        narrow = window.matchMedia("(max-width: 900px)").matches;
      }
    } catch (e) {}

    try {
      touchPoints = Number(
        navigator.maxTouchPoints || navigator.msMaxTouchPoints || 0
      );
    } catch (e) {}

    return coarse || touchPoints > 0 || narrow;
  }

  function setSubtitle(text) {
    if (subtitleEl) subtitleEl.textContent = text;
  }

  function clearTimers() {
    if (loadWatchdog) {
      clearTimeout(loadWatchdog);
      loadWatchdog = null;
    }
    blankChecks.forEach(function (id) {
      clearTimeout(id);
    });
    blankChecks = [];
  }

  function destroyPannellum() {
    clearTimers();
    if (viewer) {
      try {
        viewer.destroy();
      } catch (e) {}
      viewer = null;
    }
  }

  function glCanvasIsEffectivelyBlank(canvas) {
    if (!canvas || canvas.width < 2 || canvas.height < 2) return true;
    var gl = null;
    try {
      gl =
        canvas.getContext("webgl") ||
        canvas.getContext("webgl2") ||
        canvas.getContext("experimental-webgl");
    } catch (e) {
      return false;
    }
    if (!gl) return true;
    try {
      var w = Math.min(64, canvas.width);
      var h = Math.min(64, canvas.height);
      var x = Math.max(0, (canvas.width - w) >> 1);
      var y = Math.max(0, (canvas.height - h) >> 1);
      var pixels = new Uint8Array(w * h * 4);
      gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      // Ignore GL errors — treat as inconclusive (do not force fallback)
      if (gl.getError()) return false;
      var lit = 0;
      var i;
      for (i = 0; i < pixels.length; i += 16) {
        if (pixels[i] > 10 || pixels[i + 1] > 10 || pixels[i + 2] > 10) lit += 1;
      }
      return lit < 4;
    } catch (e) {
      return false;
    }
  }

  function pannellumHasVisibleError() {
    var err = viewerEl.querySelector(".pnlm-error-msg");
    return !!(err && (err.textContent || "").trim() && err.offsetParent !== null);
  }

  /**
   * Nudge yaw so Pannellum redraws into the backbuffer, then sample pixels
   * in the same animation frame (preserveDrawingBuffer is typically false).
   */
  function checkBlankAfterRedraw(cb) {
    if (mode !== "pannellum" || !viewer) {
      cb(false);
      return;
    }
    var canvas = viewerEl.querySelector("canvas");
    if (!canvas) {
      cb(true);
      return;
    }
    try {
      if (typeof viewer.getYaw === "function" && typeof viewer.setYaw === "function") {
        viewer.setYaw(viewer.getYaw() + 0.35);
      } else if (viewer.resize) {
        viewer.resize();
      }
    } catch (e) {}
    requestAnimationFrame(function () {
      if (mode !== "pannellum") {
        cb(false);
        return;
      }
      if (pannellumHasVisibleError()) {
        cb(true);
        return;
      }
      canvas = viewerEl.querySelector("canvas");
      cb(glCanvasIsEffectivelyBlank(canvas));
      // undo nudge
      try {
        if (viewer && typeof viewer.setYaw === "function") {
          viewer.setYaw(viewer.getYaw() - 0.35);
        }
      } catch (e) {}
    });
  }

  function buildFallbackDom() {
    viewerEl.innerHTML = "";
    viewerEl.removeAttribute("role");
    viewerEl.setAttribute("aria-label", "Interactive panoramic tour of the wine cellar");

    var stage = document.createElement("div");
    stage.className = "tour-fallback-stage";
    stage.id = "tour-fallback-stage";
    stage.setAttribute("tabindex", "0");
    stage.setAttribute("role", "img");
    stage.setAttribute("aria-label", "Drag to pan the cellar panorama");

    var img = document.createElement("img");
    img.id = "tour-fallback-image";
    img.src = FALLBACK_PANO;
    img.alt = "Wine cellar panoramic photo";
    img.draggable = false;
    img.decoding = "async";

    var hint = document.createElement("div");
    hint.className = "tour-hint";
    hint.id = "tour-fallback-hint";
    hint.textContent = "Drag to look around";

    var note = document.createElement("div");
    note.className = "tour-fallback-note";
    note.textContent = "Basic tour (WebGL unavailable)";

    stage.appendChild(img);
    stage.appendChild(hint);
    viewerEl.appendChild(stage);
    viewerEl.appendChild(note);

    return { stage: stage, img: img, hint: hint };
  }

  function bindFallback(parts) {
    var stage = parts.stage;
    var img = parts.img;
    var hint = parts.hint;

    var offsetX = 0;
    var dragging = false;
    var startX = 0;
    var startOffset = 0;
    var maxOffset = 0;
    var hintHidden = false;
    var measuredOnce = false;

    function clamp(v, min, max) {
      return Math.max(min, Math.min(max, v));
    }

    function apply() {
      img.style.transform = "translateX(" + -offsetX + "px)";
    }

    function measure() {
      var stageW = stage.clientWidth;
      var imgW = img.getBoundingClientRect().width;
      maxOffset = Math.max(0, imgW - stageW);
      if (!measuredOnce || !dragging) {
        offsetX = maxOffset * 0.42;
        measuredOnce = true;
      }
      offsetX = clamp(offsetX, 0, maxOffset);
      apply();
    }

    function hideHint() {
      if (hintHidden || !hint) return;
      hintHidden = true;
      hint.classList.add("is-hidden");
    }

    function pointerDown(clientX) {
      dragging = true;
      stage.classList.add("is-dragging");
      startX = clientX;
      startOffset = offsetX;
      hideHint();
    }

    function pointerMove(clientX) {
      if (!dragging) return;
      var dx = clientX - startX;
      offsetX = clamp(startOffset - dx, 0, maxOffset);
      apply();
    }

    function pointerUp() {
      dragging = false;
      stage.classList.remove("is-dragging");
    }

    stage.addEventListener("mousedown", function (e) {
      e.preventDefault();
      pointerDown(e.clientX);
    });
    window.addEventListener("mousemove", function (e) {
      pointerMove(e.clientX);
    });
    window.addEventListener("mouseup", pointerUp);

    stage.addEventListener(
      "touchstart",
      function (e) {
        if (!e.touches.length) return;
        pointerDown(e.touches[0].clientX);
      },
      { passive: true }
    );
    stage.addEventListener(
      "touchmove",
      function (e) {
        if (!e.touches.length) return;
        pointerMove(e.touches[0].clientX);
      },
      { passive: true }
    );
    stage.addEventListener("touchend", pointerUp);
    stage.addEventListener("touchcancel", pointerUp);

    stage.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        hideHint();
        offsetX = clamp(offsetX + e.deltaY + e.deltaX, 0, maxOffset);
        apply();
      },
      { passive: false }
    );

    stage.addEventListener("keydown", function (e) {
      var step = Math.max(40, stage.clientWidth * 0.08);
      if (e.key === "ArrowLeft") {
        offsetX = clamp(offsetX - step, 0, maxOffset);
        apply();
        hideHint();
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        offsetX = clamp(offsetX + step, 0, maxOffset);
        apply();
        hideHint();
        e.preventDefault();
      }
    });

    function onResize() {
      if (mode === "fallback" && !modal.hidden) measure();
    }
    window.addEventListener("resize", onResize);

    if (img.complete) measure();
    else img.addEventListener("load", measure);

    fallbackState = {
      measure: measure,
      destroy: function () {
        window.removeEventListener("resize", onResize);
      }
    };
  }

  function activateFallback(reason) {
    if (mode === "fallback") return;
    destroyPannellum();
    if (fallbackState && fallbackState.destroy) {
      try {
        fallbackState.destroy();
      } catch (e) {}
      fallbackState = null;
    }
    mode = "fallback";
    setSubtitle(FALLBACK_SUBTITLE);
    var parts = buildFallbackDom();
    bindFallback(parts);
    if (typeof console !== "undefined" && console.info) {
      console.info("[tour] Using basic drag-pan fallback:", reason || "unknown");
    }
  }

  function scheduleBlankChecks() {
    BLANK_CHECK_MS.forEach(function (ms) {
      var id = setTimeout(function () {
        if (mode !== "pannellum" || modal.hidden) return;
        checkBlankAfterRedraw(function (blank) {
          if (blank && mode === "pannellum") {
            activateFallback("blank-after-" + ms + "ms");
          }
        });
      }, ms);
      blankChecks.push(id);
    });
  }

  function ensurePannellum() {
    if (typeof pannellum === "undefined") {
      activateFallback("pannellum-missing");
      return;
    }
    if (viewer) {
      if (viewer.resize) {
        try {
          viewer.resize();
        } catch (e) {}
      }
      return;
    }

    mode = "pannellum";
    loadSeen = false;
    setSubtitle(DEFAULT_SUBTITLE);
    viewerEl.innerHTML = "";
    viewerEl.setAttribute("role", "img");
    viewerEl.setAttribute(
      "aria-label",
      "Interactive spherical panorama of the wine cellar"
    );

    try {
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
    } catch (e) {
      activateFallback("viewer-create-threw");
      return;
    }

    viewer.on("error", function () {
      activateFallback("pannellum-error");
    });

    viewer.on("load", function () {
      loadSeen = true;
      clearTimers();
      if (viewer && viewer.resize) {
        try {
          viewer.resize();
        } catch (e) {}
      }
      scheduleBlankChecks();
    });

    var canvas = viewerEl.querySelector("canvas");
    if (canvas) {
      canvas.addEventListener(
        "webglcontextlost",
        function (ev) {
          try {
            ev.preventDefault();
          } catch (e) {}
          activateFallback("webgl-context-lost");
        },
        false
      );
    }

    loadWatchdog = setTimeout(function () {
      if (mode !== "pannellum" || modal.hidden) return;
      if (!loadSeen || pannellumHasVisibleError()) {
        activateFallback(loadSeen ? "error-msg" : "load-timeout");
        return;
      }
      checkBlankAfterRedraw(function (blank) {
        if (blank && mode === "pannellum") {
          activateFallback("blank-at-watchdog");
        }
      });
    }, LOAD_TIMEOUT_MS);
  }

  function openTour() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("tour-open");

    if (mode === "fallback") {
      setSubtitle(FALLBACK_SUBTITLE);
      if (fallbackState && fallbackState.measure) fallbackState.measure();
    } else if (shouldUseFallback()) {
      activateFallback("mobile-input");
    } else {
      ensurePannellum();
    }

    requestAnimationFrame(function () {
      if (mode === "pannellum" && viewer && viewer.resize) {
        try {
          viewer.resize();
        } catch (e) {}
        requestAnimationFrame(function () {
          if (viewer && viewer.resize) {
            try {
              viewer.resize();
            } catch (e) {}
          }
        });
      } else if (mode === "fallback" && fallbackState && fallbackState.measure) {
        fallbackState.measure();
      }
      var closeBtn = modal.querySelector(".tour-modal-close");
      if (closeBtn) closeBtn.focus();
    });
  }

  function closeTour() {
    if (modal.hidden) return;
    clearTimers();
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
    if (modal.hidden) return;
    if (mode === "pannellum" && shouldUseFallback()) {
      activateFallback("mobile-input");
      return;
    }
    if (mode === "pannellum" && viewer && viewer.resize) {
      try {
        viewer.resize();
      } catch (e) {}
    }
  });

  function maybeAutoOpen() {
    var params = new URLSearchParams(location.search);
    if (params.get("tour") === "1" || location.hash === "#tour") openTour();
  }
  maybeAutoOpen();
})();

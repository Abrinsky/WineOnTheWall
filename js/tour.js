(function () {
  var stage = document.getElementById("tour-stage");
  var img = document.getElementById("tour-image");
  var hint = document.getElementById("tour-hint");
  if (!stage || !img) return;

  var offsetX = 0;
  var dragging = false;
  var startX = 0;
  var startOffset = 0;
  var maxOffset = 0;
  var hintHidden = false;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function measure() {
    var stageW = stage.clientWidth;
    var imgW = img.getBoundingClientRect().width;
    maxOffset = Math.max(0, imgW - stageW);
    // Start near center of the panorama
    if (!dragging) {
      offsetX = maxOffset * 0.42;
    }
    offsetX = clamp(offsetX, 0, maxOffset);
    apply();
  }

  function apply() {
    img.style.transform = "translateX(" + (-offsetX) + "px)";
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

  stage.addEventListener("touchstart", function (e) {
    if (!e.touches.length) return;
    pointerDown(e.touches[0].clientX);
  }, { passive: true });
  stage.addEventListener("touchmove", function (e) {
    if (!e.touches.length) return;
    pointerMove(e.touches[0].clientX);
  }, { passive: true });
  stage.addEventListener("touchend", pointerUp);
  stage.addEventListener("touchcancel", pointerUp);

  stage.addEventListener("wheel", function (e) {
    e.preventDefault();
    hideHint();
    offsetX = clamp(offsetX + e.deltaY + e.deltaX, 0, maxOffset);
    apply();
  }, { passive: false });

  // Keyboard accessibility
  stage.tabIndex = 0;
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

  if (img.complete) measure();
  else img.addEventListener("load", measure);
  window.addEventListener("resize", measure);
})();

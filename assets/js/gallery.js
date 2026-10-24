/**
 * Justified photo gallery (markup from _includes/photo-gallery.html).
 *
 * Photos keep their aspect ratio and are never cropped. They are packed into
 * rows that each span the full gallery width, so a row's height is fixed by
 * the photos in it: h = (width - gaps) / (sum of their aspect ratios).
 *
 * Choosing where rows break is a small line-breaking problem, solved exactly
 * with dynamic programming (the same idea as Knuth-Plass for paragraphs):
 * every row is scored by how far its height lands from a target height, and
 * the partition with the lowest total score wins. Rows outside the
 * [min, max] height band are penalised heavily, so they only happen when no
 * other arrangement exists (one tall portrait on a phone, say) -- and even
 * then the row is capped at the max height and centred rather than blown up.
 * The last row is allowed to come up short instead of being stretched.
 *
 * Photos stay in their source (filename) order; the DP only picks the breaks.
 * Adding a photo just means re-running this on load, so nothing is hand-placed.
 */
(function () {
  "use strict";

  // ---------- config (each can be overridden by a data-* attribute) ----------
  var TARGET_HEIGHT = 200; // px; ideal row height on a wide gallery
  var MIN_RATIO = 0.7; // rows may shrink to 70% of the target...
  var MAX_RATIO = 1.4; // ...or grow to 140% of it
  var GAP = 8; // px between photos, both directions
  var NARROW_FRACTION = 0.45; // on narrow galleries, target at most this * width
  var OUT_OF_BAND_WEIGHT = 50; // how much worse an out-of-band row is

  var galleries = document.querySelectorAll(".photo-gallery");
  if (!galleries.length) return;

  // Resolves with the photo's aspect ratio, or null if it failed to load.
  function aspectOf(img) {
    return new Promise(function (resolve) {
      function done() {
        resolve(img.naturalWidth && img.naturalHeight
          ? img.naturalWidth / img.naturalHeight
          : null);
      }
      if (img.complete) return done();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
  }

  // Splits `aspects` into rows; returns an array of [start, end) index pairs.
  function partition(aspects, width, gap, target, lo, hi) {
    var n = aspects.length;
    var best = [0];
    var breakAt = [0];

    function rowCost(h, isLast) {
      if (isLast && h >= target) return 0; // short last row: shown at target
      var d = (h - target) / target;
      var cost = d * d;
      if (h > hi) cost += OUT_OF_BAND_WEIGHT * Math.pow((h - hi) / target, 2) + 1;
      if (h < lo) cost += OUT_OF_BAND_WEIGHT * Math.pow((lo - h) / target, 2) + 1;
      return cost;
    }

    for (var j = 1; j <= n; j++) {
      best[j] = Infinity;
      var sum = 0;
      // Grow the row ending at photo j leftward. Each added photo only makes
      // the row shorter, so once it drops below the band we can stop -- except
      // for a lone photo, which always has to go somewhere.
      for (var i = j - 1; i >= 0; i--) {
        sum += aspects[i];
        var count = j - i;
        var h = (width - gap * (count - 1)) / sum;
        if (h < lo && count > 1) break;
        var cost = best[i] + rowCost(h, j === n);
        if (cost < best[j]) {
          best[j] = cost;
          breakAt[j] = i;
        }
      }
    }

    var rows = [];
    for (var end = n; end > 0; end = breakAt[end]) rows.unshift([breakAt[end], end]);
    return rows;
  }

  function setUp(gallery) {
    var items = Array.prototype.slice.call(
      gallery.querySelectorAll(".photo-gallery-item")
    );
    if (!items.length) return;

    var num = function (name, fallback) {
      var v = parseFloat(gallery.getAttribute("data-" + name));
      return isFinite(v) ? v : fallback;
    };
    var baseTarget = num("target-height", TARGET_HEIGHT);
    var gap = num("gap", GAP);

    // Hidden until measured, so the unstyled fallback never flashes.
    gallery.classList.add("is-pending");

    var photos; // [{ el, aspect }] for photos that loaded
    var lastWidth = -1;

    function layout() {
      var width = gallery.clientWidth;
      if (!width || width === lastWidth) return;
      lastWidth = width;

      // Keep at least two landscape photos per row on narrow screens.
      var target = Math.min(baseTarget, Math.max(baseTarget * MIN_RATIO, width * NARROW_FRACTION));
      var lo = target * MIN_RATIO;
      var hi = target * MAX_RATIO;
      var aspects = photos.map(function (p) { return p.aspect; });
      var rows = partition(aspects, width, gap, target, lo, hi);

      var y = 0;
      rows.forEach(function (row, r) {
        var start = row[0], end = row[1];
        var sum = 0;
        for (var k = start; k < end; k++) sum += aspects[k];
        var fullHeight = (width - gap * (end - start - 1)) / sum;
        // Never enlarge past the band (or past the target on the last row);
        // a capped row is centred instead of spanning the full width.
        var h = Math.min(fullHeight, r === rows.length - 1 ? Math.min(target, hi) : hi);
        var rowWidth = h * sum + gap * (end - start - 1);
        var x = (width - rowWidth) / 2;

        for (var m = start; m < end; m++) {
          var w = h * aspects[m];
          var s = photos[m].el.style;
          s.left = x + "px";
          s.top = y + "px";
          s.width = w + "px";
          s.height = h + "px";
          x += w + gap;
        }
        y += h + gap;
      });
      gallery.style.height = Math.max(0, y - gap) + "px";
    }

    Promise.all(items.map(function (el) {
      return aspectOf(el.querySelector("img"));
    })).then(function (aspects) {
      photos = [];
      items.forEach(function (el, i) {
        if (aspects[i]) photos.push({ el: el, aspect: aspects[i] });
        else el.remove(); // broken image: drop it rather than leave a hole
      });

      gallery.classList.add("is-justified");
      layout();
      gallery.classList.remove("is-pending");

      if (window.ResizeObserver) new ResizeObserver(layout).observe(gallery);
      else window.addEventListener("resize", layout);
    });
  }

  Array.prototype.forEach.call(galleries, setUp);
})();

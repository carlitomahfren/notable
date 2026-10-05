/**
 * Synchronous bootstrap that applies the persisted theme before the React
 * application renders, so the first paint already uses the right palette.
 *
 * This string intentionally duplicates the accent math from `theme-utils.ts`
 * in plain ES5-style JavaScript: it must run standalone, before any module is
 * loaded. `__tests__/theme-bootstrap.test.ts` evaluates this exact string and
 * asserts it produces the same values as the TypeScript utilities, so the two
 * implementations cannot drift.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function () {
  var KEY = "notes-app.theme";
  var MIN = 4.5;
  var STEPS = 20;

  function norm(value) {
    if (typeof value !== "string") { return null; }
    var t = value.trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]+$/.test(t)) { return null; }
    if (t.length === 3) {
      var short = "";
      for (var s = 0; s < 3; s++) { short += t.charAt(s) + t.charAt(s); }
      return "#" + short.toLowerCase();
    }
    if (t.length === 6) { return "#" + t.toLowerCase(); }
    return null;
  }

  function lin(value) {
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function lum(hex) {
    var h = norm(hex) || "#000000";
    var r = lin(parseInt(h.slice(1, 3), 16) / 255);
    var g = lin(parseInt(h.slice(3, 5), 16) / 255);
    var b = lin(parseInt(h.slice(5, 7), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function ratio(a, b) {
    var x = lum(a);
    var y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  function mix(from, to, amount) {
    var a = norm(from);
    var b = norm(to);
    var out = "";
    for (var i = 0; i < 3; i++) {
      var start = parseInt(a.slice(1 + i * 2, 3 + i * 2), 16);
      var end = parseInt(b.slice(1 + i * 2, 3 + i * 2), 16);
      var value = Math.round(Math.max(0, Math.min(255, start + (end - start) * amount)));
      out += ("0" + value.toString(16)).slice(-2);
    }
    return "#" + out;
  }

  function foreground(accent) {
    var onWhite = ratio(accent, "#ffffff");
    var onNearBlack = ratio(accent, "#111111");
    var preferred = onWhite >= onNearBlack ? "#ffffff" : "#111111";
    if (ratio(accent, preferred) >= MIN) { return preferred; }
    return onWhite >= ratio(accent, "#000000") ? "#ffffff" : "#000000";
  }

  function lift(accent, reference, towards) {
    if (ratio(accent, reference) >= MIN) { return accent; }
    for (var step = 1; step <= STEPS; step++) {
      var candidate = mix(accent, towards, step / STEPS);
      if (ratio(candidate, reference) >= MIN) { return candidate; }
    }
    return towards;
  }

  try {
    var mode = "system";
    var preset = "default";
    var accent = null;

    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (parsed.colorMode === "system" || parsed.colorMode === "light" || parsed.colorMode === "dark") {
            mode = parsed.colorMode;
          }
          if (parsed.preset === "default" || parsed.preset === "paper" || parsed.preset === "forest" || parsed.preset === "lavender") {
            preset = parsed.preset;
          }
          if (typeof parsed.accent === "string") { accent = norm(parsed.accent); }
        }
      }
    } catch (storageError) {}

    var root = document.documentElement;
    root.setAttribute("data-color-scheme", mode);
    root.setAttribute("data-preset", preset);

    if (accent !== null) {
      root.style.setProperty("--accent", accent);
      root.style.setProperty("--accent-foreground", foreground(accent));
      root.style.setProperty("--accent-lift", lift(accent, "#ffffff", "#000000"));
      root.style.setProperty("--accent-lift-dark", lift(accent, "#202020", "#ffffff"));
    }
  } catch (error) {}
})();`
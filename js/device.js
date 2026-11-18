// device.js: decides which version of the site this device gets, before anything is drawn.
//
// It's a plain (non-module) script loaded at the top of <head>, so it runs before the page is
// painted. That way the right version shows from the very first frame: no flash, no layout jump.
//
//   film    the full 3D film: desktops, laptops, and big landscape tablets with a strong GPU
//   mobile  phones and portrait tablets: a live 3D base camp, then a normal scrolling page
//   calm    devices too weak for 3D, or with "reduce motion" switched on: the same page as
//           mobile, but the opening is a painted still with gentle CSS motion
//
// The choice is written on <html> as data-mode="film|mobile|calm" (CSS and main.js read it).
// For testing, add ?mode=film, ?mode=mobile or ?mode=calm to the address to force one.
(function () {
  var html = document.documentElement;
  var wanted = new URLSearchParams(location.search).get('mode');
  var mode = wanted === 'film' || wanted === 'mobile' || wanted === 'calm' ? wanted : choose();
  html.setAttribute('data-mode', mode);
  // Both small-screen versions share one layout, so CSS can style them with one class.
  if (mode !== 'film') html.classList.add('mobile-site');
  // Fetch the right code early, while the rest of the page is still arriving.
  var link = document.createElement('link');
  link.rel = 'modulepreload';
  link.href = (document.currentScript.getAttribute('src') || '').replace('device.js', mode === 'film' ? 'film.js' : 'mobile/mobile.js');
  if (document.currentScript.dataset.preload !== 'false') document.head.appendChild(link);

  function choose() {
    var mq = function (q) { return window.matchMedia(q).matches; };
    // A touch screen is the main way of pointing (phones, tablets). Touch laptops have a
    // trackpad or mouse as their main pointer, so they count as laptops.
    var touch = mq('(pointer: coarse)');
    var wide = window.innerWidth >= 1024;
    var reduce = mq('(prefers-reduced-motion: reduce)');

    // Desktops and laptops always get the film, exactly as before. (The film has its own calm
    // version for "reduce motion".) Only a browser with no WebGL at all can't run it.
    if (!touch) return window.WebGLRenderingContext ? 'film' : 'calm';

    var gpu = probeGPU();
    if (!gpu) return 'calm';                                   // no 3D at all
    // Big landscape tablets: the film, if their graphics are strong enough.
    if (wide && strong(gpu)) return 'film';
    // Everything else with a touch screen gets the mobile page; weak ones and "reduce motion"
    // get its calm opening (a painted still instead of live 3D).
    if (reduce || weak(gpu)) return 'calm';
    return 'mobile';
  }

  // Ask the browser for a WebGL context (and the graphics chip's name, where it tells us), then
  // give the context straight back. Returns null if 3D isn't available.
  function probeGPU() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return null;
      var info = gl.getExtension('WEBGL_debug_renderer_info');
      var name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
      var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return { name: name.toLowerCase(), maxTex: maxTex, webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext };
    } catch (e) {
      return null;
    }
  }

  // Memory and processor cores, where the browser shares them (Chrome on Android does; Safari
  // doesn't, and iPhones and iPads are all capable enough).
  function cores() { return navigator.hardwareConcurrency || 4; }
  function memory() { return navigator.deviceMemory || 4; }
  function saveData() { return !!(navigator.connection && navigator.connection.saveData); }

  // Strong enough for the whole film: Apple's chips, recent Adreno / Mali-G7x / Xclipse, and
  // anything that reports plenty of memory and cores.
  function strong(gpu) {
    if (!gpu.webgl2) return false;
    if (/apple/.test(gpu.name)) return true;
    if (/adreno \(tm\) (6[4-9]\d|7\d\d|8\d\d)/.test(gpu.name)) return true;
    if (/mali-g(7[1-9]|[89]\d|\d{3})|immortalis|xclipse/.test(gpu.name)) return true;
    return memory() >= 8 && cores() >= 8;
  }

  // Too weak for even the small live base camp: very little memory or very few cores, an old
  // graphics chip, or the visitor asked to save data.
  function weak(gpu) {
    if (saveData()) return true;
    if (memory() <= 2 || cores() <= 2) return true;
    if (gpu.maxTex < 4096) return true;
    if (/adreno \(tm\) ([1-4]\d\d|50\d)|mali-(4\d\d|t\d+)|powervr sgx|swiftshader|llvmpipe/.test(gpu.name)) return true;
    return false;
  }
})();

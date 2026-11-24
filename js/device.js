// device.js: decides which version of the site this device gets, before anything is drawn.
//
// It's a plain (non-module) script loaded at the top of <head>, so it runs before the page is
// painted. That way the right version shows from the very first frame: no flash, no layout jump.
//
//   film    the full 3D film: desktops, laptops, and big landscape tablets with a strong GPU
//           (the page paints first; three.js and the world load after, see js/site.js)
//   mobile  phones and portrait tablets: no film and no 3D at all. A light, fast page that opens
//           on the summit hero (a painting with a slow drifting cloud layer in CSS)
//   calm    the same page as mobile, for "reduce motion" or a browser with no WebGL: the
//           clouds stand still
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
  link.href = (document.currentScript.getAttribute('src') || '').replace('device.js', mode === 'film' ? 'site.js' : 'mobile/mobile.js');
  if (document.currentScript.dataset.preload !== 'false') {
    document.head.appendChild(link);
    // The film opens on a poster of its first frame (index.html), so that's the first thing to fetch.
    if (mode === 'film') {
      var poster = document.createElement('link');
      poster.rel = 'preload';
      poster.as = 'image';
      // (The same choice as css/style.css makes: the larger picture on wide or sharp screens.)
      var large = window.innerWidth >= 1300 || (window.devicePixelRatio || 1) >= 1.5;
      poster.href = 'assets/poster/opening-' + (large ? '1920' : '1280') + '.webp';
      poster.setAttribute('fetchpriority', 'high');
      document.head.appendChild(poster);

      // Then everything the live film needs, all at once, instead of one file discovering the next
      // (site.js → GSAP → gsap-core, film.js → three → three.core, and the trekker's two files only
      // once the world was half built). The code at normal priority (it is small and the film waits for it);
      // the two big character files at low priority, so the poster, fonts and styles still arrive first.
      var CDN = 'https://cdn.jsdelivr.net/npm/';
      var modules = [
        // The page's animation library and smooth scrolling (site.js waits for them before anything moves).
        'js/core.js', CDN + 'gsap@3.15.1/index.js', CDN + 'gsap@3.15.1/gsap-core.js', CDN + 'gsap@3.15.1/CSSPlugin.js',
        CDN + 'gsap@3.15.1/ScrollTrigger.js', CDN + 'gsap@3.15.1/Observer.js', CDN + 'gsap@3.15.1/SplitText.js', CDN + 'lenis@1.3.27/dist/lenis.mjs',
        // The film: its code (every file it imports), three.js and the character loader.
        'js/film.js', 'js/gl.js', 'js/world/terrain.js', 'js/world/forest.js', 'js/world/trekker.js',
        'js/world/landmarks.js', 'js/world/summit.js', 'js/world/meadow.js', 'js/world/sky.js', 'js/world/camp.js',
        'js/world/ridge.js', 'js/world/grass.js', 'js/world/mist.js', 'js/world/motes.js', 'js/world/cameraPath.js',
        'js/world/journey.js', 'js/world/palette.js', 'js/world/glsl.js', 'js/world/gear.js', 'js/world/shade.js',
        'js/ui/altitude.js', 'js/ui/story.js', 'js/ui/camp-ui.js', 'js/ui/gear-ui.js', 'js/ui/veil.js',
        CDN + 'three@0.187.0/build/three.module.min.js', CDN + 'three@0.187.0/build/three.core.js',
        CDN + '@pixiv/three-vrm@3.5.5/lib/three-vrm.module.min.js', CDN + 'three@0.187.0/examples/jsm/loaders/GLTFLoader.js',
        CDN + 'three@0.187.0/examples/jsm/utils/BufferGeometryUtils.js', CDN + 'three@0.187.0/examples/jsm/utils/SkeletonUtils.js',
        CDN + 'three@0.187.0/examples/jsm/geometries/RoundedBoxGeometry.js',
      ];
      var base = (document.currentScript.getAttribute('src') || '').replace('js/device.js', '');
      modules.forEach(function (href, i) {
        var m = document.createElement('link');
        m.rel = 'modulepreload';
        m.href = href.indexOf('http') === 0 ? href : base + href;
        document.head.appendChild(m);
      });
      // The trekker and his animations (the same requests trekker.js makes, so the browser reuses them).
      ['assets/pratul-trekker-film.vrm', 'assets/animations/clips.json'].forEach(function (href) {
        var f = document.createElement('link');
        f.rel = 'preload';
        f.as = 'fetch';
        f.href = base + href;
        f.crossOrigin = 'anonymous';
        f.setAttribute('fetchpriority', 'low');
        document.head.appendChild(f);
      });
    }
    // The phone page opens on the summit painting: fetch it straight away, first in line, so the
    // first screen paints fast (css/home.css shows it as the hero's background).
    if (mode !== 'film') {
      var still = document.createElement('link');
      still.rel = 'preload';
      still.as = 'image';
      // (The same choice as css/home.css makes: the larger painting on sharp or wider screens.)
      var big = (window.devicePixelRatio || 1) >= 1.5 || window.innerWidth >= 500;
      still.href = 'assets/redesign/summit-phone-' + (big ? '1058' : '720') + '.webp';
      still.setAttribute('fetchpriority', 'high');
      document.head.appendChild(still);
    }
  }

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

    // Phones and portrait tablets never get the film, and we don't even ask for 3D (no WebGL
    // context is created): the page is light and fast.
    if (!wide) return reduce ? 'calm' : 'mobile';
    // Big landscape tablets: the film, if their graphics are strong enough.
    var gpu = probeGPU();
    if (gpu && strong(gpu) && !weak(gpu)) return 'film';
    return reduce ? 'calm' : 'mobile';
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

// Video sections (site/shared/media/): #intro above #home ("Lunar Gazette" hook) and #closing after #sites, Landing & Impact Sites (MoonWatch extra edition); loads after landing.js, which creates #sites.
// Each video plays once when its section first becomes visible and stops at the end (or at stopAt, before a fade-out),
// showing its last meaningful frame; Stop / Play button (Play after the end replays it). Reduced motion: no autoplay, poster only.
(function (root) {
  'use strict';

  var doc = root.document;
  var reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var VIDEOS = [
    { id: 'intro', label: 'Intro video', anchor: 'home', where: 'beforebegin', file: 'hook_newspaper',
      caption: 'At the lunar south pole, a four-day launch slip can mean months of waiting, and millions lost.' },
    { id: 'closing', label: 'Closing video', anchor: 'sites', where: 'afterend', file: 'closing_moonwatch', stopAt: 4.5, // the video fades to dark after 4.6 s
      caption: 'Extra edition: See the risk. Pick the site. MoonWatch. Save the mission.' }
  ];

  function mount(cfg) {
    var anchor = doc.getElementById(cfg.anchor);
    if (!anchor) return null;
    var base = 'shared/media/' + cfg.file;
    anchor.insertAdjacentHTML(cfg.where,
      '<section id="' + cfg.id + '" class="video-section" aria-label="' + cfg.label + '">' +
        '<div class="wrap">' +
          '<figure class="video-frame">' +
            '<video class="video-clip" muted playsinline preload="metadata" poster="' + base + '.jpg" aria-describedby="' + cfg.id + '-caption">' +
              '<source src="' + base + '.mp4" type="video/mp4"></video>' +
            '<button type="button" class="btn video-toggle"></button>' +
            '<figcaption id="' + cfg.id + '-caption" class="visually-hidden">' + cfg.caption + '</figcaption>' +
          '</figure>' +
        '</div>' +
      '</section>');
    var section = doc.getElementById(cfg.id);
    var video = section.querySelector('video');
    var button = section.querySelector('.video-toggle');
    var finished = false; // reached the end (or stopAt): next Play starts over

    function label() {
      var playing = !video.paused;
      button.textContent = playing ? '■ Stop' : '▶ Play';
      button.setAttribute('aria-label', (playing ? 'Stop ' : 'Play ') + cfg.label.toLowerCase());
    }
    function play() {
      if (finished) { video.currentTime = 0; finished = false; }
      var p = video.play();
      if (p && p.catch) p.catch(label);
    }
    button.addEventListener('click', function () { if (video.paused) play(); else video.pause(); });
    ['play', 'pause', 'ended'].forEach(function (e) { video.addEventListener(e, label); });
    video.addEventListener('ended', function () { finished = true; });
    if (cfg.stopAt) {
      video.addEventListener('timeupdate', function () {
        if (!video.paused && video.currentTime >= cfg.stopAt) { video.pause(); video.currentTime = cfg.stopAt; finished = true; }
      });
    }
    label();

    // Autoplay once, when at least half of the frame is on screen.
    if (!reduced && 'IntersectionObserver' in root) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); play(); }
      }, { threshold: 0.5 });
      io.observe(video);
    }
    return video;
  }

  root.MoonVideos = {};
  VIDEOS.forEach(function (cfg) { root.MoonVideos[cfg.id] = mount(cfg); });
})(window);

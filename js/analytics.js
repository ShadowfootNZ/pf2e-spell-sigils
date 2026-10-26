(function () {
  const ENDPOINT = 'https://shadowfoot.com/analytics/track.php';
  const TOKEN    = '9b2615c7e2c8d838dd661ff0e2ff887e2a3a450a800a51494616685af25425dd';
  // Normalize the path into a stable app id.
  const APP_ID = location.pathname
    .replace(/^\//, '')
    .replace(/\.[^/.]+$/, '')
    .replace(/\/index$/, '')
    .replace(/^index$/, '')
    .replace(/\/+$/, '')
    || 'root';

  function isLocalOrPrivateHost(hostname) {
    return /^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
  }

  // A browser asking not to be tracked, by Global Privacy Control or the
  // older Do Not Track, gets nothing sent at all, not even the page view.
  function privacyRequested() {
    return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  }

  const enabled = !isLocalOrPrivateHost(location.hostname) && !privacyRequested();

  function track(event = null) {
    if (!enabled) return;
    const payload = {
      app_id:         APP_ID,
      referrer:       document.referrer || '',
      viewport_width: window.innerWidth || null,
    };
    if (event) payload.event = event;
    fetch(ENDPOINT, {
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'X-Analytics-Token': TOKEN,
      },
      body:      JSON.stringify(payload),
      keepalive: true,
    }).catch(function () {
      // Analytics must never break the app.
    });
  }

  // Callers pass fixed event names only, never the spell, search text or filter values.
  globalThis.trackAppFeature = track;
  track();
})();

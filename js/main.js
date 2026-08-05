const playerA = document.getElementById('player-a');
const playerB = document.getElementById('player-b');
const preloadPool = document.getElementById('preload-pool');

let activePlayer = playerA;
let hiddenPlayer = playerB;

function videoPath(file) {
  return `Videos/${file}`;
}

// Warms the browser cache for every animation so the hidden player's
// load step below resolves almost instantly.
function preloadAllVideos() {
  const files = new Set([
    ANIMATIONS.default.file,
    ...Object.values(ANIMATIONS.keys).map((a) => a.file),
  ]);
  files.forEach((file) => {
    const video = document.createElement('video');
    video.src = videoPath(file);
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    preloadPool.appendChild(video);
  });
}

// Cancels whatever the previous switch's load step was waiting on, so a new
// switch never leaves stray listeners/rAF callbacks behind.
let cancelPendingLoad = null;

function clearPendingLoad() {
  if (cancelPendingLoad) {
    cancelPendingLoad();
    cancelPendingLoad = null;
  }
}

function waitForDecodedFrame(video) {
  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      // Two rAF ticks guarantee the browser has actually decoded/composited
      // the frame at currentTime = 0 before we reveal the element, which is
      // what prevents the blank-frame flicker on switch.
      const id1 = requestAnimationFrame(() => {
        const id2 = requestAnimationFrame(resolve);
        cancelPendingLoad = () => cancelAnimationFrame(id2);
      });
      cancelPendingLoad = () => cancelAnimationFrame(id1);
    };

    const onReady = () => finish();
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    cancelPendingLoad = () => {
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
    };
  });
}

async function switchTo(file, loop) {
  clearPendingLoad();

  hiddenPlayer.pause();
  hiddenPlayer.loop = loop;
  hiddenPlayer.src = videoPath(file);
  hiddenPlayer.load();
  hiddenPlayer.currentTime = 0;

  await waitForDecodedFrame(hiddenPlayer);
  cancelPendingLoad = null;

  const incoming = hiddenPlayer;
  const outgoing = activePlayer;

  // Reveal the loaded frame before hiding the old one so both players are
  // never hidden at the same time (a brief moment of both-visible is fine;
  // a gap of both-hidden is what caused the flicker).
  incoming.classList.add('active');
  outgoing.classList.remove('active');
  outgoing.pause();
  incoming.play().catch(() => {});

  activePlayer = incoming;
  hiddenPlayer = outgoing;
}

let switching = false;

async function requestAnimation(file, loop) {
  if (switching) return;
  switching = true;
  try {
    await switchTo(file, loop);
  } finally {
    switching = false;
  }
}

function handleEnded(event) {
  if (switching) return;
  if (event.target === activePlayer && !activePlayer.loop) {
    requestAnimation(ANIMATIONS.default.file, true);
  }
}
playerA.addEventListener('ended', handleEnded);
playerB.addEventListener('ended', handleEnded);

document.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (switching) return;
  const animation = ANIMATIONS.keys[event.key];
  if (animation) requestAnimation(animation.file, animation.loop);
});

async function init() {
  preloadAllVideos();
  switching = true;
  activePlayer.loop = true;
  activePlayer.src = videoPath(ANIMATIONS.default.file);
  activePlayer.load();
  await waitForDecodedFrame(activePlayer);
  cancelPendingLoad = null;
  activePlayer.classList.add('active');
  await activePlayer.play().catch(() => {});
  switching = false;
}

init();

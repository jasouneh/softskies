export function createHud(root) {
  const overlay = document.createElement("div");
  overlay.className = "polyfly-overlay";
  overlay.innerHTML = `
    <h1>polyFly</h1>
    <p><strong>Click the sky to fly.</strong> Mouse steers while locked. W/S pitch, A/D bank and turn, Shift boosts, Esc releases.</p>
    <dl class="polyfly-stats">
      <div><dt>speed</dt><dd data-stat="speed">--</dd></div>
      <div><dt>altitude</dt><dd data-stat="altitude">--</dd></div>
      <div><dt>chunks</dt><dd data-stat="chunks">--</dd></div>
      <div><dt>time</dt><dd data-stat="time">--</dd></div>
    </dl>
    <p class="polyfly-lock" data-stat="lock">Pointer unlocked</p>
  `;
  root.append(overlay);

  const speed = overlay.querySelector('[data-stat="speed"]');
  const altitude = overlay.querySelector('[data-stat="altitude"]');
  const chunks = overlay.querySelector('[data-stat="chunks"]');
  const time = overlay.querySelector('[data-stat="time"]');
  const lock = overlay.querySelector('[data-stat="lock"]');

  return {
    update({ pose, terrainHeight, chunkStats, atmosphere, pointerLocked }) {
      speed.textContent = `${Math.round(pose.speed)} u/s`;
      altitude.textContent = `${Math.round(pose.position.y - terrainHeight)} above ground`;
      chunks.textContent = `${chunkStats.loadedCount}/${chunkStats.maxChunks} loaded · ${chunkStats.queuedCount} queued`;
      time.textContent = atmosphere.dayFactor > 0.5 ? "day" : "night";
      lock.textContent = pointerLocked ? "Pointer locked — fly free" : "Click canvas to lock pointer";
      root.classList.toggle("is-pointer-locked", pointerLocked);
    },
    dispose() {
      overlay.remove();
    },
  };
}

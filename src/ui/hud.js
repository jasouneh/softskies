const DEFAULT_AVATARS = Object.freeze([
  { id: "phoenix", label: "Phoenix" },
]);

export function createHud(root, {
  avatars = DEFAULT_AVATARS,
  selectedAvatar = "phoenix",
  onPauseToggle = () => {},
  onAvatarChange = () => {},
} = {}) {
  const overlay = document.createElement("div");
  overlay.className = "polyfly-ui";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="polyfly-ui__status">
      <strong>polyFly</strong>
      <span data-stat="pause-state">Flying</span>
    </div>
    <div class="polyfly-ui__actions">
      <button type="button" data-action="pause">Pause</button>
      <label>
        Avatar
        <select data-action="avatar"></select>
      </label>
    </div>
    <dl class="polyfly-stats" aria-label="flight status">
      <div><dt>speed</dt><dd data-stat="speed">--</dd></div>
      <div><dt>alt</dt><dd data-stat="altitude">--</dd></div>
      <div><dt>chunks</dt><dd data-stat="chunks">--</dd></div>
      <div><dt>time</dt><dd data-stat="time">--</dd></div>
    </dl>
    <p class="polyfly-hint" data-stat="lock">Click the sky to lock pointer · Space pauses</p>
  `;
  root.append(overlay);

  const pauseButton = overlay.querySelector('[data-action="pause"]');
  const avatarSelect = overlay.querySelector('[data-action="avatar"]');
  const pauseState = overlay.querySelector('[data-stat="pause-state"]');
  const speed = overlay.querySelector('[data-stat="speed"]');
  const altitude = overlay.querySelector('[data-stat="altitude"]');
  const chunks = overlay.querySelector('[data-stat="chunks"]');
  const time = overlay.querySelector('[data-stat="time"]');
  const lock = overlay.querySelector('[data-stat="lock"]');

  for (const avatar of avatars) {
    const option = document.createElement("option");
    option.value = avatar.id;
    option.textContent = avatar.label;
    avatarSelect.append(option);
  }
  avatarSelect.value = selectedAvatar;
  avatarSelect.title = avatars.length <= 1 ? "Phoenix is the only avatar for now; more will arrive later." : "Choose avatar";

  function show() {
    overlay.hidden = false;
    root.classList.add("has-polyfly-ui");
  }

  function setPaused(paused) {
    pauseState.textContent = paused ? "Paused" : "Flying";
    pauseButton.textContent = paused ? "Resume" : "Pause";
    root.classList.toggle("is-paused", paused);
  }

  function handlePauseClick() {
    show();
    onPauseToggle();
  }

  function handleAvatarChange() {
    show();
    onAvatarChange(avatarSelect.value);
  }

  pauseButton.addEventListener("click", handlePauseClick);
  avatarSelect.addEventListener("change", handleAvatarChange);

  return {
    show,
    setPaused,
    update({ pose, terrainHeight, chunkStats, atmosphere, pointerLocked, paused = false }) {
      setPaused(paused);
      speed.textContent = paused ? "paused" : `${Math.round(pose.speed)} u/s`;
      altitude.textContent = `${Math.round(pose.position.y - terrainHeight)}`;
      chunks.textContent = `${chunkStats.loadedCount}/${chunkStats.maxChunks} · ${chunkStats.queuedCount}q`;
      time.textContent = atmosphere.dayFactor > 0.5 ? "day" : "night";
      lock.textContent = paused
        ? "Paused · Space resumes"
        : pointerLocked
          ? "Pointer locked · Space pauses"
          : "Click sky to fly · Space pauses";
      root.classList.toggle("is-pointer-locked", pointerLocked);
    },
    dispose() {
      pauseButton.removeEventListener("click", handlePauseClick);
      avatarSelect.removeEventListener("change", handleAvatarChange);
      overlay.remove();
    },
  };
}

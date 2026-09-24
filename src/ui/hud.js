const DEFAULT_AVATARS = Object.freeze([
  { id: "phoenix", label: "Phoenix", thumbnailSrc: createPhoenixThumbnailDataUri() },
]);

const DEFAULT_MAPS = Object.freeze([
  {
    id: "classic-highlands",
    label: "Classic Highlands",
    description: "The original Soft Skies plains, rivers, villages, mountains, and snowfields.",
  },
]);

export function createHud(root, {
  avatars = DEFAULT_AVATARS,
  selectedAvatar = "phoenix",
  maps = DEFAULT_MAPS,
  selectedMapId = maps[0]?.id,
  onPauseToggle = () => {},
  onAvatarChange = () => {},
  onMapChange = () => {},
  onMapOpenChange = () => {},
} = {}) {
  const overlay = document.createElement("div");
  overlay.className = "softskies-ui";
  overlay.hidden = true;
  overlay.innerHTML = `
    <button type="button" class="softskies-ui-button softskies-pause-button" data-action="pause" aria-label="Pause game">Pause</button>
    <div class="softskies-avatar-picker">
      <button type="button" class="softskies-ui-button softskies-avatar-trigger" data-action="avatar-trigger" aria-haspopup="menu" aria-expanded="false">Avatar</button>
      <div class="softskies-avatar-menu" data-role="avatar-menu" role="menu" hidden></div>
    </div>
    <button type="button" class="softskies-ui-button softskies-map-trigger" data-action="map-trigger" aria-haspopup="dialog" aria-expanded="false" aria-label="Choose map" title="Choose map">
      <svg class="softskies-map-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M9 3v15M15 6v15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
    </button>
    <div class="softskies-map-backdrop" data-role="map-dialog" role="dialog" aria-modal="true" aria-labelledby="softskies-map-title" hidden>
      <section class="softskies-map-panel">
        <div class="softskies-map-header">
          <h2 id="softskies-map-title" class="softskies-map-title">Choose map</h2>
          <button type="button" class="softskies-ui-button" data-action="map-close" aria-label="Close map choices">Close</button>
        </div>
        <div class="softskies-map-options" data-role="map-options"></div>
      </section>
    </div>
  `;
  root.append(overlay);

  const pauseButton = overlay.querySelector('[data-action="pause"]');
  const avatarTrigger = overlay.querySelector('[data-action="avatar-trigger"]');
  const avatarMenu = overlay.querySelector('[data-role="avatar-menu"]');
  const mapTrigger = overlay.querySelector('[data-action="map-trigger"]');
  const mapDialog = overlay.querySelector('[data-role="map-dialog"]');
  const mapClose = overlay.querySelector('[data-action="map-close"]');
  const mapOptions = overlay.querySelector('[data-role="map-options"]');
  const avatarButtons = new Map();
  const mapButtons = new Map();

  for (const avatar of avatars) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "softskies-avatar-option";
    button.dataset.avatarId = avatar.id;
    button.setAttribute("role", "menuitemradio");
    button.setAttribute("aria-checked", "false");

    const thumbnail = document.createElement("img");
    thumbnail.className = "softskies-avatar-thumb";
    thumbnail.alt = "";
    thumbnail.src = avatar.thumbnailSrc ?? createPhoenixThumbnailDataUri();
    thumbnail.width = 48;
    thumbnail.height = 36;
    thumbnail.decoding = "async";
    thumbnail.draggable = false;

    const label = document.createElement("span");
    label.textContent = avatar.label;

    button.append(thumbnail, label);
    avatarMenu.append(button);
    avatarButtons.set(avatar.id, button);
  }

  const initialAvatarId = avatars.some((avatar) => avatar.id === selectedAvatar)
    ? selectedAvatar
    : avatars[0]?.id;
  avatarTrigger.disabled = avatarButtons.size === 0;
  avatarTrigger.title = avatars.length <= 1
    ? "Phoenix is the only avatar for now; more will arrive later."
    : "Choose avatar";
  updateAvatarSelection(initialAvatarId);

  for (const map of maps) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "softskies-map-option";
    button.dataset.mapId = map.id;
    button.innerHTML = `
      <span class="softskies-map-option-title"></span>
      <span class="softskies-map-option-description"></span>
    `;
    button.querySelector(".softskies-map-option-title").textContent = map.label;
    button.querySelector(".softskies-map-option-description").textContent = map.description ?? "Explore this generated world.";
    mapOptions.append(button);
    mapButtons.set(map.id, button);
  }
  const initialMapId = maps.some((map) => map.id === selectedMapId) ? selectedMapId : maps[0]?.id;
  mapTrigger.disabled = mapButtons.size === 0;
  updateMapSelection(initialMapId);

  function show() {
    overlay.hidden = false;
    root.classList.add("has-softskies-ui");
  }

  function setPaused(paused) {
    pauseButton.textContent = paused ? "Play" : "Pause";
    pauseButton.setAttribute("aria-label", paused ? "Play game" : "Pause game");
    pauseButton.setAttribute("aria-pressed", String(paused));
    root.classList.toggle("is-paused", paused);
  }

  function toggleAvatarMenu(forceOpen = avatarMenu.hidden) {
    const open = Boolean(forceOpen);
    avatarMenu.hidden = !open;
    avatarTrigger.setAttribute("aria-expanded", String(open));
    root.classList.toggle("is-avatar-menu-open", open);
  }

  function toggleMapDialog(forceOpen = mapDialog.hidden) {
    const open = Boolean(forceOpen);
    const wasOpen = !mapDialog.hidden;
    if (open === wasOpen) {
      return;
    }
    mapDialog.hidden = !open;
    mapTrigger.setAttribute("aria-expanded", String(open));
    root.classList.toggle("is-map-dialog-open", open);
    onMapOpenChange(open);
    if (open) {
      toggleAvatarMenu(false);
      mapDialog.querySelector(".is-selected")?.focus?.();
    } else {
      mapTrigger.focus?.();
    }
  }

  function updateAvatarSelection(avatarId) {
    for (const [id, button] of avatarButtons) {
      const selected = id === avatarId;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-checked", String(selected));
    }
  }

  function updateMapSelection(mapId) {
    for (const [id, button] of mapButtons) {
      const selected = id === mapId;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  }

  function handlePauseClick() {
    show();
    onPauseToggle();
  }

  function handleAvatarTriggerClick() {
    show();
    toggleAvatarMenu();
  }

  function handleAvatarMenuClick(event) {
    const button = event.target instanceof Element
      ? event.target.closest("[data-avatar-id]")
      : null;
    if (!button || !avatarMenu.contains(button)) {
      return;
    }

    const avatarId = button.dataset.avatarId;
    show();
    updateAvatarSelection(avatarId);
    toggleAvatarMenu(false);
    onAvatarChange(avatarId);
  }

  function handleMapTriggerClick() {
    show();
    toggleMapDialog();
  }

  function handleMapCloseClick() {
    toggleMapDialog(false);
  }

  function handleMapDialogClick(event) {
    if (event.target === mapDialog) {
      toggleMapDialog(false);
      return;
    }

    const button = event.target instanceof Element
      ? event.target.closest("[data-map-id]")
      : null;
    if (!button || !mapDialog.contains(button)) {
      return;
    }

    const mapId = button.dataset.mapId;
    show();
    updateMapSelection(mapId);
    onMapChange(mapId);
    toggleMapDialog(false);
  }

  function handleDocumentClick(event) {
    if (event.target instanceof Node && !overlay.contains(event.target)) {
      toggleAvatarMenu(false);
    }
  }

  function handleDocumentKeyDown(event) {
    if (event.key === "Escape") {
      toggleAvatarMenu(false);
      toggleMapDialog(false);
    }
  }

  pauseButton.addEventListener("click", handlePauseClick);
  avatarTrigger.addEventListener("click", handleAvatarTriggerClick);
  avatarMenu.addEventListener("click", handleAvatarMenuClick);
  mapTrigger.addEventListener("click", handleMapTriggerClick);
  mapClose.addEventListener("click", handleMapCloseClick);
  mapDialog.addEventListener("click", handleMapDialogClick);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeyDown);

  return {
    show,
    setPaused,
    updateMapSelection,
    update({ pointerLocked, paused = false }) {
      setPaused(paused);
      root.classList.toggle("is-pointer-locked", pointerLocked);
    },
    dispose() {
      pauseButton.removeEventListener("click", handlePauseClick);
      avatarTrigger.removeEventListener("click", handleAvatarTriggerClick);
      avatarMenu.removeEventListener("click", handleAvatarMenuClick);
      mapTrigger.removeEventListener("click", handleMapTriggerClick);
      mapClose.removeEventListener("click", handleMapCloseClick);
      mapDialog.removeEventListener("click", handleMapDialogClick);
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleDocumentKeyDown);
      overlay.remove();
    },
  };
}

function createPhoenixThumbnailDataUri() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72" role="img" aria-label="Low-poly phoenix thumbnail">
      <rect width="96" height="72" rx="12" fill="#173142"/>
      <polygon points="6,45 39,27 43,39 16,61" fill="#8f2b2e"/>
      <polygon points="90,45 57,27 53,39 80,61" fill="#b93635"/>
      <polygon points="14,50 38,36 47,45 27,66" fill="#db6b32"/>
      <polygon points="82,50 58,36 49,45 69,66" fill="#f07f32"/>
      <polygon points="24,35 43,29 48,42 31,51" fill="#ffd166"/>
      <polygon points="72,35 53,29 48,42 65,51" fill="#ffe07a"/>
      <polygon points="48,13 62,35 55,50 48,58 41,50 34,35" fill="#f47a2f"/>
      <polygon points="48,13 55,34 48,58 41,34" fill="#ffd166"/>
      <polygon points="38,35 48,24 58,35 48,43" fill="#c0522d"/>
      <polygon points="48,7 55,20 50,18 48,28 46,18 41,20" fill="#fff0a8"/>
      <polygon points="40,57 46,45 48,70" fill="#d14375"/>
      <polygon points="56,57 50,45 48,70" fill="#7b1724"/>
      <polygon points="46,58 48,44 52,58 49,70" fill="#ffbd4a"/>
    </svg>
  `.trim();
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

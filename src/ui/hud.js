const DEFAULT_AVATARS = Object.freeze([
  { id: "phoenix", label: "Phoenix", thumbnailTheme: "phoenix" },
  { id: "dragon", label: "Dragon", thumbnailTheme: "dragon" },
]);

const DEFAULT_MAPS = Object.freeze([
  {
    id: "classic-highlands",
    label: "Classic Highlands",
    description: "The original Soft Skies plains, rivers, villages, mountains, and snowfields.",
    thumbnailTheme: "highlands",
  },
  {
    id: "sunspice-wilds",
    label: "Sunspice Wilds",
    description: "Jungles, rainforests, and hilly deserts with biome-themed ruins and villages.",
    thumbnailTheme: "sunspice",
  },
  {
    id: "jade-provinces",
    label: "Jade Provinces",
    description: "Ancient Chinese-inspired stone forests, temple mountains, and villages.",
    thumbnailTheme: "jade",
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
    <button type="button" class="softskies-ui-button softskies-icon-button softskies-pause-button" data-action="pause" aria-label="Pause game" title="Pause game" aria-pressed="false">
      <svg class="softskies-button-icon softskies-pause-icon" data-role="pause-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M8 6v12M16 6v12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      </svg>
      <svg class="softskies-button-icon softskies-play-icon" data-role="play-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" hidden>
        <path d="M9 6.8v10.4L17 12 9 6.8z" fill="currentColor" stroke="currentColor" stroke-linejoin="round" />
      </svg>
    </button>
    <div class="softskies-avatar-picker">
      <button type="button" class="softskies-ui-button softskies-icon-button softskies-avatar-trigger" data-action="avatar-trigger" aria-haspopup="menu" aria-expanded="false" aria-label="Choose avatar" title="Choose avatar">
        <img class="softskies-avatar-trigger-icon" data-role="avatar-trigger-icon" alt="" width="24" height="24" decoding="async" draggable="false" />
      </button>
      <div class="softskies-avatar-menu" data-role="avatar-menu" role="menu" hidden></div>
    </div>
    <button type="button" class="softskies-ui-button softskies-icon-button softskies-map-trigger" data-action="map-trigger" aria-haspopup="dialog" aria-expanded="false" aria-label="Choose map" title="Choose map">
      <svg class="softskies-map-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M9 3v15M15 6v15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
    </button>
  `;
  const mapDialog = document.createElement("div");
  mapDialog.className = "softskies-map-backdrop";
  mapDialog.dataset.role = "map-dialog";
  mapDialog.setAttribute("role", "dialog");
  mapDialog.setAttribute("aria-modal", "true");
  mapDialog.setAttribute("aria-label", "Choose map");
  mapDialog.hidden = true;
  mapDialog.innerHTML = `
    <section class="softskies-map-panel">
      <div class="softskies-map-options" data-role="map-options"></div>
    </section>
  `;
  root.append(overlay, mapDialog);

  const pauseButton = overlay.querySelector('[data-action="pause"]');
  const pauseIcon = overlay.querySelector('[data-role="pause-icon"]');
  const playIcon = overlay.querySelector('[data-role="play-icon"]');
  const avatarTrigger = overlay.querySelector('[data-action="avatar-trigger"]');
  const avatarTriggerIcon = overlay.querySelector('[data-role="avatar-trigger-icon"]');
  const avatarMenu = overlay.querySelector('[data-role="avatar-menu"]');
  const mapTrigger = overlay.querySelector('[data-action="map-trigger"]');
  const mapOptions = mapDialog.querySelector('[data-role="map-options"]');
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
    thumbnail.src = avatar.thumbnailSrc ?? createAvatarThumbnailDataUri(avatar.thumbnailTheme ?? avatar.id);
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
  updateAvatarSelection(initialAvatarId);

  for (const map of maps) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "softskies-map-option";
    button.dataset.mapId = map.id;
    button.innerHTML = `
      <img class="softskies-map-thumbnail" alt="" width="192" height="120" decoding="async" draggable="false" />
      <span class="softskies-map-option-title"></span>
    `;
    button.setAttribute("aria-label", `Choose ${map.label}`);
    button.querySelector(".softskies-map-thumbnail").src = map.thumbnailSrc ?? createMapThumbnailDataUri(map.thumbnailTheme ?? map.id);
    button.querySelector(".softskies-map-option-title").textContent = map.label;
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
    pauseIcon.hidden = paused;
    playIcon.hidden = !paused;
    pauseButton.dataset.state = paused ? "play" : "pause";
    pauseButton.setAttribute("aria-label", paused ? "Play game" : "Pause game");
    pauseButton.setAttribute("title", paused ? "Play game" : "Pause game");
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
    const selectedAvatarOption = avatars.find((avatar) => avatar.id === avatarId) ?? avatars[0];
    for (const [id, button] of avatarButtons) {
      const selected = id === avatarId;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-checked", String(selected));
    }
    if (selectedAvatarOption) {
      avatarTriggerIcon.src = selectedAvatarOption.thumbnailSrc ?? createAvatarThumbnailDataUri(selectedAvatarOption.thumbnailTheme ?? selectedAvatarOption.id);
      const label = avatars.length <= 1
        ? `${selectedAvatarOption.label} avatar`
        : `Choose avatar, current ${selectedAvatarOption.label}`;
      avatarTrigger.setAttribute("aria-label", label);
      avatarTrigger.setAttribute("title", label);
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
      mapDialog.removeEventListener("click", handleMapDialogClick);
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleDocumentKeyDown);
      overlay.remove();
      mapDialog.remove();
    },
  };
}

function createAvatarThumbnailDataUri(theme) {
  if (theme === "dragon") {
    return createDragonThumbnailDataUri();
  }
  return createPhoenixThumbnailDataUri();
}

function createMapThumbnailDataUri(theme) {
  const palettes = {
    highlands: {
      sky: "#76d8ff",
      ground: "#6bc66a",
      mountain: "#7d8a93",
      accent: "#f5fbff",
      river: "#4aa6c4",
    },
    sunspice: {
      sky: "#ffd08a",
      ground: "#d3ad5d",
      mountain: "#aa8760",
      accent: "#2f9b4f",
      river: "#70b96a",
    },
    jade: {
      sky: "#b9ecff",
      ground: "#78c96c",
      mountain: "#69757a",
      accent: "#a83e2d",
      river: "#2e8c68",
    },
  };
  const palette = palettes[theme] ?? palettes.highlands;
  const temple = theme === "jade"
    ? `<rect x="118" y="58" width="38" height="22" fill="${palette.accent}"/><polygon points="112,58 162,58 154,48 120,48" fill="#2e8c68"/><rect x="129" y="70" width="8" height="10" fill="#f0c45a"/>`
    : "";
  const cactus = theme === "sunspice"
    ? `<rect x="134" y="62" width="7" height="28" rx="3" fill="#5b9855"/><rect x="124" y="70" width="18" height="5" rx="2" fill="#5b9855"/><rect x="158" y="66" width="5" height="18" rx="2" fill="#5b9855"/>`
    : "";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 120" role="img" aria-label="Soft Skies map thumbnail">
      <rect width="192" height="120" rx="14" fill="${palette.sky}"/>
      <circle cx="156" cy="26" r="14" fill="#ffe07a" opacity="0.9"/>
      <polygon points="0,92 38,36 82,92" fill="${palette.mountain}"/>
      <polygon points="46,92 94,24 144,92" fill="${palette.mountain}" opacity="0.92"/>
      <polygon points="90,92 134,42 192,92" fill="${palette.mountain}" opacity="0.78"/>
      <polygon points="0,78 52,56 100,76 154,58 192,74 192,120 0,120" fill="${palette.ground}"/>
      <path d="M20 112 C54 92, 70 106, 96 86 S143 76, 174 96" fill="none" stroke="${palette.river}" stroke-width="8" stroke-linecap="round" opacity="0.9"/>
      <polygon points="78,32 94,24 109,34 101,40 91,36 83,41" fill="${palette.accent}" opacity="0.95"/>
      ${temple}${cactus}
    </svg>
  `.trim();
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function createDragonThumbnailDataUri() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72" role="img" aria-label="Low-poly dragon thumbnail">
      <rect width="96" height="72" rx="12" fill="#12333a"/>
      <path d="M14 47 C25 23, 42 55, 57 32 S83 34, 76 52" fill="none" stroke="#2bbf7c" stroke-width="10" stroke-linecap="round"/>
      <path d="M15 46 C26 24, 42 55, 57 32 S82 34, 75 52" fill="none" stroke="#f0c45a" stroke-width="4" stroke-linecap="round" opacity="0.9"/>
      <polygon points="63,24 78,30 69,39" fill="#2bbf7c"/>
      <polygon points="72,23 85,20 77,30" fill="#ffdf7a"/>
      <polygon points="63,23 58,13 69,22" fill="#ffdf7a"/>
      <circle cx="73" cy="30" r="2" fill="#fff5a0"/>
      <polygon points="35,24 39,13 43,25" fill="#b93635"/>
      <polygon points="46,39 50,27 53,39" fill="#b93635"/>
      <circle cx="19" cy="21" r="3" fill="#72d7ff"/>
      <circle cx="33" cy="15" r="2" fill="#6fffd1"/>
      <circle cx="84" cy="48" r="3" fill="#ff7ac8"/>
    </svg>
  `.trim();
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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

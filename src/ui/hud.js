const DEFAULT_AVATARS = Object.freeze([
  { id: "phoenix", label: "Phoenix", thumbnailSrc: createPhoenixThumbnailDataUri() },
]);

export function createHud(root, {
  avatars = DEFAULT_AVATARS,
  selectedAvatar = "phoenix",
  onPauseToggle = () => {},
  onAvatarChange = () => {},
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
  `;
  root.append(overlay);

  const pauseButton = overlay.querySelector('[data-action="pause"]');
  const avatarTrigger = overlay.querySelector('[data-action="avatar-trigger"]');
  const avatarMenu = overlay.querySelector('[data-role="avatar-menu"]');
  const avatarButtons = new Map();

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

  function updateAvatarSelection(avatarId) {
    for (const [id, button] of avatarButtons) {
      const selected = id === avatarId;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-checked", String(selected));
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

  function handleDocumentClick(event) {
    if (event.target instanceof Node && !overlay.contains(event.target)) {
      toggleAvatarMenu(false);
    }
  }

  function handleDocumentKeyDown(event) {
    if (event.key === "Escape") {
      toggleAvatarMenu(false);
    }
  }

  pauseButton.addEventListener("click", handlePauseClick);
  avatarTrigger.addEventListener("click", handleAvatarTriggerClick);
  avatarMenu.addEventListener("click", handleAvatarMenuClick);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeyDown);

  return {
    show,
    setPaused,
    update({ pointerLocked, paused = false }) {
      setPaused(paused);
      root.classList.toggle("is-pointer-locked", pointerLocked);
    },
    dispose() {
      pauseButton.removeEventListener("click", handlePauseClick);
      avatarTrigger.removeEventListener("click", handleAvatarTriggerClick);
      avatarMenu.removeEventListener("click", handleAvatarMenuClick);
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

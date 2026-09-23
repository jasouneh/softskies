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
  overlay.className = "polyfly-ui";
  overlay.hidden = true;
  overlay.innerHTML = `
    <button type="button" class="polyfly-ui-button polyfly-pause-button" data-action="pause" aria-label="Pause game">Pause</button>
    <div class="polyfly-avatar-picker">
      <button type="button" class="polyfly-ui-button polyfly-avatar-trigger" data-action="avatar-trigger" aria-haspopup="menu" aria-expanded="false">Avatar</button>
      <div class="polyfly-avatar-menu" data-role="avatar-menu" role="menu" hidden></div>
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
    button.className = "polyfly-avatar-option";
    button.dataset.avatarId = avatar.id;
    button.setAttribute("role", "menuitemradio");
    button.setAttribute("aria-checked", "false");

    const thumbnail = document.createElement("img");
    thumbnail.className = "polyfly-avatar-thumb";
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
    root.classList.add("has-polyfly-ui");
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
      <polygon points="11,47 39,30 44,43 21,58" fill="#b85d32"/>
      <polygon points="85,47 57,30 52,43 75,58" fill="#d87339"/>
      <polygon points="22,50 43,39 48,47 33,65" fill="#f0a642"/>
      <polygon points="74,50 53,39 48,47 63,65" fill="#ffbe58"/>
      <polygon points="48,14 61,38 48,53 35,38" fill="#f29c38"/>
      <polygon points="48,14 55,33 48,53 41,33" fill="#ffd166"/>
      <polygon points="36,35 48,25 60,35 48,43" fill="#f07f32"/>
      <polygon points="48,8 55,21 48,18 41,21" fill="#fff0a8"/>
      <polygon points="42,57 48,46 54,57 48,68" fill="#db5a2f"/>
    </svg>
  `.trim();
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

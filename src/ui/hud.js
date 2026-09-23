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
    <button type="button" data-action="pause">Pause</button>
    <label>
      <span>Avatar</span>
      <select data-action="avatar" aria-label="Avatar"></select>
    </label>
  `;
  root.append(overlay);

  const pauseButton = overlay.querySelector('[data-action="pause"]');
  const avatarSelect = overlay.querySelector('[data-action="avatar"]');

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
    update({ pointerLocked, paused = false }) {
      setPaused(paused);
      root.classList.toggle("is-pointer-locked", pointerLocked);
    },
    dispose() {
      pauseButton.removeEventListener("click", handlePauseClick);
      avatarSelect.removeEventListener("change", handleAvatarChange);
      overlay.remove();
    },
  };
}

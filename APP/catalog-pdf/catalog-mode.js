const mode = document.querySelector('#catalogMode');
const info = mode.querySelector('.catalog-mode-info');
const popover = mode.querySelector('.catalog-mode-popover');
let hovered = false;
let focused = false;
let pinned = false;
let dismissed = false;

const updatePopover = () => {
  const open = !dismissed && (hovered || focused || pinned);
  popover.hidden = !open;
  info.setAttribute('aria-expanded', String(open));
};

mode.addEventListener('mouseenter', () => {
  hovered = true;
  dismissed = false;
  updatePopover();
});
mode.addEventListener('mouseleave', () => {
  hovered = false;
  updatePopover();
});
mode.addEventListener('focusin', () => {
  focused = true;
  dismissed = false;
  updatePopover();
});
mode.addEventListener('focusout', (event) => {
  if (mode.contains(event.relatedTarget)) return;
  focused = false;
  pinned = false;
  updatePopover();
});
info.addEventListener('click', () => {
  pinned = !pinned;
  dismissed = !pinned;
  updatePopover();
});
mode.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  pinned = false;
  dismissed = true;
  updatePopover();
});
document.addEventListener('click', (event) => {
  if (mode.contains(event.target)) return;
  pinned = false;
  dismissed = true;
  updatePopover();
});

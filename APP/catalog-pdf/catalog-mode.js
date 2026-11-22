const mode = document.querySelector('#catalogMode');
const switcher = mode.querySelector('.catalog-mode-switch');
const popover = mode.querySelector('.catalog-mode-popover');
let hovered = false;
let focused = false;
let pinned = false;
let dismissed = false;
let touchTimer;
let touchStart;
let suppressClick = false;

const updatePopover = () => {
  const open = !dismissed && (hovered || focused || pinned);
  popover.hidden = !open;
};

switcher.addEventListener('mouseenter', () => {
  hovered = true;
  dismissed = false;
  updatePopover();
});
mode.addEventListener('mouseleave', () => {
  hovered = false;
  updatePopover();
});
switcher.addEventListener('focusin', () => {
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
switcher.addEventListener('pointerdown', (event) => {
  suppressClick = false;
  if (event.pointerType !== 'touch') return;
  touchStart = { x: event.clientX, y: event.clientY };
  touchTimer = setTimeout(() => {
    touchTimer = null;
    suppressClick = true;
    pinned = true;
    dismissed = false;
    updatePopover();
  }, 450);
});
switcher.addEventListener('pointermove', (event) => {
  if (!touchStart || Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) <= 10) return;
  clearTimeout(touchTimer);
  touchStart = null;
});
switcher.addEventListener('pointerup', () => {
  clearTimeout(touchTimer);
  touchStart = null;
});
switcher.addEventListener('pointercancel', () => {
  clearTimeout(touchTimer);
  touchStart = null;
  suppressClick = false;
});
switcher.addEventListener('contextmenu', (event) => {
  if (touchStart) event.preventDefault();
});
mode.addEventListener('click', (event) => {
  if (!suppressClick) return;
  suppressClick = false;
  event.preventDefault();
  event.stopPropagation();
}, true);
mode.addEventListener('keydown', () => {
  suppressClick = false;
});
document.addEventListener('keydown', (event) => {
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

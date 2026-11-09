(() => {
  const root = document.documentElement;
  const key = 'landscout-appearance';
  const device = window.matchMedia('(prefers-color-scheme: dark)');
  const preference = value => ['light', 'dark'].includes(value) ? value : 'system';
  let choice = 'system';
  try { choice = preference(localStorage.getItem(key)); } catch {}
  function render() {
    const dark = choice === 'dark' || (choice === 'system' && device.matches);
    const theme = dark ? 'dark' : 'light';
    if (root.dataset.theme !== theme) {
      root.dataset.theme = theme;
      window.dispatchEvent(new Event('landscout-theme'));
    }
    document.getElementById('theme-toggle')?.setAttribute('aria-pressed', String(dark));
    const select = document.getElementById('theme-choice');
    if (select) select.value = choice;
  }
  function save(value) {
    choice = preference(value);
    try { localStorage.setItem(key, choice); } catch {}
    render();
  }
  render();
  device.addEventListener('change', render);
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { choice = preference(event.newValue); render(); }
  });
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('theme-toggle').onclick = () => save(root.dataset.theme === 'dark' ? 'light' : 'dark');
    document.getElementById('theme-choice').onchange = event => save(event.target.value);
    render();
  });
})();

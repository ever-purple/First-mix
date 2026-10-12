(() => {
  const style = document.createElement('style');
  style.textContent = '.progress [role="button"]{cursor:pointer}.progress [aria-disabled="true"]{cursor:default}.progress [role="button"]:focus-visible{outline:2px solid #7952cf;outline-offset:4px;border-radius:4px}';
  document.head.append(style);
  function bind({ go, stop, map } = {}) {
    const progress = document.querySelector('.progress');
    const items = progress ? [...progress.querySelectorAll('span')] : [];
    if (!progress || !items.length || typeof go !== 'function') return;

    const targets = items.map((item, index) => Number(item.dataset.step ?? map?.[index] ?? index));
    let furthest = Math.max(0, items.findIndex(item => item.classList.contains('current')));

    const refresh = () => {
      const current = items.findIndex(item => item.classList.contains('current'));
      if (current >= 0) furthest = Math.max(furthest, current);
      items.forEach((item, index) => {
        const available = index <= furthest;
        item.dataset.stepJump = String(targets[index]);
        item.setAttribute('role', 'button');
        item.tabIndex = available ? 0 : -1;
        item.setAttribute('aria-disabled', String(!available));
        item.toggleAttribute('aria-current', index === current);
        item.title = available ? `跳转到：${item.textContent.trim()}` : '完成前面的步骤后可跳转';
      });
    };

    const activate = index => {
      if (index > furthest || items[index].classList.contains('current')) return;
      stop?.();
      go(targets[index]);
      refresh();
    };

    items.forEach((item, index) => {
      item.addEventListener('click', () => activate(index));
      item.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        activate(index);
      });
    });

    new MutationObserver(refresh).observe(progress, { subtree: true, attributes: true, attributeFilter: ['class'] });
    refresh();
    return {
      reset() {
        furthest = 0;
        refresh();
      }
    };
  }

  window.FirstMixProgressNavigation = { bind };
})();

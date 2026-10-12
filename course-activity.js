(() => {
  const removeCourseWordmark = () => {
    document.querySelectorAll('.topbar .logo, .topbar > .brand, .challenge-brand').forEach((wordmark) => {
      wordmark.classList.add('course-wordmark-space');
      wordmark.setAttribute('aria-hidden', 'true');
    });
  };
  document.documentElement.classList.add('course-playable');
  const mobileLayout = document.createElement('link');
  mobileLayout.rel = 'stylesheet';
  mobileLayout.href = '../mobile-layout-fixes.css?v=20261012-mobile-pages-4';
  document.head.append(mobileLayout);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeCourseWordmark, { once: true });
  } else {
    removeCourseWordmark();
  }

  const reuseLearningPage = () => {
    const back = document.querySelector('a[href*="index.html?view=learning"]');
    if (!back) return;
    back.addEventListener('click', (event) => {
      let sameOriginReferrer = false;
      try { sameOriginReferrer = Boolean(document.referrer) && new URL(document.referrer).origin === location.origin; } catch { /* use the link fallback */ }
      if (!sameOriginReferrer || history.length < 2) return;
      event.preventDefault();
      history.back();
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reuseLearningPage, { once: true });
  } else {
    reuseLearningPage();
  }

  const KEY = 'first-mix-activity-log-v1';
  const titles = {
    '00': '第一次交接',
    '01': '设置开始位置',
    '02': '听懂音乐结构',
    '03': '让两首歌对齐',
    '04': '在正确时间接入',
    '05': '让转场保持清晰',
    '06': '量出转场长度',
    '07': '练习两种转场'
  };

  function recordCompletion(number) {
    const courseNumber = String(number).padStart(2, '0');
    if (!titles[courseNumber]) return;
    let activity = [];
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (Array.isArray(saved)) activity = saved;
    } catch { /* Start a clean activity log if stored data is invalid. */ }
    activity.unshift({
      id: `course-${courseNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'learning',
      courseNumber,
      title: `完成课程：${titles[courseNumber]}`,
      detail: '',
      createdAt: Date.now()
    });
    localStorage.setItem(KEY, JSON.stringify(activity.slice(0, 500)));
  }

  window.FirstMixCourseActivity = { recordCompletion };

  const courseNumber = location.pathname.match(/course-(0[0-7])-playable/)?.[1];
  if (!courseNumber) return;
  const watchCompletion = () => {
    const sheet = document.querySelector('#success, #resultOverlay, #scoreOverlay');
    if (!sheet) return;
    const visible = () => !sheet.hidden && !sheet.classList.contains('hidden');
    let wasVisible = visible();
    let recordedThisAttempt = false;
    ['repeat', 'repeatCourse', 'resetTop', 'reset', 'resetAll', 'resetCourse', 'retryChallenge'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => { recordedThisAttempt = false; }, { capture: true });
    });
    new MutationObserver(() => {
      const isVisible = visible();
      if (isVisible && !wasVisible && !recordedThisAttempt) {
        recordCompletion(courseNumber);
        recordedThisAttempt = true;
      }
      wasVisible = isVisible;
    }).observe(sheet, { attributes: true, attributeFilter: ['hidden', 'class'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchCompletion, { once: true });
  else watchCompletion();
})();

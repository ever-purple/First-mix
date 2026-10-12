function enableTopSwipeDismiss(sheet, onDismiss, { maxStartY = 140, canStart = () => true } = {}) {
  if (!sheet) return;
  let startY = null;
  let distance = 0;
  sheet.classList.add("top-swipe-sheet");
  sheet.addEventListener("touchstart", event => {
    const touch = event.touches[0];
    if (!touch || event.touches.length !== 1 || window.innerWidth > 700 || !canStart() || sheet.scrollTop > 0) return;
    if (touch.clientY - sheet.getBoundingClientRect().top > maxStartY) return;
    startY = touch.clientY;
    distance = 0;
  }, { passive: true });
  sheet.addEventListener("touchmove", event => {
    if (startY === null || !event.touches[0] || sheet.scrollTop > 0) return;
    distance = Math.max(0, event.touches[0].clientY - startY);
    if (distance < 8) {
      sheet.classList.remove("is-sheet-dragging");
      sheet.style.translate = "";
      return;
    }
    if (event.cancelable) event.preventDefault();
    sheet.classList.add("is-sheet-dragging");
    sheet.style.translate = `0 ${Math.min(180, distance * .72)}px`;
  }, { passive: false });
  const finish = (cancelled = false) => {
    const dismiss = !cancelled && distance > 95;
    startY = null;
    distance = 0;
    sheet.classList.remove("is-sheet-dragging");
    sheet.style.translate = "";
    if (dismiss) onDismiss();
  };
  sheet.addEventListener("touchend", () => finish(), { passive: true });
  sheet.addEventListener("touchcancel", () => finish(true), { passive: true });
}

window.enableTopSwipeDismiss = enableTopSwipeDismiss;

function bindCourseResultSheets() {
  const results = [
    [document.querySelector("#success .success-sheet"), document.querySelector("#success")],
    [document.querySelector("#resultOverlay .success-sheet"), document.querySelector("#resultOverlay")]
  ];
  for (const [sheet, overlay] of results) {
    if (!sheet || !overlay) continue;
    let reopen;
    const showResult = () => {
      overlay.hidden = false;
      overlay.classList.remove("hidden");
      if (reopen) reopen.hidden = true;
    };
    enableTopSwipeDismiss(sheet, () => {
      overlay.hidden = true;
      overlay.classList.add("hidden");
      if (!reopen) {
        reopen = document.createElement("button");
        reopen.type = "button";
        reopen.className = "sheet-swipe-reopen";
        reopen.textContent = "查看完成结果";
        reopen.addEventListener("click", showResult);
        document.body.append(reopen);
      }
      reopen.hidden = false;
    });
    new MutationObserver(() => {
      if (reopen && !overlay.hidden && !overlay.classList.contains("hidden")) reopen.hidden = true;
    }).observe(overlay, { attributes: true, attributeFilter: ["hidden", "class"] });
    document.querySelectorAll("#resetTop, #reset, #resetCourse").forEach(button => {
      button.addEventListener("click", () => { if (reopen) reopen.hidden = true; });
    });
  }
  const scoreSheet = document.querySelector("#scoreOverlay .score-panel");
  const closeScore = document.querySelector("#closeScore");
  if (scoreSheet && closeScore) enableTopSwipeDismiss(scoreSheet, () => closeScore.click());
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindCourseResultSheets, { once: true });
else bindCourseResultSheets();

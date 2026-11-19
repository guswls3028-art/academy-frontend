/* Public Dawon demo. This script also runs on the separate learner shell. */
(() => {
  const loaded = document.currentScript?.dataset.release;
  if (!loaded || location.hostname !== "demo.hakwonplus.com") return;
  let target = "";
  let checking = false;
  let lastCheck = 0;
  const edited = new Set();
  document.addEventListener("input", (event) => {
    const field = event.target;
    if (!(field instanceof HTMLElement) || field.matches('[type="search"],[role="searchbox"]')) return;
    if (field.matches('select,input[type="checkbox"],input[type="radio"]') && !field.closest('form,[role="dialog"],dialog')) return;
    edited.add(field);
  }, true);
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "school-grades") return;
    const feedback = document.getElementById("grade-feedback");
    if (!feedback || feedback.hidden || !feedback.textContent.endsWith("학교 성적을 저장했어요.")) return;
    for (const field of edited) if (form.contains(field)) edited.delete(field);
  });
  function refreshWhenIdle() {
    if (!target || document.hidden) return;
    for (const field of edited) {
      if (!field.isConnected || !field.getClientRects().length) edited.delete(field);
    }
    if (edited.size || document.querySelector('[role="dialog"],[role="alertdialog"],dialog[open],input[type="file"]:focus') ||
        Array.from(document.querySelectorAll("audio,video")).some((media) => !media.paused && !media.ended)) return;
    try {
      const key = "dawon:refresh-attempt";
      if (sessionStorage.getItem(key) === target) return;
      sessionStorage.setItem(key, target);
    } catch { return; }
    location.reload();
  }
  async function check() {
    if (target) { refreshWhenIdle(); return; }
    if (checking || document.hidden || Date.now() - lastCheck < 15000) return;
    checking = true;
    lastCheck = Date.now();
    try {
      const response = await fetch("/version.json", { cache:"no-store" });
      if (response.ok) {
        const {teacherVersion} = await response.json();
        if (typeof teacherVersion === "string" && teacherVersion !== loaded) target = teacherVersion;
      }
      refreshWhenIdle();
    } catch { /* A later visit or visibility change will retry. */ }
    finally { checking = false; }
  }
  window.addEventListener("pageshow", check);
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", check);
  window.setInterval(check, 30000);
})();

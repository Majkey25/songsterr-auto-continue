(() => {
  "use strict";

  // The page requires trusted input. Retry only until the prompt disappears or the budget expires.
  const retryMs = 50;
  const budgetMs = 12000;

  let attempt = null;
  let pending = 0;
  let active = false;
  let failed = false;
  let point = null;

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== "arm" || sender.id !== chrome.runtime.id) return false;
    const target = active && findContinueTarget();
    const valid = target && Number.isFinite(message.x) && Number.isFinite(message.y) &&
      target.contains(document.elementFromPoint(message.x, message.y));
    if (valid) point = { x: message.x, y: message.y };
    respond(Boolean(valid));
    return false;
  });

  // Block stale-coordinate input if the dialog moves or is replaced during the request.
  for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "click"]) {
    window.addEventListener(type, (event) => {
      if (!active || !point || Math.abs(event.clientX - point.x) > 1 || Math.abs(event.clientY - point.y) > 1) return;
      const target = findContinueTarget();
      if (!target || !target.contains(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (type === "click") event.preventDefault();
    }, true);
  }

  function schedule(delay) {
    clearTimeout(pending);
    pending = setTimeout(run, delay);
  }

  async function run() {
    pending = 0;
    if (active || failed) return;
    const target = findContinueTarget();
    if (!target) {
      // Nothing to do, and the next prompt starts from a clean slate.
      attempt = null;
      return;
    }
    if (!attempt || attempt.target !== target) attempt = { target, until: Date.now() + budgetMs, last: 0 };
    if (Date.now() > attempt.until) return;

    // One activation per target per retry interval, however noisy the page is.
    const wait = attempt.last + retryMs - Date.now();
    if (wait > 0) {
      schedule(wait);
      return;
    }
    attempt.last = Date.now();
    active = true;
    try {
      const response = await chrome.runtime.sendMessage("continue");
      if (response?.error) throw new Error(response.error);
    } catch (error) {
      failed = true;
      console.warn("Songsterr Auto Continue:", error.message);
      return;
    } finally {
      active = false;
      point = null;
    }
    schedule(retryMs);
  }

  new MutationObserver(() => schedule(0)).observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden", "aria-disabled", "disabled", "href"],
  });

  schedule(0);
})();

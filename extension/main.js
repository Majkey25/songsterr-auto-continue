(() => {
  "use strict";

  const requestEvent = "songsterr-auto-continue:request";
  const dialogSelector = 'dialog, [role="dialog"], [aria-modal="true"]';
  const controlSelector = 'a, button, [role="button"]';
  const active = new WeakSet();
  const handled = new WeakSet();
  const normalize = (text) => text.replace(/\s+/gu, " ").trim().toLowerCase();

  function visible(element) {
    return !element.closest('[hidden], [inert], [aria-hidden="true"], [aria-disabled="true"]') &&
      !element.matches(":disabled") && element.checkVisibility({ visibilityProperty: true });
  }

  function matchTarget(target) {
    if (!(target instanceof HTMLElement) || !target.isConnected || handled.has(target)) return null;
    const dialog = target.closest(dialogSelector);
    if (!dialog || dialog === document.body || dialog === document.documentElement) return null;

    const controls = [...dialog.querySelectorAll(controlSelector)].filter(
      (element) => element instanceof HTMLElement && element.closest(dialogSelector) === dialog,
    );
    if (!controls.includes(target) || normalize(target.innerText) !== "continue with sync pauses") return null;
    if (target.matches("a[href]") && !["", "#"].includes(target.getAttribute("href"))) return null;
    if (target.matches("button") && target.type !== "button") return null;

    const synth = controls.find((element) => normalize(element.innerText) === "use synth");
    const upgrade = controls.find((element) => normalize(element.innerText) === "upgrade");
    const heading = [...dialog.querySelectorAll("p, h1, h2, h3, [role='heading']")].find(
      (element) => element.closest(dialogSelector) === dialog &&
        normalize(element.innerText) === "upgrade to plus for original audio without sync pauses",
    );

    if (!synth || !upgrade || !heading) return null;
    if (![dialog, target, synth, upgrade, heading].every(visible)) return null;
    return dialog;
  }

  function probe(target, dialog) {
    let observed = null;
    let reachedWindowBubble = false;
    let preventedBeforeBridge = false;

    const capture = (event) => {
      if (event.target === target) observed = event;
    };
    const guard = (event) => {
      if (event.target !== target) return;
      reachedWindowBubble = true;
      preventedBeforeBridge = event.defaultPrevented;
      if (target.matches("a[href]") && !event.defaultPrevented) event.preventDefault();
    };

    window.addEventListener("click", capture, { capture: true, once: true });
    window.addEventListener("click", guard, { once: true });
    target.click();
    window.removeEventListener("click", capture, true);
    window.removeEventListener("click", guard);

    if (!target.isConnected || !dialog.isConnected) return true;
    if (preventedBeforeBridge) return true;
    if (observed && !reachedWindowBubble && (observed.defaultPrevented || observed.cancelBubble)) return true;
    return false;
  }

  function attempt(target) {
    const dialog = matchTarget(target);
    if (!dialog) {
      active.delete(target);
      return;
    }

    if (probe(target, dialog)) {
      handled.add(target);
      active.delete(target);
      return;
    }

    requestAnimationFrame(() => attempt(target));
  }

  document.addEventListener(requestEvent, (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || active.has(target) || handled.has(target)) return;
    if (!matchTarget(target)) return;

    active.add(target);
    attempt(target);
  }, true);
})();

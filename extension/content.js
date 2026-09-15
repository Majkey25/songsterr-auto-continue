(() => {
  "use strict";

  const dialogSelector = 'dialog, [role="dialog"], [aria-modal="true"]';
  const controls = 'a, button, [role="button"]';
  const handled = new WeakSet();
  const pending = new WeakSet();
  const retryTimers = new WeakMap();
  const normalize = (text) => text.replace(/\s+/gu, " ").trim().toLowerCase();

  function visible(element) {
    return !element.closest('[hidden], [inert], [aria-hidden="true"], [aria-disabled="true"]') &&
      !element.matches(":disabled") && element.checkVisibility({ visibilityProperty: true });
  }

  function candidate(dialog) {
    if (!dialog.isConnected || dialog === document.body || dialog === document.documentElement) return null;
    const buttons = [...dialog.querySelectorAll(controls)].filter(
      (element) => element instanceof HTMLElement && element.closest(dialogSelector) === dialog,
    );
    const target = buttons.find((element) => normalize(element.innerText) === "continue with sync pauses");
    if (!target || handled.has(target)) return null;
    if (target.matches("a[href]") && !["", "#"].includes(target.getAttribute("href"))) return null;
    if (target.matches("button") && target.type !== "button") return null;
    const synth = buttons.find((element) => normalize(element.innerText) === "use synth");
    const upgrade = buttons.find((element) => normalize(element.innerText) === "upgrade");
    if (!synth || !upgrade) return null;
    const heading = [...dialog.querySelectorAll("p, h1, h2, h3, [role='heading']")].find(
      (element) => element.closest(dialogSelector) === dialog &&
        normalize(element.innerText) === "upgrade to plus for original audio without sync pauses",
    );
    if (!heading) return null;
    return { target, synth, upgrade, heading };
  }

  function scheduleRetry(dialog, delay = 80) {
    if (!dialog.isConnected || retryTimers.has(dialog)) return;
    const timer = setTimeout(() => {
      retryTimers.delete(dialog);
      continueDialog(dialog);
    }, delay);
    retryTimers.set(dialog, timer);
  }

  function continueDialog(dialog, ready = false) {
    const match = candidate(dialog);
    if (!match) return;
    const { target, synth, upgrade, heading } = match;
    if (pending.has(target)) return;
    if (![target, synth, upgrade, heading].every(visible)) {
      scheduleRetry(dialog);
      return;
    }
    const entering = () => [...dialog.classList].some((name) => name.endsWith("_enter"));
    if (entering()) {
      scheduleRetry(dialog, 50);
      return;
    }
    if (!ready) {
      pending.add(target);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        Promise.allSettled(dialog.getAnimations().map((animation) => animation.finished)).then(() => {
          setTimeout(() => {
            pending.delete(target);
            continueDialog(dialog, true);
          }, 350);
        });
      }));
      return;
    }
    const rechecked = candidate(dialog);
    if (!rechecked || rechecked.target !== target || ![target, synth, upgrade, heading].every(visible)) {
      scheduleRetry(dialog);
      return;
    }

    pending.add(target);
    const preventAnchorNavigation = (event) => event.preventDefault();
    if (target.matches("a[href]")) {
      target.addEventListener("click", preventAnchorNavigation, { capture: true, once: true });
    }
    target.click();
    setTimeout(() => {
      pending.delete(target);
      if (!dialog.isConnected) {
        handled.add(target);
        return;
      }
      continueDialog(dialog, true);
    }, 150);
  }

  function collect(node, dialogs) {
    const element = node instanceof Element ? node : node.parentElement;
    if (!element?.isConnected) return;
    const parent = element.closest(dialogSelector);
    if (parent) dialogs.add(parent);
    for (const dialog of element.querySelectorAll(dialogSelector)) dialogs.add(dialog);
  }

  new MutationObserver((mutations) => {
    const dialogs = new Set();
    for (const mutation of mutations) {
      const element = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      const parent = element?.closest(dialogSelector);
      if (parent) dialogs.add(parent);
      for (const node of mutation.addedNodes) collect(node, dialogs);
    }
    for (const dialog of dialogs) continueDialog(dialog);
  }).observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden", "aria-disabled", "disabled"],
  });

  for (const dialog of document.querySelectorAll(dialogSelector)) continueDialog(dialog);
})();

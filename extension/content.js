(() => {
  "use strict";

  const dialogSelector = 'dialog, [role="dialog"], [aria-modal="true"]';
  const controls = 'a, button, [role="button"]';
  const handled = new WeakSet();
  const pending = new WeakSet();
  const normalize = (text) => text.replace(/\s+/gu, " ").trim().toLowerCase();

  function visible(element) {
    return !element.closest('[hidden], [inert], [aria-hidden="true"], [aria-disabled="true"]') &&
      !element.matches(":disabled") && element.checkVisibility({ visibilityProperty: true });
  }

  function continueDialog(dialog, ready = false) {
    if (!dialog.isConnected || dialog === document.body || dialog === document.documentElement) return;
    const buttons = [...dialog.querySelectorAll(controls)].filter(
      (element) => element instanceof HTMLElement && element.closest(dialogSelector) === dialog && visible(element),
    );
    const target = buttons.find((element) =>
      normalize(element.innerText) === "continue with sync pauses",
    );
    if (!target || handled.has(target) || pending.has(target)) return;
    // A continuation must not navigate to another page or submit a form.
    if (target.matches("a[href]") && !["", "#"].includes(target.getAttribute("href"))) return;
    if (target.matches("button") && target.type !== "button") return;
    if (!buttons.some((element) => normalize(element.innerText) === "use synth") ||
        !buttons.some((element) => normalize(element.innerText) === "upgrade")) return;
    const heading = [...dialog.querySelectorAll("p, h1, h2, h3, [role='heading']")].some(
      (element) => element.closest(dialogSelector) === dialog && visible(element) &&
        normalize(element.innerText) === "upgrade to plus for original audio without sync pauses",
    );
    if (!heading) return;
    // Late animation frames can leave _enterActive on an already settled dialog.
    const entering = () => [...dialog.classList].some((name) => name.endsWith("_enter"));
    if (entering()) {
      pending.add(target);
      const mounted = new MutationObserver(() => {
        if (entering()) return;
        clearTimeout(timeout);
        mounted.disconnect();
        pending.delete(target);
        continueDialog(dialog);
      });
      mounted.observe(dialog, { attributes: true, attributeFilter: ["class"] });
      const timeout = setTimeout(() => {
        mounted.disconnect();
        pending.delete(target);
      }, 1000);
      return;
    }
    // Closing during Songsterr's entry transition can leave an orphaned dialog.
    if (!ready) {
      pending.add(target);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        Promise.allSettled(dialog.getAnimations().map((animation) => animation.finished)).then(() => {
          pending.delete(target);
          continueDialog(dialog, true);
        });
      }));
      return;
    }
    handled.add(target);
    target.click();
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
  }).observe(document, { childList: true, subtree: true, characterData: true });

  for (const dialog of document.querySelectorAll(dialogSelector)) continueDialog(dialog);
})();

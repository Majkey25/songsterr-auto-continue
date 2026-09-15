(() => {
  "use strict";

  const dialogSelector = 'dialog, [role="dialog"], [aria-modal="true"]';
  const controlSelector = 'a, button, [role="button"]';
  const handled = new WeakSet();
  const normalize = (text) => text.replace(/\s+/gu, " ").trim().toLowerCase();

  function visible(element) {
    return !element.closest('[hidden], [inert], [aria-hidden="true"], [aria-disabled="true"]') &&
      !element.matches(":disabled") && element.checkVisibility({ visibilityProperty: true });
  }

  function matchDialog(dialog) {
    if (!dialog.isConnected || dialog === document.body || dialog === document.documentElement) return null;

    const controls = [...dialog.querySelectorAll(controlSelector)].filter(
      (element) => element instanceof HTMLElement && element.closest(dialogSelector) === dialog,
    );
    const target = controls.find((element) => normalize(element.innerText) === "continue with sync pauses");
    if (!target || handled.has(target)) return null;
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
    return target;
  }

  function dismiss(dialog) {
    const target = matchDialog(dialog);
    if (!target) return;

    handled.add(target);
    if (target.matches("a[href]")) {
      target.addEventListener("click", (event) => event.preventDefault(), { capture: true, once: true });
    }
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
      collect(mutation.target, dialogs);
      for (const node of mutation.addedNodes) collect(node, dialogs);
    }
    for (const dialog of dialogs) dismiss(dialog);
  }).observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden", "aria-disabled", "disabled"],
  });

  for (const dialog of document.querySelectorAll(dialogSelector)) dismiss(dialog);
})();

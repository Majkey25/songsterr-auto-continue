(() => {
  "use strict";

  const requestEvent = "songsterr-auto-continue:request";
  const dialogSelector = 'dialog, [role="dialog"], [aria-modal="true"]';
  const controlSelector = 'a, button, [role="button"]';
  const queued = new Set();
  const channel = new MessageChannel();
  let flushScheduled = false;
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
    if (!target) return null;
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

  function signal(dialog) {
    const target = matchDialog(dialog);
    if (!target) return;
    target.dispatchEvent(new Event(requestEvent, { bubbles: true, composed: true }));
  }

  function schedule(dialog) {
    if (!dialog.isConnected) return;
    queued.add(dialog);
    if (flushScheduled) return;
    flushScheduled = true;
    channel.port2.postMessage(null);
  }

  channel.port1.onmessage = () => {
    flushScheduled = false;
    const dialogs = [...queued];
    queued.clear();
    for (const dialog of dialogs) signal(dialog);
  };

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
    for (const dialog of dialogs) schedule(dialog);
  }).observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden", "aria-disabled", "disabled"],
  });

  for (const dialog of document.querySelectorAll(dialogSelector)) schedule(dialog);
})();

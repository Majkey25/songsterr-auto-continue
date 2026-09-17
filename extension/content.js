(() => {
  "use strict";

  const currentTargetSelector = ".w_eHuW_continueLink a";
  const legacyDialogSelector = 'dialog, [role="dialog"], [aria-modal="true"]';
  const controlSelector = 'a, button, [role="button"]';
  const active = new WeakSet();
  const handled = new WeakSet();
  const channel = new MessageChannel();
  let scanScheduled = false;
  const normalize = (text) => text.replace(/\s+/gu, " ").trim().toLowerCase();

  function visible(element) {
    return element.isConnected &&
      !element.closest('[hidden], [inert], [aria-hidden="true"], [aria-disabled="true"]') &&
      !element.matches(":disabled") &&
      element.checkVisibility({ visibilityProperty: true });
  }

  function safeTarget(target) {
    if (!(target instanceof HTMLElement) || !visible(target)) return false;
    if (normalize(target.innerText) !== "continue with sync pauses") return false;
    if (target.matches("a[href]") && !["", "#"].includes(target.getAttribute("href"))) return false;
    if (target.matches("button") && target.type !== "button") return false;
    return target.matches(controlSelector);
  }

  function isCurrentTarget(target) {
    return safeTarget(target) && Boolean(target.closest(".w_eHuW_continueLink"));
  }

  function legacyTarget(dialog) {
    if (!dialog?.isConnected || dialog === document.body || dialog === document.documentElement || !visible(dialog)) return null;

    const controls = [...dialog.querySelectorAll(controlSelector)].filter(
      (element) => element instanceof HTMLElement && element.closest(legacyDialogSelector) === dialog,
    );
    const target = controls.find((element) => safeTarget(element));
    if (!target) return null;

    const synth = controls.find((element) => normalize(element.innerText) === "use synth");
    const upgrade = controls.find((element) => normalize(element.innerText) === "upgrade");
    const heading = [...dialog.querySelectorAll("p, h1, h2, h3, [role='heading']")].find(
      (element) => element.closest(legacyDialogSelector) === dialog &&
        normalize(element.innerText) === "upgrade to plus for original audio without sync pauses",
    );

    if (!synth || !upgrade || !heading) return null;
    if (![synth, upgrade, heading].every(visible)) return null;
    return target;
  }

  function stillMatches(target) {
    if (isCurrentTarget(target)) return true;
    const dialog = target.closest(legacyDialogSelector);
    return Boolean(dialog && legacyTarget(dialog) === target);
  }

  function findTarget() {
    for (const target of document.querySelectorAll(currentTargetSelector)) {
      if (isCurrentTarget(target) && !handled.has(target)) return target;
    }
    for (const dialog of document.querySelectorAll(legacyDialogSelector)) {
      const target = legacyTarget(dialog);
      if (target && !handled.has(target)) return target;
    }
    return null;
  }

  function probe(target) {
    let observed = null;
    let reachedWindowBubble = false;
    let preventedBeforeGuard = false;

    const capture = (event) => {
      if (event.target === target) observed = event;
    };
    const guard = (event) => {
      if (event.target !== target) return;
      reachedWindowBubble = true;
      preventedBeforeGuard = event.defaultPrevented;
      if (target.matches("a[href]") && !event.defaultPrevented) event.preventDefault();
    };

    window.addEventListener("click", capture, { capture: true, once: true });
    window.addEventListener("click", guard, { once: true });
    target.click();
    window.removeEventListener("click", capture, true);
    window.removeEventListener("click", guard);

    if (!target.isConnected) return true;
    if (preventedBeforeGuard) return true;
    if (observed && !reachedWindowBubble && (observed.defaultPrevented || observed.cancelBubble)) return true;
    return false;
  }

  function attempt(target, remainingFrames = 30) {
    if (!target.isConnected || !stillMatches(target)) {
      active.delete(target);
      return;
    }

    if (probe(target)) {
      handled.add(target);
      active.delete(target);
      return;
    }

    if (remainingFrames <= 0) {
      active.delete(target);
      return;
    }
    requestAnimationFrame(() => attempt(target, remainingFrames - 1));
  }

  function scan() {
    const target = findTarget();
    if (!target || active.has(target) || handled.has(target)) return;
    active.add(target);
    attempt(target);
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    channel.port2.postMessage(null);
  }

  channel.port1.onmessage = () => {
    scanScheduled = false;
    scan();
  };

  new MutationObserver(scheduleScan).observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden", "aria-disabled", "disabled", "href"],
  });

  scheduleScan();
})();

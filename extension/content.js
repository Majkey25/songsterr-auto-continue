(() => {
  "use strict";

  const dialogSelector = 'dialog, [role="dialog"], [aria-modal="true"]';
  const controlSelector = 'a, button, [role="button"]';
  const continueText = "continue with sync pauses";
  const synthText = "use synth";
  const upgradeSelector = 'a[href="/plus"]';

  // Songsterr's own click handler is not effective the instant the prompt is inserted.
  // Clicks that land too early are cancelled by the page and change nothing, so activation
  // is verified by outcome - the prompt must actually disappear - and retried until it does.
  const retryMs = 200;
  const maxAttempts = 60;

  let attempt = null;
  let pending = 0;

  const normalize = (text) => text.replace(/\s+/gu, " ").trim().toLowerCase();

  function visible(element) {
    return element.isConnected &&
      !element.closest('[hidden], [inert], [aria-hidden="true"], [aria-disabled="true"]') &&
      !element.matches(":disabled") &&
      element.checkVisibility({ visibilityProperty: true });
  }

  function continueAction(element) {
    if (!(element instanceof HTMLElement) || !element.matches(controlSelector)) return false;
    if (normalize(element.innerText) !== continueText) return false;
    // Never follow a link that would navigate away, never submit a form.
    if (element.matches("a[href]") && !["", "#"].includes(element.getAttribute("href"))) return false;
    if (element.matches("button") && element.type !== "button") return false;
    return visible(element);
  }

  // Corroborates that this dialog really is the Original Audio interruption. Both markers
  // have been present in every observed Songsterr build; the headline sentence and the
  // generated class names have not, so neither is used for identification.
  function interruption(dialog) {
    if (!visible(dialog)) return false;
    if ([...dialog.querySelectorAll(upgradeSelector)].some(visible)) return true;
    return [...dialog.querySelectorAll(controlSelector)].some((element) =>
      element.closest(dialogSelector) === dialog &&
      normalize(element.innerText) === synthText &&
      visible(element));
  }

  function findTarget() {
    for (const dialog of document.querySelectorAll(dialogSelector)) {
      if (!interruption(dialog)) continue;
      const target = [...dialog.querySelectorAll(controlSelector)]
        .find((element) => element.closest(dialogSelector) === dialog && continueAction(element));
      if (target) return target;
    }
    return null;
  }

  // The target is always an empty-href link or a plain button, so cancelling the browser's
  // default action can only suppress a reload. Propagation is untouched, so Songsterr's own
  // handler still runs exactly as it would for a real click.
  function activate(target) {
    const cancelNavigation = (event) => {
      if (event.target === target) event.preventDefault();
    };
    window.addEventListener("click", cancelNavigation, true);
    try {
      target.click();
    } finally {
      window.removeEventListener("click", cancelNavigation, true);
    }
  }

  function schedule(delay) {
    clearTimeout(pending);
    pending = setTimeout(run, delay);
  }

  function run() {
    pending = 0;
    const target = findTarget();
    if (!target) {
      // Nothing to do, and the next prompt starts from a clean slate.
      attempt = null;
      return;
    }
    if (!attempt || attempt.target !== target) attempt = { target, count: 0, last: 0 };
    if (attempt.count >= maxAttempts) return;

    // One activation per target per retry interval, however noisy the page is.
    const wait = attempt.last + retryMs - Date.now();
    if (wait > 0) {
      schedule(wait);
      return;
    }
    attempt.count += 1;
    attempt.last = Date.now();
    activate(target);
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

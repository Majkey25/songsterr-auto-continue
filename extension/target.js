"use strict";

// Shared by the content script and the debugger's isolated world.
function findContinueTarget() {
  if (location.origin !== "https://www.songsterr.com" || window.top !== window) return null;
  const dialogSelector = 'dialog, [role="dialog"], [aria-modal="true"]';
  const controlSelector = 'a, button, [role="button"]';
  const normalize = (text) => text.replace(/\s+/gu, " ").trim().toLowerCase();
  const visible = (element) => element.isConnected &&
    !element.closest('[hidden], [inert], [aria-hidden="true"], [aria-disabled="true"]') &&
    !element.matches(":disabled") &&
    element.checkVisibility({ opacityProperty: true, visibilityProperty: true });

  for (const dialog of document.querySelectorAll(dialogSelector)) {
    if (!visible(dialog)) continue;
    const controls = [...dialog.querySelectorAll(controlSelector)].filter((element) =>
      element instanceof HTMLElement && element.closest(dialogSelector) === dialog && visible(element));
    if (!controls.some((element) => element.matches('a[href="/plus"]') ||
      normalize(element.innerText) === "use synth")) continue;
    const target = controls.find((element) => {
      if (normalize(element.innerText) !== "continue with sync pauses") return false;
      // Never follow a link that would navigate away, never submit a form.
      if (element.matches("a[href]") && !["", "#"].includes(element.getAttribute("href"))) return false;
      return !element.matches("button") || element.type === "button";
    });
    if (target) return target;
  }
  return null;
}

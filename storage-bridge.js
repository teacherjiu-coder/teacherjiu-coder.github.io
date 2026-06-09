/** Capacitor Preferences 미러 (네이티브 앱에서 localStorage 보존 강화) */
const STORAGE_MIRROR_PREFIXES = ["comhwal_", "isPro"];

function shouldMirrorStorageKey(key) {
  if (key === "isPro") return true;
  return STORAGE_MIRROR_PREFIXES.some((p) => key.startsWith(p));
}

function mirrorStorageKey(key, value) {
  if (!shouldMirrorStorageKey(key)) return;
  if (window.ComhwalNative?.mirrorKey) {
    window.ComhwalNative.mirrorKey(key, value);
  }
}

function mirrorStorageRemove(key) {
  if (!shouldMirrorStorageKey(key)) return;
  if (window.ComhwalNative?.removeKey) {
    window.ComhwalNative.removeKey(key);
  }
}

(function patchLocalStorageMirror() {
  const origSet = Storage.prototype.setItem;
  const origRemove = Storage.prototype.removeItem;

  Storage.prototype.setItem = function (key, value) {
    origSet.call(this, key, value);
    mirrorStorageKey(key, value);
  };

  Storage.prototype.removeItem = function (key) {
    origRemove.call(this, key);
    mirrorStorageRemove(key);
  };
})();

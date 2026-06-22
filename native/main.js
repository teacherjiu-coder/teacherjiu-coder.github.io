import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications } from "@capacitor/local-notifications";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

const NOTIF = {
  dailyId: 1001,
  wrongId: 1002,
  dailyEnabled: "comhwal_notif_daily_enabled",
  wrongEnabled: "comhwal_notif_wrong_enabled",
  dailyHour: "comhwal_notif_daily_hour",
  dailyMinute: "comhwal_notif_daily_minute",
  wrongHour: "comhwal_notif_wrong_hour",
  wrongMinute: "comhwal_notif_wrong_minute",
  permissionAsked: "comhwal_notif_permission_asked",
};

const readyPromise = (async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Light });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#f4f6f9" });
    }
  } catch (_) {
    /* optional */
  }

  try {
    await SplashScreen.hide();
  } catch (_) {
    /* optional */
  }

  await hydratePreferences();
  registerBackButton();
  await maybeRequestNotificationPermission();
})();

async function hydratePreferences() {
  const { keys } = await Preferences.keys();
  for (const key of keys) {
    if (!shouldMirrorKey(key)) continue;
    const { value } = await Preferences.get({ key });
    if (value != null && localStorage.getItem(key) == null) {
      localStorage.setItem(key, value);
    }
  }
}

function shouldMirrorKey(key) {
  if (key === "isPro") return true;
  return key.startsWith("comhwal_");
}

async function mirrorKey(key, value) {
  if (!shouldMirrorKey(key)) return;
  await Preferences.set({ key, value: String(value) });
}

async function removeKey(key) {
  if (!shouldMirrorKey(key)) return;
  await Preferences.remove({ key });
}

async function openExternal(url) {
  if (!url) return;
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function registerBackButton() {
  App.addListener("backButton", () => {
    const handled = typeof window.handleAppBackButton === "function" && window.handleAppBackButton();
    if (!handled) {
      App.minimizeApp();
    }
  });
}

async function maybeRequestNotificationPermission() {
  if (localStorage.getItem(NOTIF.permissionAsked) === "1") return;
  localStorage.setItem(NOTIF.permissionAsked, "1");
  mirrorKey(NOTIF.permissionAsked, "1");
  try {
    await LocalNotifications.requestPermissions();
  } catch (_) {
    /* user denied */
  }
}

function readNotifTime(hourKey, minuteKey, defaultHour) {
  const hour = Number(localStorage.getItem(hourKey));
  const minute = Number(localStorage.getItem(minuteKey));
  return {
    hour: Number.isFinite(hour) ? hour : defaultHour,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

async function applyNotificationSchedule() {
  if (!Capacitor.isNativePlatform()) return;

  await LocalNotifications.cancel({ notifications: [{ id: NOTIF.dailyId }, { id: NOTIF.wrongId }] });

  const dailyOn = localStorage.getItem(NOTIF.dailyEnabled) === "1";
  const wrongOn = localStorage.getItem(NOTIF.wrongEnabled) === "1";

  if (!dailyOn && !wrongOn) return;

  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") return;

  const pending = [];

  if (dailyOn) {
    const { hour, minute } = readNotifTime(NOTIF.dailyHour, NOTIF.dailyMinute, 19);
    pending.push({
      id: NOTIF.dailyId,
      title: "지우쌤 컴활 필기",
      body: "오늘도 기출 한 세트 풀어볼까요? 매일 학습 리마인더",
      schedule: { on: { hour, minute }, repeats: true, every: "day" },
      sound: "default",
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#2563eb",
    });
  }

  if (wrongOn) {
    const { hour, minute } = readNotifTime(NOTIF.wrongHour, NOTIF.wrongMinute, 20);
    pending.push({
      id: NOTIF.wrongId,
      title: "지우쌤 컴활 필기",
      body: "오답노트에 쌓인 문제, 복습할 시간이에요",
      schedule: { on: { hour, minute }, repeats: true, every: "day" },
      sound: "default",
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#7c3aed",
    });
  }

  if (pending.length > 0) {
    await LocalNotifications.schedule({ notifications: pending });
  }
}

window.ComhwalNative = {
  ready: () => readyPromise,
  isNative: () => Capacitor.isNativePlatform(),
  openExternal,
  mirrorKey,
  removeKey,
  applyNotificationSchedule,
  requestNotificationPermission: async () => {
    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted";
  },
  NOTIF_KEYS: NOTIF,
};

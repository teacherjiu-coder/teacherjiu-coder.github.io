/** Pro 잠금 해제 (v1: 코드 입력 · v2: 스토어 결제 예정) */
const ACCESS_CODE = "JW1116";

const PRO_LS = {
  pro: "isPro",
  legacyUnlocked: "comhwal_pro_unlocked",
  legacyCoupon: "comhwal_coupon_ok",
};

function isPro() {
  if (localStorage.getItem(PRO_LS.pro) === "true") return true;

  if (localStorage.getItem(PRO_LS.legacyUnlocked) === "1") {
    unlockPro();
    localStorage.removeItem(PRO_LS.legacyUnlocked);
    return true;
  }
  if (localStorage.getItem(PRO_LS.legacyCoupon) === "1") {
    unlockPro();
    localStorage.removeItem(PRO_LS.legacyCoupon);
    return true;
  }

  // TODO v2: Apple IAP / Google Play Billing 구매 상태 확인 후 true 반환
  // if (await StorePurchases.hasActiveEntitlement('pro')) return true;

  return false;
}

function unlockPro() {
  localStorage.setItem(PRO_LS.pro, "true");
  if (typeof mirrorStorageKey === "function") {
    mirrorStorageKey(PRO_LS.pro, "true");
  }
}

function isRoundUnlocked(type, num) {
  if (type !== "sangsi" && type !== "jeonggi") return false;
  if (num === 1) return true;
  return isPro();
}

function validateAccessCode(value) {
  return value === ACCESS_CODE.toUpperCase();
}

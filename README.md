# 지우쌤 컴활 필기 기출 (`teacherjiu-app`)

컴활 필기 기출문제 풀이 웹앱 + Capacitor 네이티브(iOS/Android) 래퍼.

> 프로젝트 폴더: `/Users/jiwoo/Desktop/cursor/teacherjiu-app` (구 `컴활앱`)

- **웹 배포**: 프로젝트 루트(`index.html`, `app.js` 등) → GitHub Pages
- **앱 배포**: `www/` 번들(오프라인) → Play Store / App Store  
- **원격 URL 로딩 없음** (`server.url` 미사용)

## 요구 사항

- Node.js 20+
- Android Studio (Android SDK)
- macOS + Xcode + CocoaPods (iOS) — [docs/IOS_SETUP.md](docs/IOS_SETUP.md)

## 설치

```bash
npm install
```

## 웹 수정 후 앱에 반영

```bash
# 1) 네이티브 JS 번들 + www 동기화 + Capacitor 복사
npm run cap:sync

# 2) IDE에서 실행
npm run cap:android   # Android Studio
npm run cap:ios       # Xcode
```

개별 단계:

```bash
npm run build:native   # native.bundle.js 생성
npm run sync:www       # 루트 → www/ 복사 (index는 native.bundle.js 참조)
npx cap sync
npx cap open android
npx cap open ios
```

## GitHub Pages만 업데이트할 때

루트 파일만 수정 후 push. `native.stub.js`가 브라우저용 브리지 역할을 합니다.  
(결제 홍보 카드는 앱·웹 공통으로 무료 채널 카드만 표시)

## 앱 ID

| 항목 | 값 |
|------|-----|
| `appId` | `com.teacherjiu.comhwal` |
| 표시 이름 | 지우쌤 컴활 필기 |

## Pro 잠금 / v2 결제

- `pro-access.js`: `isPro()`, `unlockPro()`, `validateAccessCode()`
- v2에서 Apple IAP / Google Play Billing 조건을 `isPro()`에만 추가 예정

## 스토어 제출 전

[docs/STORE_CHECKLIST.md](docs/STORE_CHECKLIST.md) 참고.

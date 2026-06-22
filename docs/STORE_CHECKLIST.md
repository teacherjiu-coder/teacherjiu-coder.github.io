# 스토어 제출 전 체크리스트

## 공통

- [ ] 앱 아이콘 1024×1024 PNG (투명 없음, iOS)
- [ ] Android adaptive icon (foreground + background)
- [ ] 스플래시 이미지 (`@capacitor/assets` 또는 `android/app/src/main/res`, iOS LaunchScreen)
- [ ] 스토어 스크린샷 (6.7", 6.5", 5.5" 등 플랫폼별 권장 해상도)
- [ ] 앱 설명·키워드·카테고리(교육)
- [ ] 개인정보처리방침 URL (웹 공개 페이지)
- [ ] 문의 이메일
- [ ] 앱 내 **결제·가격·구매 유도 없음** (1차 출시) — 채널 카드만 외부 링크
- [ ] `npm run cap:sync` 후 실기기에서 오프라인(비행기 모드)으로 기출 로드·풀이·오답노트·이어풀기 확인

## Android (Google Play)

- [ ] `android/app/build.gradle` `versionCode` / `versionName` 증가
- [ ] 업로드 키 서명 · Play App Signing
- [ ] Release **AAB** 빌드: Android Studio → Build → Generate Signed Bundle
- [ ] 알림 아이콘: `android/app/src/main/res/drawable-*`에 `ic_stat_icon_config_sample.png` (흰색 실루엣, 단색)  
      없으면 알림이 기본 아이콘으로 표시되거나 깨질 수 있음
- [ ] `AndroidManifest.xml` 권한: Local Notifications 플러그인이 추가한 `POST_NOTIFICATIONS`(API 33+) 확인
- [ ] 데이터 안전성 설문: `localStorage` / Preferences에 진도·오답 저장, 서버 전송 없음으로 기재

## iOS (App Store)

- [ ] Apple Developer Program ($99/년)
- [ ] Bundle ID = `com.teacherjiu.comhwal` (Developer 포털과 Xcode 일치)
- [ ] `ios/App/App/Info.plist`에 알림 설명 문구:
      - `NSUserNotificationsUsageDescription` — 예: "매일 학습과 오답 복습을 알려드립니다."
- [ ] Archive → Distribute App → App Store Connect
- [ ] App Privacy: 데이터 수집 최소·기기 내 저장 위주로 응답
- [ ] TestFlight 내부 테스트 후 심사 제출

## 권한·플러그인 (이 프로젝트)

| 기능 | 플러그인 | 사용자에게 보이는 이유 |
|------|----------|------------------------|
| 학습/오답 알림 | Local Notifications | 매일 학습·오답 복습 리마인더 |
| 외부 링크 | Browser | 유튜브·인스타·카페 (시스템 브라우저) |
| 데이터 보존 | Preferences | localStorage 미러 |
| 상태바/스플래시 | Status Bar, Splash Screen | 네이티브 UI 마감 |

## 버전 올릴 때

1. 웹·JSON·이미지 수정 (루트)
2. `npm run cap:sync`
3. `versionCode` / `versionName`(Android), `CFBundleShortVersionString`(iOS) 증가
4. AAB/IPA 업로드 → 스토어 심사

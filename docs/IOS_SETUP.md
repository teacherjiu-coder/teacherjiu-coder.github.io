# iOS 플랫폼 추가 (Mac)

이 환경에서 CocoaPods가 없으면 `npx cap add ios`가 실패합니다. Mac에서 아래 순서로 진행하세요.

```bash
# CocoaPods (최초 1회)
sudo gem install cocoapods
# 또는: brew install cocoapods

cd /path/to/teacherjiu-app
npm install
npm run cap:sync
npx cap add ios
npx cap sync ios
```

## Info.plist 알림 문구

`ios/App/App/Info.plist`의 `<dict>` 안에 추가:

```xml
<key>NSUserNotificationsUsageDescription</key>
<string>매일 학습과 오답 복습을 알려드리기 위해 알림을 사용합니다.</string>
```

## 실행

```bash
npx cap open ios
```

Xcode에서 Team·Signing 설정 후 실기기 또는 시뮬레이터 실행.

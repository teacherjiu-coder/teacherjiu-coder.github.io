# HANDOFF

## 1. 한 줄 요약
`teacherjiu-app`은 컴활 1급/2급 필기 기출문제를 웹과 Capacitor 네이티브 앱(Android/iOS)으로 동시에 제공하는 프로젝트다.

## 2. 핵심 폴더 / 파일 구조
- `index.html`: 웹앱 진입점.
- `app.js`: 문제 로딩, 라우팅, 오답노트, 시험 모드, 이미지/보기 렌더링 로직.
- `style.css`: 앱 전반 UI 스타일.
- `questions_*.json`: 각 회차 문제 데이터.
  - 예: `questions_2gi_3.json`, `questions_1gi_10.json`
- `img/`: 문제/보기/해설 이미지 파일.
- `www/`: Capacitor에 복사되는 웹 배포 산출물.
- `native/main.js`: 네이티브 전용 브리지 엔트리.
- `native.bundle.js`: `build:native` 결과물.
- `scripts/build-native.mjs`: `native/main.js` 번들 생성.
- `scripts/sync-www.mjs`: 루트의 HTML/JS/CSS/JSON/`img/`를 `www/`로 복사.
- `scripts/validate-questions-images.mjs`: JSON 참조와 실제 이미지 파일 검증 스크립트.
- `capacitor.config.ts`: Capacitor 설정 (`webDir = www`).
- `android/`: Android Studio 프로젝트.
- `ios/`: Xcode 프로젝트.
- `docs/IOS_SETUP.md`: iOS 준비 메모.
- `docs/STORE_CHECKLIST.md`: 스토어 배포 체크리스트.

## 3. 로컬 실행 방법
### 웹만 빠르게 확인
정적 서버로 열면 된다.

```bash
cd "/Users/jiwoo/Desktop/업무/7.cursor/teacherjiu-app"
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`

### 의존성 설치
```bash
cd "/Users/jiwoo/Desktop/업무/7.cursor/teacherjiu-app"
npm install
```

## 4. 빌드 & 배포
### 웹(GitHub Pages)
이 저장소는 루트 정적 파일이 GitHub Pages로 바로 배포된다.

```bash
cd "/Users/jiwoo/Desktop/업무/7.cursor/teacherjiu-app"
git add .
git commit -m "..."
git push origin main
```

### Capacitor Android/iOS 빌드 순서
기본 순서:

```bash
cd "/Users/jiwoo/Desktop/업무/7.cursor/teacherjiu-app"
npm install
npm run build:native
npm run sync:www
npx cap sync
```

프로젝트 열기:

```bash
npx cap open android
npx cap open ios
```

패키지 스크립트 기준으로는 아래를 주로 쓴다:

```bash
npm run cap:sync
npm run cap:android
npm run cap:ios
```

실무적으로는 다음 순서가 가장 안전하다.
1. 루트 소스 수정
2. `npm run cap:sync`
3. Android Studio/Xcode 열기
4. 각 IDE에서 Rebuild / Run / Archive 진행

## 5. 기출문제 JSON / 이미지 위치 + "문제 수정/이미지 교체 후 재배포" 단계
### 위치
- 문제 JSON: 프로젝트 루트의 `questions_*.json`
  - 예: `questions_2gi_3.json`
- 이미지 폴더: 프로젝트 루트의 `img/`
  - 예: `img/2gi3_q26_1.png`

### 문제 수정 / 이미지 교체 후 재배포 정확한 단계
1. JSON 수정
   - 해당 회차 `questions_*.json`에서 문항/정답/해설/이미지 경로 수정
2. 이미지 교체
   - 새 이미지를 `img/`에 같은 파일명으로 덮어쓰거나 새 파일명 추가
3. 참조 검증
   ```bash
   node scripts/validate-questions-images.mjs
   ```
4. 웹용 산출물 갱신
   ```bash
   npm run sync:www
   ```
5. Android/iOS 네이티브 자산 동기화
   ```bash
   npm run cap:copy
   ```
   또는 전체 sync:
   ```bash
   npm run cap:sync
   ```
6. 로컬 확인
   - 웹: 정적 서버로 확인
   - Android: Android Studio에서 Rebuild 후 실행
   - iOS: Xcode에서 Build/Run
7. 웹 배포
   ```bash
   git add .
   git commit -m "..."
   git push origin main
   ```
8. 앱 스토어용 빌드
   - Android Studio에서 AAB/APK
   - Xcode에서 Archive/Distribute

### 2급 정기 3회 관련 메모
- 파일 접두사는 `2gi3_`
- 현재 JSON 기준 사용 파일은 `2gi3*` 26개
- 미사용 파일은 남기지 않는 편이 관리가 쉽다

## 6. 현재 알려진 버그 / 미완성
- `pro-access.js`는 아직 v1 코드 입력 방식이다.
  - Apple IAP / Google Play Billing 연동은 TODO 상태
- 이미지 검증 스크립트 기준 현재 전체 프로젝트에 누락 이미지가 남아 있다.
  - `img/1gi1_q22.png`
  - `img/1gi1_q35.png`
  - `img/1gi1_q47.png`
  - `img/gi5_q03.png`
- 일부 문항 이미지 품질은 캡처본 해상도에 크게 의존한다.
  - 특히 작은 보기 이미지는 다시 캡처해 교체하는 방식이 가장 안정적
- 이 저장소는 현재 git 상태가 꽤 지저분하다.
  - Android/iOS/native/scripts/docs 등 다수 파일이 아직 추적 전 또는 수정 상태
  - 커밋 전 `git status`로 범위를 꼭 확인해야 한다
- 기존 `README.md`에 예전 경로(`/Users/jiwoo/Desktop/cursor/teacherjiu-app`)가 남아 있다.

## 7. Git 리모트 / 배포 위치
- Git remote: `https://github.com/teacherjiu-coder/teacherjiu-coder.github.io.git`
- 웹 배포 URL: `https://teacherjiu-coder.github.io/`
- Android 앱 ID: `com.teacherjiu.comhwal`
- iOS Bundle ID도 동일 계열로 관리 중 (`com.teacherjiu.comhwal`)

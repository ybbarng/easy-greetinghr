# Easy GreetingHR

그리팅HR 칸반 보드에서 내 평가 상태를 한눈에 확인할 수 있는 브라우저 스크립트

<img src="docs/screenshot.png" alt="스크린샷" width="300">

## 기능

- 칸반 카드에 내 평가 점수 배지 표시 (매우 부적합 ~ 매우 적합)
- 평가 완료 카드 흐리게 표시하여 미평가 카드와 시각적 구분
- 평가 완료 카드 숨기기/보이기 필터 토글 버튼
- 칸반 보드 갱신 시 자동으로 평가 상태 업데이트

## 사용법

### 방법 1: 북마클릿 (권장)

한 번 등록해두면 북마크 클릭만으로 실행할 수 있습니다.

1. 아래 코드를 복사한다:
   ```
   javascript:void(fetch('https://raw.githubusercontent.com/ybbarng/easy-greetinghr/main/bookmarklet.js').then(r=>r.text()).then(t=>eval(t)))
   ```
2. 브라우저 북마크바에서 우클릭 → **페이지 추가** (또는 북마크 추가)
3. 이름은 자유롭게, URL 란에 위 코드를 붙여넣고 저장
4. 그리팅HR 칸반 보드 페이지에서 해당 북마크를 클릭

### 방법 2: 콘솔에서 직접 실행

1. 그리팅HR 칸반 보드 페이지를 연다
2. 브라우저 개발자 도구를 연다 (`F12` 또는 `Cmd+Option+I`)
3. Console 탭에서 [`bookmarklet.js`](bookmarklet.js)의 내용을 붙여넣고 실행한다

> 페이지를 새로고침하면 스크립트가 초기화되므로 다시 실행해야 합니다.

## 문서

- [API 조사 결과](docs/api-research.md) — 그리팅HR API 구조 및 평가 데이터 판별 로직

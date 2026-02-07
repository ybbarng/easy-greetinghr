# Easy Greeting

그리팅HR 칸반 보드 사용성 개선 도구

## 배경

- 그리팅HR 서비스를 통해 채용 지원을 받고, 지원자 상태를 칸반 보드로 관리 중
- 여러 명의 평가자가 각 지원자에 대해 개별 평가를 남기고 있음
- **문제**: 칸반 보드에서 내가 어떤 지원자를 평가했는지 알 수 없음. 각 카드를 클릭하여 상세보기에 들어가야만 확인 가능

## 구현 목표

1. **평가 상태 표시**: 칸반 보드의 각 카드에 내가 평가를 완료했는지 여부 + 나의 점수 표시
2. **필터링 기능**: 내가 이미 평가한 지원자를 숨길 수 있는 필터 토글

## 구현 방식 (후보)

- 브라우저 콘솔에서 JS 코드 inject
- 크롬 확장프로그램

## 기술 검토 사항

아직 확인되지 않은 핵심 질문들:

### 1. 데이터 가용성
- [ ] 칸반 보드 페이지 로드 시 평가 데이터가 이미 포함되어 있는가? (DOM 또는 JS 변수에 숨겨져 있을 수 있음)
- [ ] 아니라면, 각 카드의 평가 정보를 가져오는 별도 API가 있는가?

### 2. API 구조
- [ ] 칸반 보드 로드 시 호출되는 API 엔드포인트 목록
- [ ] 카드 상세보기 진입 시 호출되는 API 엔드포인트 목록
- [ ] 평가 데이터가 포함된 API 응답 구조

### 3. 인증 방식
- [ ] API 호출 시 사용되는 인증 방식 (쿠키, Bearer 토큰 등)
- [ ] 크롬 확장프로그램에서 동일 세션의 인증 정보를 활용할 수 있는지

## API 조사 결과

Base URL: `https://api.greetinghr.com/app/ats/v3.0`

### 1. 칸반 단계 목록

- **Endpoint**: `GET /workspaces/{workspaceId}/openings/{openingId}/processes`
- **예시**: `GET /workspaces/1234/openings/56789/processes`
- **설명**: 칸반 보드의 각 단계(컬럼) 목록을 반환
- **응답 구조**:
  ```json
  {
    "success": true,
    "data": {
      "datas": [
        {
          "id": 100001,        // 단계 ID
          "name": "Applied",    // 단계 이름
          "procedure": 0,       // 단계 순서 (0부터 시작)
          "icon": "🗒️"         // 단계 아이콘
        }
      ]
    }
  }
  ```
- **확인된 단계**: Applied(0) → Document Review(1) → Assignment(2) → 1st Interview(3) → 2nd Interview(4) → Offer(5)

### 2. 칸반 카드 목록 (단계별)

- **Endpoint**: `GET /workspaces/{workspaceId}/openings/{openingId}/kanban`
- **API 버전**: v5.0 (단계 목록 API와 다름에 주의)
- **예시**: `GET /workspaces/1234/openings/56789/kanban?page=0&pageSize=25&processId=100002&sorts=SUBMIT_DATE_DESC,ID_ASC&status=SUBMIT`
- **설명**: 특정 단계(processId)의 지원자 카드 목록을 페이지네이션으로 반환
- **쿼리 파라미터**:
  | 파라미터 | 설명 | 예시 |
  |---------|------|------|
  | `page` | 페이지 번호 (0부터 시작) | `0` |
  | `pageSize` | 페이지당 항목 수 | `25` |
  | `processId` | 칸반 단계 ID (processes API에서 조회) | `100002` |
  | `sorts` | 정렬 기준 | `SUBMIT_DATE_DESC,ID_ASC` |
  | `status` | 지원 상태 | `SUBMIT` |
- **응답 구조**:
  ```json
  {
    "success": true,
    "data": {
      "page": 0,
      "pageSize": 25,
      "totalCount": 0,
      "datas": [],           // 지원자 카드 배열 (이 요청에서는 비어있음)
      "totalPage": 0,
      "hasPrev": false,
      "hasNext": false
    }
  }
  ```
- **참고**: 이 예시(processId=100002, Document Review 단계)는 지원자가 0명이라 datas가 빈 배열
- **카드 데이터 구조** (지원자가 있는 단계에서 확인):
  ```json
  {
    "applicantInfo": {
      "id": 1000001,              // 지원자 ID
      "name": "홍길동",
      "email": "...",
      "phone": "...",
      "submitDate": "2025-01-15T09:00:00Z",
      "refererName": "example.co.kr",  // 지원 경로
      "isLock": false,
      "status": "SUBMIT",
      "quickNote": null,
      "rejectDetail": null,
      "passDate": null,
      "expireDate": "2027-01-15T09:00:00Z"
    },
    "tagInfos": [],
    "processInfo": {
      "id": 100001,
      "name": "Applied",
      "icon": "🗒️"
    },
    "avgScoreInfo": null,
    "evaluationInfo": {
      "evaluationId": 2000001,    // 평가 ID
      "score": 25,                 // 전체 합산 점수
      "scoreText": null,
      "scoreCount": 3,             // 현재까지 평가한 사람 수
      "totalScoreCount": 6,        // 전체 평가자 수
      "totalScoreType": "STEP5",   // 5단계 평가
      "totalScoreShowType": "SCORE",
      "evaluationStatus": "EVALUATING",
      "isAvgScoreVisible": true
    },
    "duplicatedInfo": { "duplicatedPhone": false, "duplicatedEmail": false },
    "openingAbstractInfo": {
      "openingId": 56789,
      "title": "[OO팀] 소프트웨어 엔지니어",
      "status": "OPEN"
    },
    "recruitmentPlatform": "EXAMPLE",  // EXAMPLE, NONE 등
    "isRejected": false,
    "isPassed": false,
    "isVisible": true
    // 기타: lastMeetingInfo, shifteeInfo, viewinterInfo, orpInfo 등 (대부분 null)
  }
  ```
- **evaluationInfo 분석**:
  - `score`: 전체 평가자의 합산 점수 (개별 점수 아님)
  - `scoreCount` / `totalScoreCount`: 평가 완료 인원 / 전체 평가자 수 (예: 3/6)
  - `totalScoreType: "STEP5"`: 5단계 평가 (5단계 평가)
  - ⚠️ **"내가" 평가했는지 여부와 "나의" 개별 점수는 포함되어 있지 않음**
  - → 카드 상세보기 API에서 개별 평가 데이터를 확인해야 함

### 3. 칸반 카드 ID 목록 (단계별)

- **Endpoint**: `GET /workspaces/{workspaceId}/openings/{openingId}/kanban-id`
- **API 버전**: v5.0
- **예시**: `GET /workspaces/1234/openings/56789/kanban-id?processId=100001&sorts=SUBMIT_DATE_DESC,ID_ASC&status=SUBMIT`
- **설명**: 특정 단계의 전체 지원자 ID 목록을 한 번에 반환 (페이지네이션 없음)
- **쿼리 파라미터**: kanban API와 동일하나 `page`, `pageSize` 없음
- **응답 구조**:
  ```json
  {
    "success": true,
    "data": {
      "ids": [1000001, 1000002, ...]  // 지원자(카드) ID 배열
    }
  }
  ```
- **참고**: processId=100001은 Applied 단계이며 N명의 지원자 ID가 반환됨. kanban API(#2)가 페이지네이션된 카드 상세를, 이 API는 전체 ID 목록을 제공하는 구조로 보임

### 4. (조사 필요) 카드 상세 / 평가 정보

- TODO: 카드 클릭 시 호출되는 API 확인 필요
- TODO: 평가 데이터가 포함된 응답 구조 확인 필요

## 기술 조사 진행 방법

1. ~~칸반 보드 페이지에서 브라우저 개발자 도구(Network 탭)를 열고 API 호출 패턴 확인~~ ✅ 진행 중
2. 카드 클릭 시 추가로 호출되는 API 확인
3. 응답 데이터에 평가 정보가 포함되어 있는지 확인
4. 위 정보를 바탕으로 구현 전략 결정

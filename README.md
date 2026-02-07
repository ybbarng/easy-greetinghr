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

## 기술 검토 사항 (조사 완료)

### 1. 데이터 가용성
- [x] 칸반 보드 페이지 로드 시 평가 데이터가 이미 포함되어 있는가? → **집계 데이터만** (scoreCount, 합산 score)
- [x] 각 카드의 평가 정보를 가져오는 별도 API가 있는가? → **있음** (`evaluations/contents`)

### 2. API 구조
- [x] 칸반 보드 로드 시 호출되는 API: `processes`, `kanban-id`, `kanban`
- [x] 카드 상세보기 진입 시 호출되는 API: `applicants/{id}`, `evaluations/contents`
- [x] 평가 데이터 구조: `evaluationContents[].isOwn`으로 내 평가 여부 판별

### 3. 인증 방식
- [x] API 호출 시 `Authorization` 헤더 사용 (Bearer 형식은 아님, 커스텀 토큰)
- [x] 크롬 확장프로그램에서 활용 가능: 같은 도메인 요청 시 브라우저가 자동으로 헤더/쿠키를 포함하거나, content script에서 페이지의 토큰을 추출하여 사용

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
          "id": 100001,          // 단계 ID
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
- **참고**: 이 예시(Document Review 단계)는 지원자가 0명이라 datas가 빈 배열
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
    "recruitmentPlatform": "EXAMPLE",
    "isRejected": false,
    "isPassed": false,
    "isVisible": true
    // 기타: lastMeetingInfo, shifteeInfo, viewinterInfo, orpInfo 등 (대부분 null)
  }
  ```
- **evaluationInfo 분석**:
  - `score`: 전체 평가자의 합산 점수 (개별 점수 아님)
  - `scoreCount` / `totalScoreCount`: 평가 완료 인원 / 전체 평가자 수 (예: 3/6)
  - `totalScoreType: "STEP5"`: 5단계 평가
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
- **참고**: kanban API가 페이지네이션된 카드 상세를, 이 API는 전체 ID 목록을 제공하는 구조

### 4. 지원자 상세 정보

- **Endpoint**: `GET /workspaces/{workspaceId}/openings/{openingId}/applicants/{applicantId}`
- **API 버전**: v4.0
- **예시**: `GET /workspaces/1234/openings/56789/applicants/1000001`
- **설명**: 지원자 카드 상세 정보. 칸반 카드(#2)와 동일한 데이터 구조
- **참고**: 개별 평가자 정보는 포함되지 않음 (집계 evaluationInfo만 있음)

### 5. 평가 상세 (개별 평가자별) ⭐ 핵심 API

- **Endpoint**: `GET /evaluations/contents?applicantId={applicantId}`
- **Base URL**: `https://api.greetinghr.com/app/ats/evaluations/contents` (버전 prefix 없음)
- **예시**: `GET /evaluations/contents?applicantId=1000001`
- **설명**: 지원자에 대한 모든 단계별 개별 평가 데이터를 반환
- **응답 구조**:
  ```json
  {
    "success": true,
    "data": {
      "processEvaluations": [
        {
          "currentProcess": true,       // 현재 단계 여부
          "id": 100001,
          "name": "Applied",
          "icon": "🗒️",
          "evaluation": {
            "id": 2000001,
            "evaluationModuleId": 50001,
            "score": 25,                // 전체 합산 점수
            "totalScoreType": "STEP5",
            "evaluationContents": [     // ⭐ 개별 평가자 배열
              {
                "id": 3000001,
                "evaluatorSummary": {
                  "id": 10001,          // 평가자 ID
                  "name": "김철수",
                  "imageUrl": null,
                  "department": "Dev"
                },
                "privateEvaluation": false,
                "score": 25,            // 이 평가자의 개별 점수
                "scoreText": "",
                "comment": "(평가 코멘트 내용)",
                "isOwn": true,          // ⭐⭐ 내 평가 여부!
                "isVisible": true,
                "createdAt": "2025-01-16T10:00:00Z",
                "updatedAt": "2025-01-16T10:05:00Z"
              }
            ]
          }
        },
        {
          "currentProcess": false,
          "id": 100002,
          "name": "Document Review",
          "evaluation": null            // 아직 이 단계에서 평가 없음
        }
      ],
      "archivedEvaluations": [],
      "deletedProcessEvaluations": []
    }
  }
  ```
- **핵심 필드**:
  - `processEvaluations[].currentProcess`: 지원자의 현재 단계 여부
  - `processEvaluations[].evaluation.evaluationContents[]`: 개별 평가자 배열
  - `evaluationContents[].isOwn`: **내 평가인지 여부** (`true`/`false`)
  - `evaluationContents[].score`: **나의 개별 점수**
  - `evaluationContents[].evaluatorSummary.id`: 평가자 고유 ID
  - `evaluationContents[].comment`: 평가 코멘트
- **`isOwn: true`인 항목으로 현재 로그인 사용자의 평가를 식별**
- **점수 체계**: STEP5 = 5단계 (0, 25, 50, 75, 100)
- **단계별 평가 상태 패턴**:
  | 상태 | evaluation | evaluationContents |
  |------|-----------|-------------------|
  | 해당 단계 평가 진행 중 | `{ id, score, evaluationContents: [...] }` | 평가한 사람들의 배열 |
  | 해당 단계 평가 없음 (아직 아무도 안 함) | `{ id, score: null, evaluationContents: [] }` | 빈 배열 |
  | 해당 단계 도달 전 | `null` | - |
- **내 평가 여부 판별 로직**:
  1. `currentProcess: true`인 단계를 찾는다
  2. 해당 단계의 `evaluation.evaluationContents`에서 `isOwn: true`인 항목을 찾는다
  3. 있으면 → 내가 평가함 (해당 `score`가 나의 점수)
  4. 없으면 → 내가 아직 평가하지 않음

## 기술 검토 결론

### 데이터 가용성
- ✅ 칸반 보드 API에는 집계 평가 데이터만 포함 (scoreCount, 합산 score)
- ✅ 개별 평가 데이터는 `evaluations/contents` API를 지원자별로 호출해야 확인 가능
- ✅ `isOwn` 필드로 내 평가 여부를 판별할 수 있음
- ✅ `currentProcess` 필드로 현재 단계의 평가만 확인 가능

### 구현 전략
- 칸반 보드에 표시된 각 지원자에 대해 `evaluations/contents` API를 호출하여
  현재 단계(`currentProcess: true`)의 `isOwn: true` 항목 존재 여부 및 점수를 수집
- API 호출 수: 지원자 수만큼 (예: N명이면 N회 추가 호출)

## 기술 조사 진행 방법

1. ~~칸반 보드 페이지에서 브라우저 개발자 도구(Network 탭)를 열고 API 호출 패턴 확인~~ ✅
2. ~~카드 클릭 시 추가로 호출되는 API 확인~~ ✅
3. ~~응답 데이터에 평가 정보가 포함되어 있는지 확인~~ ✅
4. 위 정보를 바탕으로 구현 전략 결정 — 진행 중

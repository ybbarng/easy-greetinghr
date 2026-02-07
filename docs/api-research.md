# API 조사 결과

## 기술 검토 사항

### 1. 데이터 가용성
- [x] 칸반 보드 페이지 로드 시 평가 데이터가 이미 포함되어 있는가? → **집계 데이터만** (scoreCount, 합산 score)
- [x] 각 카드의 평가 정보를 가져오는 별도 API가 있는가? → **있음** (`evaluations/contents`)

### 2. API 구조
- [x] 칸반 보드 로드 시 호출되는 API: `processes`, `kanban-id`, `kanban`
- [x] 카드 상세보기 진입 시 호출되는 API: `applicants/{id}`, `evaluations/contents`
- [x] 평가 데이터 구조: `evaluationContents[].isOwn`으로 내 평가 여부 판별

### 3. 인증 방식
- [x] API 호출 시 `Authorization` 헤더 사용 (Bearer 형식은 아님, 커스텀 토큰)
- [x] `X-Greeting-Workspace-Id`, `X-Greeting-Opening-Id` 헤더 필요

## API 상세

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
      "datas": [],
      "totalPage": 0,
      "hasPrev": false,
      "hasNext": false
    }
  }
  ```
- **카드 데이터 구조** (지원자가 있는 단계에서 확인):
  ```json
  {
    "applicantInfo": {
      "id": 1000001,
      "name": "홍길동",
      "email": "...",
      "phone": "...",
      "submitDate": "2025-01-15T09:00:00Z",
      "refererName": "example.co.kr",
      "isLock": false,
      "status": "SUBMIT"
    },
    "processInfo": {
      "id": 100001,
      "name": "Applied",
      "icon": "🗒️"
    },
    "evaluationInfo": {
      "evaluationId": 2000001,
      "score": 25,
      "scoreCount": 3,
      "totalScoreCount": 6,
      "totalScoreType": "STEP5",
      "evaluationStatus": "EVALUATING"
    },
    "openingAbstractInfo": {
      "openingId": 56789,
      "title": "[OO팀] 소프트웨어 엔지니어",
      "status": "OPEN"
    }
  }
  ```
- **evaluationInfo**: 집계 데이터만 포함. 개별 평가자 정보 없음

### 3. 칸반 카드 ID 목록 (단계별)

- **Endpoint**: `GET /workspaces/{workspaceId}/openings/{openingId}/kanban-id`
- **API 버전**: v5.0
- **설명**: 특정 단계의 전체 지원자 ID 목록을 한 번에 반환 (페이지네이션 없음)
- **응답 구조**:
  ```json
  {
    "success": true,
    "data": {
      "ids": [1000001, 1000002, ...]
    }
  }
  ```

### 4. 지원자 상세 정보

- **Endpoint**: `GET /workspaces/{workspaceId}/openings/{openingId}/applicants/{applicantId}`
- **API 버전**: v4.0
- **설명**: 지원자 카드 상세 정보. 칸반 카드와 동일한 데이터 구조
- **참고**: 개별 평가자 정보는 포함되지 않음 (집계 evaluationInfo만 있음)

### 5. 평가 상세 (개별 평가자별) — 핵심 API

- **Endpoint**: `GET /evaluations/contents?applicantId={applicantId}`
- **Base URL**: `https://api.greetinghr.com/app/ats/evaluations/contents` (버전 prefix 없음)
- **설명**: 지원자에 대한 모든 단계별 개별 평가 데이터를 반환
- **응답 구조**:
  ```json
  {
    "success": true,
    "data": {
      "processEvaluations": [
        {
          "currentProcess": true,
          "id": 100001,
          "name": "Applied",
          "evaluation": {
            "id": 2000001,
            "evaluationModuleId": 50001,
            "score": 25,
            "totalScoreType": "STEP5",
            "evaluationContents": [
              {
                "id": 3000001,
                "evaluatorSummary": {
                  "id": 10001,
                  "name": "김철수",
                  "department": "Dev"
                },
                "score": 25,
                "comment": "(평가 코멘트 내용)",
                "isOwn": true,
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
          "evaluation": null
        }
      ]
    }
  }
  ```
- **핵심 필드**:
  - `evaluationContents[].isOwn`: 내 평가인지 여부
  - `evaluationContents[].score`: 나의 개별 점수
- **점수 체계**: STEP5 = 5단계 (0, 25, 50, 75, 100)
- **단계별 평가 상태 패턴**:
  | 상태 | evaluation | evaluationContents |
  |------|-----------|-------------------|
  | 평가 진행 중 | `{ id, score, evaluationContents: [...] }` | 평가한 사람들의 배열 |
  | 아무도 평가 안 함 | `{ id, score: null, evaluationContents: [] }` | 빈 배열 |
  | 해당 단계 도달 전 | `null` | - |

## 기술 검토 결론

- 칸반 보드 API에는 집계 평가 데이터만 포함
- 개별 평가 데이터는 `evaluations/contents` API를 지원자별로 호출해야 확인 가능
- `isOwn` 필드로 내 평가 여부를 판별
- `currentProcess` 필드로 현재 단계의 평가만 확인 가능
- API 호출 수: 지원자 수만큼 (N명이면 N회 추가 호출)
- 그리팅HR 앱은 `window.fetch`가 아닌 `XMLHttpRequest`로 API를 호출하므로, 네트워크 감지 시 XHR 인터셉트가 필요

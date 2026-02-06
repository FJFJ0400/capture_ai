# API - Capture AI Agent

## 인증
- 헤더: `x-api-key: {API_KEY}`
- MVP는 단일 사용자용 API Key만 사용, 추후 JWT/OAuth 확장 예정
이유: 구현 속도를 높이고 MVP 검증에 집중하기 위함입니다.

## 에러 코드 규약
```json
{
  "error": {
    "code": "INVALID_STATUS",
    "message": "Invalid status.",
    "details": {}
  }
}
```
- `UNAUTHORIZED`, `INVALID_STATUS`, `INVALID_CATEGORY`, `FILE_TOO_LARGE`, `NOT_FOUND`, `INTERNAL_ERROR` 등
이유: 클라이언트가 일관된 방식으로 오류를 처리할 수 있어야 합니다.

## REST 엔드포인트

### POST /v1/captures
- 설명: 멀티파트 이미지 업로드 (필드명 `files`)
- 추가 필드: `purposeId`(선택)
- 요청 예시: multipart/form-data
- 응답 예시
```json
{
  "data": [
    {
      "item": {
        "id": "c123",
        "originalFilename": "receipt.png",
        "status": "UPLOADED",
        "summary": null,
        "tags": []
      },
      "duplicate": false
    }
  ]
}
```
이유: 업로드 직후 인입함에 반영되어 빠른 피드백이 필요합니다.

### GET /v1/captures
- 설명: 검색/필터 조회
- 쿼리: `query`, `category`, `status`, `purposeId`, `from`, `to`
- 응답 예시
```json
{
  "data": [
    {
      "id": "c123",
      "status": "DONE",
      "summary": "...",
      "tags": ["receipt", "tax"]
    }
  ]
}
```
이유: 인입함 UX의 핵심은 빠른 검색과 필터링입니다.

### GET /v1/captures/stream
- 설명: 캡처 상태 변경 SSE 스트림
- 쿼리: `captureId`(선택), `since`(선택, ISO8601)
- 인증: `x-api-key` 헤더 또는 `apiKey` 쿼리 파라미터
- 이벤트
  - `update`: 변경된 캡처 배열
  - `ping`: keep-alive
- 응답 예시
```
event: update
data: [{"id":"c123","status":"DONE", ...}]
```
이유: 폴링 없이 실시간 갱신을 제공합니다.

### GET /v1/captures/:id
- 설명: 상세 정보 조회
- 응답 예시
```json
{
  "data": {
    "id": "c123",
    "status": "DONE",
    "category": "receipt",
    "summary": "...",
    "ocrText": "..."
  }
}
```
이유: 상세 화면에서 요약/카테고리/원문 확인이 필수입니다.

### GET /v1/captures/:id/file
- 설명: 원본 이미지 바이너리 반환
- 응답: 이미지 바이너리 (Content-Type 설정)
이유: 상세 페이지에서 원본 이미지 미리보기를 제공해야 합니다.

### POST /v1/captures/:id/retry
- 설명: FAILED 또는 처리 중단 항목 재시도
- 응답 예시
```json
{
  "data": { "id": "c123", "status": "UPLOADED" }
}
```
이유: OCR 실패 시 사용자 재시도를 보장해야 합니다.

### DELETE /v1/captures/:id
- 설명: 캡처 삭제 (원본 이미지 + DB 레코드)
- 응답 예시
```json
{ "data": { "id": "c123" } }
```
이유: 불필요한 캡처를 정리할 수 있어야 합니다.

### GET /v1/purposes
- 설명: 목적 프로필 목록 조회
- 응답 예시
```json
{
  "data": [
    {
      "id": "p1",
      "name": "일반 정리",
      "instruction": "핵심 내용을 체크리스트로 정리",
      "sampleKeywords": ["일정", "금액"],
      "isDefault": true,
      "isActive": true
    }
  ]
}
```

### POST /v1/purposes
- 설명: 목적 프로필 생성
- 요청 예시
```json
{
  "name": "영수증 정리",
  "description": "지출 정리 목적",
  "instruction": "금액, 결제일, 후속 작업을 우선 정리",
  "sampleKeywords": ["total", "tax", "amount"],
  "isDefault": false,
  "isActive": true
}
```

### PATCH /v1/purposes/:id
- 설명: 목적 프로필 수정/기본 전환

### DELETE /v1/purposes/:id
- 설명: 목적 프로필 삭제

### POST /v1/todos
- 설명: TODO 생성
- 요청 예시
```json
{ "title": "캘린더 등록", "sourceCaptureId": "c123" }
```
- 응답 예시
```json
{ "data": { "id": "t1", "title": "캘린더 등록" } }
```
이유: 액션 추천이 실제 행동으로 이어져야 가치가 생깁니다.

### GET /v1/todos
- 설명: TODO 목록
- 응답 예시
```json
{ "data": [{ "id": "t1", "title": "캘린더 등록" }] }
```
이유: 추천된 액션의 실행을 확인하기 위한 보기가 필요합니다.

### PATCH /v1/todos/:id
- 설명: TODO 완료 상태 변경
- 요청 예시
```json
{ "done": true }
```
- 응답 예시
```json
{ "data": { "id": "t1", "done": true } }
```
이유: 액션의 실행 완료를 기록해야 합니다.

### DELETE /v1/todos/:id
- 설명: TODO 삭제
- 응답 예시
```json
{ "data": { "id": "t1" } }
```
이유: 불필요한 항목을 정리할 수 있어야 합니다.

### POST /v1/chat/query
- 설명: 저장된 스크린샷(요약/OCR/태그) 기반 질의응답
- 요청 예시
```json
{
  "message": "최근 영수증에서 결제 금액이 큰 순으로 알려줘",
  "captureId": "c123",
  "history": [
    { "role": "user", "content": "최근 영수증만 기준으로 보자" }
  ]
}
```
- 응답 예시
```json
{
  "data": {
    "answer": "요청하신 질문: ...",
    "references": [
      {
        "id": "c123",
        "originalFilename": "receipt.png",
        "createdAt": "2026-02-06T09:00:00.000Z",
        "summary": "...",
        "purposeSummary": "...",
        "tags": ["receipt", "total"],
        "score": 12.4
      }
    ],
    "followUps": [
      "이 내용에서 일정/시간만 추려줘",
      "가장 중요한 할 일 3개로 정리해줘"
    ]
  }
}
```
이유: 저장된 캡처를 대화형으로 재활용해야 사용자가 실제 도움을 받을 수 있습니다.

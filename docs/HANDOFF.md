# 인계 요약 (Capture AI Agent)

## 완료된 변경 사항

- **SSE 실시간 스트림 추가**: `GET /v1/captures/stream`  
  - `captureId`, `since` 지원  
  - `apiKey` 쿼리 파라미터 인증 허용 (`x-api-key` 없을 때 EventSource용)
  - `apps/api/src/routes/captures.ts`, `apps/api/src/plugins/auth.ts`

- **Web 실시간 갱신 연결**  
  - 인입함: 필터 없을 때 SSE, 필터 있으면 5초 폴링 유지  
  - 상세: SSE 연결 (`captureId` 기준), API_KEY 없으면 폴링  
  - `apps/web/lib/api.ts`, `apps/web/app/inbox/page.tsx`, `apps/web/app/inbox/[id]/page.tsx`

- **OCR 실제 엔진**: tesseract.js 어댑터 추가 + 타임아웃  
  - `apps/worker/src/ocr/index.ts`, `apps/worker/src/env.ts`  
  - `.env`에 `OCR_ADAPTER=tesseract`, `OCR_LANG`, `OCR_TIMEOUT_MS` 추가

- **S3 스토리지 드라이버 지원**  
  - `apps/api/src/lib/storage/s3.ts`, `apps/worker/src/lib/storage/s3.ts`  
  - env: `STORAGE_DRIVER`, `S3_*` 추가

- **삭제/완료 처리 API + UI**
  - 캡처 삭제 `DELETE /v1/captures/:id`  
  - TODO 완료 `PATCH /v1/todos/:id` / 삭제 `DELETE /v1/todos/:id`  
  - UI 연결 완료 (`/inbox`, `/inbox/:id`, `/todos`)

- **설정 화면** `/settings` 추가

- **테스트**: `packages/shared`에 `vitest` + `text.test.ts`

- **문서 업데이트**: `docs/API.md`, `.env.example`

## 현재 상태 / 이슈

- **OCR(tesseract) 실행 문제**: Node v22에서 `RuntimeError: Aborted(-1)`로 멈춤
  - → Node 20 LTS로 테스트 필요.

- **SSE 상태**: ping 이벤트 확인됨. 업데이트 이벤트는 데이터 변경 시 정상 처리로 추정.

- **Chrome 자동 실행**: 정책상 차단됨.

## 로컬 환경

- `.env`에 OCR/Tesseract 및 S3 변수 추가됨 (S3 값은 비어있음)
- 서버 실행 스크립트는 백그라운드로 돌렸고 `.dev_pids`에 저장됨
- 로그 파일: `api-dev.log`, `api-dev.err.log`, `worker-dev.log`, `worker-dev.err.log`, `web-dev.log`

## 추가로 부탁할 작업

1. **Node 20 LTS 환경에서 tesseract OCR 정상 동작 검증** 및 필요 시 설정 수정  
2. **S3 실제 연결 테스트** (S3_* 환경변수 입력 후)  
3. **SSE 이벤트 업데이트 실제 UI 반영 검수**  
4. 만약 SSE 문제 있으면 폴링 fallback 재확인

## 중요 파일 목록

- `apps/api/src/routes/captures.ts` (SSE, DELETE)
- `apps/api/src/routes/todos.ts` (PATCH/DELETE)
- `apps/api/src/plugins/auth.ts` (apiKey query 허용)
- `apps/web/lib/api.ts` (EventSource URL helper)
- `apps/web/app/inbox/page.tsx`, `apps/web/app/inbox/[id]/page.tsx` (SSE)
- `apps/worker/src/ocr/index.ts` (tesseract + timeout)
- `.env`, `.env.example`, `docs/API.md`

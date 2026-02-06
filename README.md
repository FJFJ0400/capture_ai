# Capture AI Agent MVP

웹 기반 업로드 → 비동기 OCR/요약/분류 → 인입함/액션 추천까지 이어지는 MVP입니다.

## Features
- 멀티 이미지 업로드 + 인입함 상태 표시
- BullMQ + Redis 비동기 파이프라인
- OCR/요약/분류/태그/액션 추천(placeholder)
- 저장된 스크린샷 기반 대화(`/chat`)
- 검색/필터, 상세 보기, TODO
- API Key 기반 단일 사용자 인증
- 로컬 스토리지 암호화 저장

## Repo Structure
- `apps/web` Next.js(App Router)
- `apps/api` Fastify API
- `apps/worker` BullMQ Worker
- `packages/shared` 공용 타입/유틸
- `docs` PRD/RFP/Architecture/API/DB 문서
- `docker` 로컬 postgres/redis
- `storage/local` 로컬 파일 저장(깃 제외)

## Environment
- `.env.example`을 참고해 `.env`를 준비하세요.
- `STORAGE_ENCRYPTION_KEY`는 64자리 hex(32바이트) 키가 필요합니다.

## Run
1. `pnpm install`
2. `docker compose up -d`
3. `pnpm db:migrate`
4. `pnpm dev`
5. 접속: `http://localhost:3000`

## Chrome Test Flow
크롬에서 공유 인입 플로우를 수동으로 검증할 수 있습니다.

1. `http://localhost:3000/chrome-test` 접속
2. 이미지 파일 선택 후 `공유 인입 테스트 실행` 클릭
3. `/mobile-save`에서 `저장하기` 클릭
4. `/inbox`에서 업로드된 항목 확인

## Scripts
- `pnpm dev`: web/api/worker 동시 실행
- `pnpm db:migrate`: Prisma 마이그레이션

## Notes
- 업로드 파일 제한: 10MB, PNG/JPG/WEBP
- OCR 결과는 로그에 남기지 않습니다.
- OCR 어댑터는 `placeholder`이며 추후 교체 가능합니다.

## Manual Test Checklist
1. `/inbox`에서 이미지 업로드 → 상태가 `UPLOADED`로 표시되는지 확인
2. Worker 동작 후 상태가 `DONE`으로 변경되는지 확인
3. 키워드 검색/카테고리 필터가 동작하는지 확인
4. 상세 화면에서 요약/태그/이미지 미리보기가 표시되는지 확인
5. 액션 추천 클릭 → `/todos`에 항목이 추가되는지 확인

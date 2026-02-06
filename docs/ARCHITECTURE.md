# Architecture - Capture AI Agent MVP

## 아키텍처 개요
```
[Web (Next.js)]
     │ upload/search
     ▼
[API (Fastify)] ──► [PostgreSQL]
     │ enqueue          ▲
     ▼                 │
[Redis Queue] ──► [Worker (BullMQ)] ──► [Storage]
```
- Client: 업로드/검색/상세 UI 제공
- API: 인증, 업로드, 조회, 재시도, TODO
- Queue/Worker: OCR·요약·분류·태그 생성 비동기 처리
- DB: 메타데이터/상태/요약 저장
- Storage: 원본 이미지 저장 (로컬, S3 인터페이스 확장)
이유: 처리 시간을 분리해 사용자 경험을 유지하면서 확장성을 확보합니다.

## 데이터 흐름 시퀀스
1. Upload: 이미지 업로드 → CaptureItem 생성(UPLOADED)
2. Job: BullMQ에 작업 등록
3. OCR: Worker가 OCR 수행
4. Summarize/Classify: 요약/카테고리/태그/액션 생성
5. Save: DB 업데이트(DONE/FAILED)
6. Notify: UI에서 상태 갱신
이유: 비동기 파이프라인을 명확히 해 장애 지점을 분리합니다.

## 보안 원칙
- 전송: TLS 전제 (운영 환경)
- 저장: 파일 암호화(키는 환경변수 분리)
- 로그: OCR 원문/이미지 미기록, 에러는 최소 정보만 저장
- 접근: API Key 기반 단일 사용자 모드
이유: 민감 데이터가 포함될 수 있으므로 기본 보안 장치를 먼저 적용합니다.

## 확장 계획
- iOS/Android 공유시트/사진권한 모듈 추가
- S3/Cloud OCR 어댑터 교체
- OAuth/JWT 인증 및 다중 사용자
이유: MVP 검증 후에도 구조를 흔들지 않고 확장할 수 있어야 합니다.

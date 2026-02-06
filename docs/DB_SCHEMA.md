# DB Schema - Capture AI Agent

## 테이블/필드/인덱스 (Prisma 기준)

### CaptureItem
- id (PK)
- createdAt, updatedAt
- originalFilename, mimeType, sizeBytes
- storageKey, fileHash (unique)
- status (UPLOADED/PROCESSING/DONE/FAILED)
- category, summary, ocrText
- tags (string[])
- actionSuggestions (json)
- failureReason
- 인덱스: createdAt, status, category
이유: 인입함 조회와 필터가 핵심이므로 시간/상태/카테고리 인덱스가 필요합니다.

### TodoItem
- id (PK)
- createdAt
- title
- sourceCaptureId (nullable)
- done (boolean)
- 인덱스: createdAt, done
이유: TODO 리스트는 시간순/상태 기반 조회가 많습니다.

## 주요 쿼리 패턴
- 검색: `ocrText`/`summary`/`tags` 포함 검색
- 필터: category, status, createdAt 기간
- 상세 조회: CaptureItem by id
- TODO 조회: createdAt desc
이유: 빈번한 UI 요청을 빠르게 처리하기 위한 패턴 위주로 설계합니다.

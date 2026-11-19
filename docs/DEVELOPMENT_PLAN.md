# 틈봄(TeumBom) 개발 계획서 — 배포형 웹앱 MVP

> 기준 문서: 「2026 AI활용 전국 대학생 창업 해커톤 대회_아이디어 소개서_틈봄」, Figma 「AI 창업 해커톤 디자인」(최종 화면기획서 2026.11.19)
> 목표: QR 코드 한 번으로 휴대폰에서 앱처럼 실행되는 **모바일 웹앱(PWA)** + PC 화면 + 운영자 웹. 시연용을 넘어 실제 데이터가 흐르는 MVP.

## 0. 기획서 대비 변경 사항

| 항목 | 기존 기획 | 이번 개발 반영 |
|---|---|---|
| 실시간 영상 | 동의 세션 실시간 영상(개념) | **WebRTC로 실제 송출** — 선생님 휴대폰 카메라 → 보호자 화면, 동의/철회 즉시 반영 |
| 인력 풀 | 퇴직 교사 중심 교원 자격자 | **검증된 이력 풀**: ① 교원 자격 보유자(정교사 1·2급, 퇴직 교원 포함) ② 준자격자 — 보육교사·아이돌봄사·유아/아동 교육 전공, 아동 지도·돌봄 경력 검증자. 자격 등급이 프로필·매칭 점수에 반영 |
| 클라이언트 | React Native 앱 | 설치 없는 **PWA(모바일 웹앱)** — 홈 화면 추가 시 앱처럼 전체 화면 실행. 동일 코드로 PC 레이아웃 제공 |
| AI | Claude API 등 | **데모 모드 기본 + Claude API 플러그인**. 키 없이도 규칙 기반·기기 내 OCR로 전 과정 동작, `ANTHROPIC_API_KEY` 설정 시 LLM 추출로 전환 |

## 1. 시스템 아키텍처

```
[휴대폰/PC 브라우저 (PWA)]
  Next.js 15 · React 19 · TypeScript · Tailwind
  ├─ 기기 내 OCR (Tesseract.js, kor)      ← 통신문 사진이 서버로 가지 않음
  ├─ 음성 메모 STT (Web Speech API, ko-KR)
  └─ WebRTC (getUserMedia / RTCPeerConnection)
        │  HTTPS REST + WebSocket(wss)
        ▼
[FastAPI 백엔드 (Python 3.12)]
  ├─ REST API: 인증·방문·통신문·할 일·기록·리포트·매칭·운영
  ├─ WebSocket /ws/{room}: 실시간 상태 동기화 + WebRTC 시그널링
  ├─ AI 모듈: 통신문 추출(3중 검증) · 매칭 · 리포트 · 서류 추출 · 이상 감지
  └─ SQLAlchemy → PostgreSQL(운영) / SQLite(로컬·폴백)
        │
        ▼
[STUN: Google 공개 STUN]  [TURN: 환경변수로 연결(선택, 모바일 통신망 대비)]
```

### 배포 (Vercel + Render 무료)
- **프론트엔드**: Vercel (`apps/web`) — 전 세계 CDN, HTTPS 자동 → 카메라 권한 사용 가능
- **백엔드**: Render Web Service 무료 플랜 (`apps/api`, `render.yaml`) — WebSocket 지원
- **DB**: `DATABASE_URL`이 있으면 PostgreSQL(Render/Neon 무료), 없으면 SQLite. 무료 플랜은 15분 무사용 시 잠들어 첫 접속이 30초~1분 걸리고, SQLite면 재시작 시 시연 데이터가 초기 상태로 돌아감(시연에는 오히려 유리)
- **QR**: 배포 URL을 담은 QR을 시작 화면(PC)과 `docs/qr.png`로 제공

## 2. 사용자와 화면 구성 (Figma 기준)

### 시연 방(Demo Room) 개념
여러 사람이 동시에 QR로 접속해도 서로 섞이지 않도록, **"보호자로 체험하기"를 누르면 새 시연 방**이 만들어짐.
보호자 화면에 표시되는 **방 코드/QR**을 다른 휴대폰에서 찍으면 같은 방의 **선생님(김하늘)** 으로 입장 → 두 대의 휴대폰으로 요청·수락·통신문·실시간 영상·리포트 전 과정을 실제로 주고받음. 한 대로 시연할 때는 상단 "역할 전환"으로 오감.

### 보호자 앱 (하단 탭: 홈 · 선생님 찾기 · 방문 일정 · 리포트)
| ID | 화면 | 핵심 동작 |
|---|---|---|
| S01 | 틈봄 시작하기 | 보호자/선생님 체험, 내 계정으로 시작, 운영자 웹 |
| A01/A02 | 가입·로그인 / 방문지 설정 | 역할 선택, 방문 지역·주소(확정 후 담당 교사에게만 공개) |
| S02 | 홈 | 다음 방문 카드, 확인할 통신문, 새 선생님 찾기 |
| S03/S03-tags | 어떤 선생님을 찾으세요? | 지역·날짜·시간·자연어 요구 → **AI 태그 추출** → 태그 확인·수정 |
| S04/S05 | 추천 선생님 / 선생님 상세 | **설명 가능한 매칭** 점수·추천 사유·자격 검증 배지 |
| S06/P01/P02 | 방문 요청 / 모의 결제 / 결제 완료 | 단발 7만 원·정기 6만 원, 실제 결제 없음 |
| S07(+8개 상태) | 방문 일정 | 요청 중→결제 대기→예약 확정→통신문 읽는 중→전달 완료→방문 중→리포트 작성 중→발송 완료/취소 |
| S08/L01 | 통신문 올리기 / 읽는 중 | 사진 촬영·선택·PDF → **기기 내 OCR** → 추출 |
| S09(+edit/corrected/verified) | 통신문 확인 | **3중 검증**(원문 근거·반복 추출 비교·양식 비교), 날짜 불일치 경고, 수정·제외, 선생님/보호자 할 일 분리 후 전달 |
| S10/S10-stopped | 실시간 방문 보기 | **WebRTC 수신**, 동의 철회 시 즉시 종료, 녹화·다운로드 없음 |
| S11/S12 | 받은 리포트 / 방문 리포트 | 선생님이 확인·발송한 리포트만 표시, 주간 합계 |
| D01 | 예약 취소 확인 | |

### 선생님 앱 (하단 탭: 방문 일정 · 교원 자격)
| ID | 화면 | 핵심 동작 |
|---|---|---|
| A01-teacher/A03/A04 | 가입 / 내 프로필 / 방문 가능 일정 | 지역·날짜·시간 |
| S13(+6개 상태) | 방문 일정 | 새 요청 수락/거절, 결제 대기, 예약 확정, 리포트 작성 중, 발송 완료 |
| S14(+live/done/address) | 방문 할 일 | 보호자가 맡긴 학교 일 + 기본 활동 체크, 확정 후 주소 공개, **방문 시작 = 영상 송출 시작(동의 시)** |
| S15(+edit/recording/transcript) | 활동 기록 | 숙제 개수·독서 시간·관찰 메모, **음성 메모 → STT → 확인 후 삽입** |
| D02 | 방문을 마칠까요? | 종료 시 영상 공유 종료 |
| S16(+ready/sent) | 리포트 보내기 | **AI 리포트 초안(기록 외 생성 금지)**, 대조 체크 후 발송 |
| S17 | 교원 자격 | 자격·경력·범죄경력·표준 교육·동반 시범 방문 |

### 운영자 웹 (PC 1220×800 기준)
| ID | 화면 | 핵심 동작 |
|---|---|---|
| S18(+ready/done) | 교원 서류 심사 | 원본·**AI 추출 결과**(이름·자격 종류·경력) 대조, 원본 대조·범죄경력 확인 체크 후 승인/보완 요청 |
| S19(+done) | 운영 경보 | 도착 지연·잦은 취소·영상 중단 **이상 감지**, 조치 메모·처리 완료 |

### PC 화면 설계
- 모바일(≤767px): Figma 390×844 그대로 — 상단 앱 바, 하단 탭, 하단 고정 행동 버튼
- 태블릿(768~1023px): 모바일 레이아웃을 가운데 정렬(최대 480px)
- PC(≥1024px): **좌측 사이드바 내비게이션**(운영자 웹과 같은 구조) + 넓은 본문. 목록/상세를 2열로 배치(예: 방문 카드 | 할 일·리포트), 하단 고정 버튼은 카드 안으로 이동. 시작 화면에는 휴대폰으로 열 수 있는 QR 표시

## 3. 백엔드 (FastAPI) 설계

### 데이터 모델
- `Room`(시연 방) · `User`(role: guardian/teacher/admin, room_id)
- `TeacherProfile`: 이름, 지역, 자격 유형(`certified`=교원 자격 / `qualified`=준자격), 자격 상세, 경력 연수, 과목·성향 태그, 소개, 검증 상태(서류·범죄경력·표준 교육·동반 시범)
- `Visit`: 보호자, 선생님, 일시, 유형(단발/정기), 금액, 상태(requested/declined/payment/booked/live/draft/sent/cancelled), 영상 동의(보호자·선생님), 주소 공개 여부
- `Notice`(통신문): 원문 텍스트, 추출 결과(JSON), 검증 플래그, 상태(reading/review/approved)
- `Task`: 방문별 할 일(출처: notice/basic), 담당(teacher/guardian), 마감일, 근거 구절, 완료 여부, 제외 여부
- `ActivityRecord`: 숙제 개수, 독서 시간, 관찰 메모, 음성 메모 전사본
- `Report`: 초안·발송본, 발송 시각
- `CredentialReview`: 신청자, 서류 텍스트, 추출 필드, 체크 상태, 결과
- `OpsAlert`: 유형(도착 지연/잦은 취소/영상 중단), 관련 방문, 조치, 메모

### 주요 API
```
POST /api/rooms                         시연 방 생성(보호자 입장)
POST /api/rooms/{code}/join             같은 방에 선생님으로 입장
GET  /api/me · POST /api/auth/demo      데모 로그인(JWT)
POST /api/match/tags                    자연어 → 태그(AI)
POST /api/match/recommend               태그·조건 → 추천 목록(점수·사유)
GET  /api/teachers/{id}
POST /api/visits · PATCH /api/visits/{id}/(accept|decline|pay|cancel|start|finish)
POST /api/visits/{id}/notices           OCR 텍스트 → 추출(3중 검증)
PATCH /api/notices/{id}/items/{idx}     수정·제외·원문 대조 완료
POST /api/notices/{id}/approve          선생님에게 전달 → Task 생성
PATCH /api/tasks/{id}                   체크
PUT  /api/visits/{id}/record            활동 기록
POST /api/visits/{id}/report/draft      리포트 초안(AI) · POST .../report/send
PATCH /api/visits/{id}/consent          영상 공유 동의/철회
GET  /api/admin/reviews · POST /api/admin/reviews/{id}/(approve|request)
GET  /api/admin/alerts · POST /api/admin/alerts/{id}/resolve
WS   /ws/{room}                         상태 변경 이벤트 + WebRTC offer/answer/ice
```

## 4. AI 모듈 설계 (기획서 3-2 대응)

| 모듈 | 데모 모드(기본, API 키 불필요) | LLM 모드(`ANTHROPIC_API_KEY`) | 사람 확인 지점 |
|---|---|---|---|
| ① 알림장 챙김 | 기기 내 OCR(Tesseract.js) → 규칙 추출기 A(정규식: 날짜·금액·제출) + 추출기 B(키워드·문장 패턴) | Claude 구조화 추출(JSON 스키마) 2회 + 규칙 추출기 | 보호자 승인 후 체크리스트 반영 |
| ③중 검증 | ⓐ 추출값이 원문에 있는지 **근거 구절 매칭** ⓑ 두 추출기 결과 **일치 비교** → 불일치 시 "확인할 날짜/금액" ⓒ 학교 **양식 비교**(알려진 항목 유형 외는 신뢰도 하향). 결제·서명은 보호자 할 일로 강제 분리 | 동일 | |
| ② 설명 가능한 매칭 | 키워드 사전으로 성향·과목·시간 태그화 → 규칙 필터(지역·시간) → 가중 점수(자격 등급·과목·성향·거리·평점) → 템플릿 추천 사유 | 태그화·추천 사유 문장을 LLM이 생성(점수는 동일 규칙) | 보호자가 태그 확인·수정 |
| ③ 성장 리포트 | 체크리스트·기록값·메모만으로 문장 조립 → **기록 외 내용 생성 0%** | LLM 요약 후 **기록에 없는 수치·사실 검출 시 폐기**하고 규칙 결과 사용 | 선생님 확인 후 발송 |
| ④ 서류 검토 보조 | 서류 텍스트에서 이름·자격 종류·급수·경력 추출 | LLM 추출 | 운영자 원본 대조 후 승인 |
| ⑤ 이상 감지 | 규칙: 예정 대비 도착 지연, 30일 내 취소 횟수, 방문 중 영상 중단 | — | 운영자 조치 |

AI 품질 평가: `apps/api/eval/` 에 샘플 가정통신문 정답셋과 평가 스크립트(치명 항목 오류율·무수정 승인율) 포함.

## 5. WebRTC 실시간 영상

- 송출: 선생님이 **방문 시작** → 양측 동의 상태면 후면 카메라(`facingMode: environment`) 스트림 생성 → 보호자가 S10 진입 시 시그널링 서버(/ws)로 offer/answer/ICE 교환 → P2P 영상
- 녹화·다운로드 없음(Figma 문구와 일치). 보호자 **동의 철회** → 즉시 트랙 중지·연결 종료(S10-stopped)
- NAT: Google STUN 기본, 통신사망(LTE/5G)에서 연결 실패 대비 `TURN_URL/USERNAME/CREDENTIAL` 환경변수 지원(Metered·Cloudflare 무료 TURN 연결 가능)
- 연결 상태(연결 중/재연결/중단)를 화면에 표시, 영상 중단 시 운영 경보 생성

## 6. 디자인 시스템 (Figma 02 · 공통 컴포넌트)

- 색: brand `#3182F6`(진한 강조 `#245BB5`), bg `#F6F8FB`, surface `#FFFFFF`, ink `#172432`, muted `#46576A`, line `#788899`, softLine `#DCE3EC`, disabled `#E5E9EF`, danger `#B3261E`, blueLight `#E6F0FF`, waitBg `#FFF2CD`
- 글꼴: Noto Sans KR — 14/20, 16/24, 18/28(선생님 업무 화면), 20/28, 24/32, 32/44
- 컴포넌트: Button(Primary/Secondary/Disabled/Danger/Text, 높이 48), Chip, Badge(WAIT/BOOKED/LIVE/DRAFT/SENT/CLOSED/ERROR), Field, Avatar(이니셜), Teacher card, Check row(Unchecked/Checked/Locked), App bar(Root/Detail), Navigation(보호자 4탭/선생님 2탭), Icon 18종(Figma SVG 그대로 사용)

## 7. 개발 일정(실행 순서)

1. 모노레포 구성, 디자인 토큰·공통 컴포넌트·아이콘
2. 백엔드: 모델·시드 데이터(강원 선생님 30명, 교원/준자격 혼합)·REST API·WebSocket
3. AI 모듈(데모 모드) + 평가 스크립트 → LLM 모드 플러그인
4. 보호자 앱 화면(S01~S12, 상태별 화면 포함)
5. 선생님 앱 화면(S13~S17)
6. 운영자 웹(S18·S19)
7. WebRTC 송출/수신, 동의·철회
8. PC 레이아웃, PWA(manifest·아이콘·홈 화면 추가)
9. 로컬 통합 테스트(두 브라우저로 보호자·선생님 동시 시연)
10. 배포: Render(API) → Vercel(웹) → QR 생성 → 실기기(Android/iOS) 확인

## 8. 보안·개인정보 원칙 (기획서 3-1 반영)
- 통신문 사진은 **기기 안에서 OCR**, 서버에는 텍스트만 전송·방문 종료 후 삭제 가능. 선생님에게는 원문을 보여주지 않고 전달된 할 일만 표시
- 상세 주소는 예약 확정 후 담당 선생님에게만 공개
- 영상은 저장하지 않음(P2P 전송), 동의 철회 즉시 중단
- 결제는 모의 결제(실제 청구 0원), 카드·계좌 정보 입력 없음
- 시크릿(API 키·TURN 자격 증명)은 코드에 넣지 않고 배포 환경변수로만 설정

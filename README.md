# 틈봄 (TeumBom)

학교와 집 사이, 아이의 하루를 잇는 **맥락 기반 방문 돌봄** 서비스의 배포형 MVP. 아이가 좋아하는 것(곤충·식물·노래·공룡…)과 선생님의 삶의 이야기를 이어, 일반인부터 전문 교원까지 아이에게 맞는 돌봄 선생님을 매칭합니다.
QR 코드 한 번으로 휴대폰에서 앱처럼 실행되는 웹앱(PWA)이며, PC에서는 사이드바형 화면으로 동작합니다.

- 기획: `docs/DEVELOPMENT_PLAN.md`
- 화면: Figma 「AI 창업 해커톤 디자인」(최종 화면기획서 2026.11.19)을 기준으로 구현
- 실제 동작 캡처: `docs/screens/` (`m*` 보호자 휴대폰, `t*` 선생님 휴대폰, `d*` PC)

## 구성

| 폴더 | 내용 |
|---|---|
| `apps/web` | Next.js 15 · React 19 · Tailwind 4. 보호자(`/g`)·선생님(`/t`)·운영자(`/admin`) 화면, 기기 내 OCR(Tesseract.js), 음성 메모 STT(Web Speech API), WebRTC 수신/송출, PWA |
| `apps/api` | FastAPI · SQLAlchemy. REST API, 실시간 동기화·WebRTC 시그널링 WebSocket(`/ws`), AI 모듈(`app/ai`) |

### AI 모듈 (`apps/api/app/ai`)
- `notice.py` 알림장 챙김 — 통신문 → 할 일 추출, **3중 검증**(ⓐ 원문 근거 대조 ⓑ 두 읽기 전략 일치 비교 ⓒ 양식·요일 비교), 결제·서명은 보호자 할 일로 분리
- `match.py` 맥락 기반 매칭 — 아이의 이야기 → 테마·성향 → 선생님 이야기와의 테마 겹침 + 문자 바이그램 TF-IDF 문맥 유사도 + 성향 궁합 + 가능 시간 → 선생님 본인 문장을 인용한 추천 사유. 자격증은 선택 배지·선택 필터
- `report.py` 학습·생활 리포트 — 선생님 기록만으로 문장 생성(기록 외 내용 생성 금지)
- `credential.py` 교원 서류 검토 보조, 운영 경보(도착 지연·영상 중단·잦은 취소)
- 기본은 **데모 모드(규칙 기반, API 키 불필요)**. `TEUMBOM_AI=claude`와 `ANTHROPIC_API_KEY`를 함께 설정하면 Claude가 세 번째 읽기/태그·문장 다듬기에 참여하고, 결과는 규칙 검증을 다시 거칩니다.

## 로컬 실행

```bash
cd apps/api && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```
```bash
cd apps/web && npm install && npm run dev
```
http://localhost:3000 — 같은 와이파이의 휴대폰에서는 `http://<PC IP>:3000` (카메라·마이크는 HTTPS 배포 주소에서만 동작)

### 테스트
```bash
cd apps/api && .venv/Scripts/python -m pytest -q
```
```bash
cd apps/web && node scripts/e2e.mjs http://localhost:3000
```
`e2e.mjs`는 헤드리스 Chrome 두 대(보호자·선생님)로 방 생성 → 매칭 → 요청·수락·모의 결제 → 통신문 OCR·3중 검증 → 실시간 영상(가상 카메라, WebRTC 수신 확인) → 활동 기록·리포트 발송 → 리포트 수신까지 실행하고 `docs/screens/`에 화면을 저장합니다.

## 배포 (Vercel + Render 무료)

1. **API — Render**: Dashboard → New → Blueprint → 이 저장소 선택 → `render.yaml`로 `teumbom-api` 생성
   - 배포 주소 예: `https://teumbom-api.onrender.com`
   - 무료 플랜은 15분 무사용 시 잠들고 첫 접속에 30~60초가 걸립니다(시작 화면에 “서버를 깨우는 중” 표시).
   - `DATABASE_URL`(Postgres)을 넣지 않으면 SQLite를 써서 재시작 시 시연 데이터가 초기화됩니다.
2. **웹 — Vercel**: 프로젝트 `teumbom`이 이 저장소(Root Directory `apps/web`)에 연결돼 있어 `main`에 푸시하면 자동 배포돼요. 환경변수 `NEXT_PUBLIC_API_URL=https://teumbom-api.onrender.com`
   - 현재 배포: https://teumbom.vercel.app (API: https://teumbom-api.onrender.com)
3. **QR**: Vercel 주소를 PC로 열면 시작 화면 오른쪽에 휴대폰용 QR이 표시됩니다. `docs/qr.png`도 생성해 둡니다.

### 이동통신망에서 영상이 안 보일 때
대부분의 와이파이 환경은 STUN만으로 연결되지만, 일부 LTE/5G 망은 TURN 서버가 필요합니다. Render 환경변수에 `TURN_URL`(쉼표로 여러 개), `TURN_USERNAME`, `TURN_CREDENTIAL`을 넣으면 자동으로 사용합니다(예: Metered·Cloudflare 무료 TURN).

## 시연 방법
1. 휴대폰 A로 QR → **보호자로 체험하기** → 새 시연 방이 만들어짐
2. PC 화면 사이드바의 QR(또는 방 코드)을 휴대폰 B로 찍기 → **선생님(김하늘)** 으로 같은 방 입장
3. A: 선생님 찾기(“곤충이랑 식물을 좋아해요”) → 맥락 매칭 → 요청(영상·녹화 선택) → B가 그 선생님이 되어 수락 → A: 모의 결제 → 통신문 올리기(예시 통신문) → 날짜 확인 → 전달
4. (선택) 영상 공유를 고른 경우 B도 동의 → B: 방문 시작(카메라 송출) → A: 실시간 보기 · 녹화(선택)
5. B: 할 일 체크 → 활동 기록(오늘 함께한 테마 활동, 음성 메모 가능) → 방문 종료 → 리포트 대조 후 발송 → A: 리포트 확인
한 대로 시연할 때는 상단의 **역할 전환**을 사용합니다.

## 개인정보·안전 원칙
통신문 사진은 기기 안에서만 읽고 서버에는 텍스트만 전송 · 원문과 결제·서명 항목은 선생님에게 비노출 · 상세 주소는 확정 후 담당 선생님에게만 공개 · 영상 공유·녹화는 모두 선택(녹화는 양측 허용 시 보호자 기기에만 저장), 동의 철회 시 즉시 중단 · 신원 확인·범죄경력 조회는 모든 선생님 필수 · 모의 결제(청구 0원) · 시크릿은 환경변수로만 설정

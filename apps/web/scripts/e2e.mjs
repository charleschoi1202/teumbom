// End-to-end demo run with two phones (guardian + teacher) in headless Chrome.
// Uses Chrome's fake camera so the WebRTC live view is exercised for real.
// Usage: node scripts/e2e.mjs [baseUrl] [outDir]
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] || "http://localhost:3000";
const OUT = process.argv[3] || path.resolve("../../docs/screens");
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
fs.mkdirSync(OUT, { recursive: true });

const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--autoplay-policy=no-user-gesture-required", "--lang=ko-KR", "--no-first-run"],
});

async function phone(name) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(MOBILE);
  page.on("pageerror", (e) => log(`[${name} pageerror]`, e.message));
  page.on("console", (m) => { if (m.type() === "error") log(`[${name} console]`, m.text().slice(0, 200)); });
  return page;
}

async function waitText(page, text, timeout = 20000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
}

async function click(page, text, { exact = false, timeout = 20000 } = {}) {
  const handle = await page.waitForFunction((t, ex) => {
    const els = [...document.querySelectorAll("button, a, [role=button]")];
    return els.find((e) => {
      const s = e.innerText.trim();
      const visible = e.offsetParent !== null && !e.disabled;
      return visible && (ex ? s === t : s.includes(t));
    }) || null;
  }, { timeout }, text, exact);
  await handle.asElement().click();
}

async function domClick(page, text) {
  const ok = await page.waitForFunction((t) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim().includes(t));
    if (!b) return false;
    b.scrollIntoView({ block: "center" });
    b.click();
    return true;
  }, { timeout: 20000 }, text);
  return ok;
}

async function shot(page, name) {
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  log("shot", name);
}

const results = [];
const check = (label, ok) => { results.push([label, ok]); log(ok ? "PASS" : "FAIL", label); };

try {
  const G = await phone("guardian");
  const T = await phone("teacher");

  // S01 → guardian account (no room codes: each phone is its own account)
  await G.goto(BASE, { waitUntil: "networkidle0" });
  await shot(G, "m01_S01_start");
  await click(G, "보호자로 체험하기");
  await G.waitForFunction(() => location.pathname === "/g/home", { timeout: 20000 });
  await waitText(G, "안녕하세요, 보호자님");
  await shot(G, "m02_S02_home");
  check("no room code in storage", !(await G.evaluate(() => localStorage.getItem("tb.room"))));
  check("no room-code link on S01", !(await G.evaluate(() => document.body.innerText)).includes("방 코드"));

  // teacher phone: demo teacher account (default 김하늘 — the teacher the guardian will pick)
  await T.goto(BASE, { waitUntil: "networkidle0" });
  await click(T, "선생님으로 체험하기");
  await T.waitForFunction(() => location.pathname === "/t/visits", { timeout: 20000 });
  await waitText(T, "선생님, 안녕하세요");

  // S03 → tags → S04 → S05 → S06
  await G.goto(`${BASE}/g/find`, { waitUntil: "networkidle0" });
  await click(G, "요청에서 태그 찾기");
  await G.type("textarea[placeholder^='예: 곤충']", "곤충이랑 식물을 좋아해요.");
  await waitText(G, "낯가림");
  await shot(G, "m03_S03_find_tags");
  await click(G, "이 조건으로 찾기");
  await waitText(G, "점");
  await waitText(G, "김하늘 선생님");
  await shot(G, "m04_S04_recommend");
  check("extra context reason shown", (await G.evaluate(() => document.body.innerText)).includes("추가 정보와 맞아요"));
  check("김하늘 recommended first", await G.evaluate(() => document.body.innerText.indexOf("김하늘 선생님") < document.body.innerText.indexOf("박다솜") || !document.body.innerText.includes("박다솜")));
  await click(G, "선생님 자세히 보기");
  await waitText(G, "우리 가정에 추천된 이유");
  await shot(G, "m05_S05_teacher");
  await click(G, "이 선생님께 방문 요청");
  await waitText(G, "이용 유형");
  await shot(G, "m06_S06_request");
  await click(G, "방문 요청 보내기");
  await waitText(G, "요청 중");
  await shot(G, "m07_S07_requested");

  // S13 teacher accepts (realtime push)
  await waitText(T, "응답 필요");
  await shot(T, "t01_S13_new_request");
  await click(T, "수락하기", { exact: true });
  await click(T, "내 방문");
  await waitText(T, "모의 결제를 기다려");
  await shot(T, "t02_S13_accepted");

  // guardian pays (P01 → P02)
  await waitText(G, "모의 결제하기");
  await shot(G, "m08_S07_payment");
  await click(G, "모의 결제하기");
  await waitText(G, "실제로 결제되지 않아요");
  await shot(G, "m09_P01_pay");
  await click(G, "70,000원 모의 결제", { exact: true });
  await G.waitForFunction(() => location.pathname.startsWith("/g/paid"), { timeout: 20000 });
  await waitText(G, "방문이 확정됐어요");
  await shot(G, "m10_P02_paid");
  await click(G, "확정한 방문 보기");
  await waitText(G, "등록한 통신문이 없어요");
  await shot(G, "m11_S07_booked");

  // S08 → OCR (on device) → S09
  await click(G, "통신문 올리기");
  await click(G, "예시 통신문으로 해보기");
  await waitText(G, "가정통신문 · 1쪽");
  await shot(G, "m12_S08_upload");
  await click(G, "할 일 찾기");
  await waitText(G, "통신문을 읽고 있어요", 10000);
  await shot(G, "m13_L01_reading");
  await G.waitForFunction(() => location.pathname.startsWith("/g/notice/") && !location.pathname.endsWith("/new"), { timeout: 180000 });
  await waitText(G, "선생님에게 보낼 할 일");
  await shot(G, "m14_S09_review");
  const review = await G.evaluate(() => document.body.innerText);
  check("OCR → 독서 기록장 task", review.includes("독서 기록장"));
  check("date conflict flagged", review.includes("확인할 날짜가"));
  if (review.includes("확인할 날짜가")) {
    await click(G, "항목 수정 · 원문 전체 보기");
    await waitText(G, "수정 완료");
    await shot(G, "m15_S09_edit");
    await click(G, "수정 완료");
    await G.waitForFunction(() => !document.body.innerText.includes("확인할 날짜가"), { timeout: 15000 }).catch(async () => {
      // OCR may have produced other low-confidence rows: confirm each against the source
      for (let i = 0; i < 5; i++) {
        const more = await G.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "원문 대조 완료"));
        if (!more) break;
        await click(G, "원문 대조 완료", { exact: true });
        await new Promise((r) => setTimeout(r, 600));
      }
    });
  }
  await shot(G, "m16_S09_verified");
  await click(G, "전달하기");
  await G.waitForFunction(() => location.pathname === "/g/visits", { timeout: 20000 });
  await waitText(G, "선생님에게 맡긴 일");
  await domClick(G, "이번 방문의 영상 공유에 동의해요");
  await new Promise((r) => setTimeout(r, 800));
  await shot(G, "m17_S07_approved");

  // teacher: S14 → consent → start (fake camera streams)
  await T.reload({ waitUntil: "networkidle0" });
  await click(T, "내 방문");
  await click(T, "방문 할 일 보기");
  await waitText(T, "보호자가 맡긴 학교 일");
  await shot(T, "t03_S14_tasks");
  await domClick(T, "이번 방문의 영상 공유에 동의해요");
  await waitText(T, "보호자는 영상 공유에 동의했어요");
  await click(T, "방문 시작", { exact: true });
  await waitText(T, "완료한 일만 체크해 주세요");
  await waitText(T, "영상 공유", 15000);

  // guardian S10 live view
  await G.goto(`${BASE}/g/visits`, { waitUntil: "networkidle0" });
  await click(G, "실시간 보기");
  const playing = await G.waitForFunction(() => {
    const v = document.querySelector("video");
    return v && v.videoWidth > 0 && v.readyState >= 2;
  }, { timeout: 45000 }).then(() => true).catch(() => false);
  check("WebRTC video received on guardian phone", playing);
  await shot(G, "m18_S10_live");
  await shot(T, "t04_S14_live_streaming");

  // teacher checks tasks, records, finishes
  for (const label of ["독서 기록장 챙기기", "숙제 확인", "독서"]) {
    await T.evaluate((l) => {
      const b = [...document.querySelectorAll("button[aria-pressed]")].find((x) => x.innerText.trim() === l);
      if (b && b.getAttribute("aria-pressed") === "false") b.click();
    }, label);
    await new Promise((r) => setTimeout(r, 300));
  }
  await shot(T, "t05_S14_done");
  await click(T, "활동 기록하기");
  await waitText(T, "방문 할 일에서 확인한 내용");
  const inputs = await T.$$("input[inputmode=numeric]");
  await inputs[0].type("2");
  await inputs[1].type("20");
  await shot(T, "t06_S15_record");
  await click(T, "방문 종료하기");
  await waitText(T, "방문을 마칠까요?");
  await shot(T, "t07_D02_finish");
  await T.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.innerText.includes("방문 종료하기")).click());
  await T.waitForFunction(() => location.pathname.endsWith("/report"), { timeout: 20000 });
  await waitText(T, "보호자에게 보낼 내용");
  await shot(T, "t08_S16_draft");
  const draft = await T.evaluate(() => document.querySelector("textarea")?.value || "");
  check("report draft grounded in record", draft.startsWith("숙제 2개를 확인하고, 책을 20분 동안 읽었어요."));
  await click(T, "활동 기록과 최종 내용을 대조했어요");
  await click(T, "확인한 리포트 보내기");
  await waitText(T, "보호자에게 보냈어요");
  await shot(T, "t09_S16_sent");

  // guardian receives report
  await G.goto(`${BASE}/g/reports`, { waitUntil: "networkidle0" });
  await waitText(G, "우리 아이의 방문 기록");
  await shot(G, "m19_S11_reports");
  await click(G, "리포트 보기");
  await waitText(G, "선생님이 남긴 말");
  await shot(G, "m20_S12_report");
  check("guardian sees sent report", (await G.evaluate(() => document.body.innerText)).includes("숙제"));

  // desktop layouts
  await G.setViewport(DESKTOP);
  for (const [p, n] of [["/g/home", "d01_guardian_home"], ["/g/visits", "d02_guardian_visits"], ["/g/reports", "d03_guardian_reports"]]) {
    await G.goto(BASE + p, { waitUntil: "networkidle0" });
    await shot(G, n);
  }
  await T.setViewport(DESKTOP);
  await T.goto(`${BASE}/t/visits`, { waitUntil: "networkidle0" });
  await click(T, "내 방문");
  await shot(T, "d04_teacher_visits");
  const desk = await browser.createBrowserContext();
  const D = await desk.newPage();
  await D.setViewport(DESKTOP);
  await D.goto(BASE, { waitUntil: "networkidle0" });
  await shot(D, "d00_S01_start_qr");
} catch (e) {
  log("ERROR", e.message);
  results.push(["run completed", false]);
} finally {
  await browser.close();
  const failed = results.filter(([, ok]) => !ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  for (const [l, ok] of results) console.log(ok ? "  ✓" : "  ✗", l);
  process.exit(failed.length ? 1 : 0);
}

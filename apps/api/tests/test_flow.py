import os
import pathlib

os.environ["DATABASE_URL"] = "sqlite:///./test_teumbom.db"
pathlib.Path("test_teumbom.db").unlink(missing_ok=True)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

NOTICE = (pathlib.Path(__file__).parent.parent / "eval" / "notices" / "sample_01.txt").read_text(encoding="utf-8")


def h(token):
    return {"Authorization": f"Bearer {token}"}


def test_full_visit_flow():
    with TestClient(app) as c:
        room = c.post("/api/rooms").json()
        g = h(room["token"])
        t = h(c.post(f"/api/rooms/{room['code']}/join", json={"role": "teacher"}).json()["token"])

        tags = c.post("/api/match/tags", headers=g, json={"text": "낯을 가려요. 숙제를 차분히 도와주시면 좋겠어요."}).json()["tags"]
        assert "낯가림" in tags and "숙제 지도" in tags

        rec = c.post("/api/match/recommend", headers=g, json={"date": "2026-11-20", "start": "15:00", "tags": tags}).json()
        top = rec["teachers"][0]
        assert top["name"] == "김하늘" and top["score"] >= 80 and top["reasons"]

        v = c.post("/api/visits", headers=g, json={"teacher_id": top["id"], "date": "2026-11-20", "start": "15:00",
                                                   "note": "숙제를 먼저 확인한 뒤 책을 읽어 주세요."}).json()
        assert v["status"] == "requested"
        assert c.get(f"/api/visits/{v['id']}", headers=t).json()["address"] is None  # 주소는 확정 전 비공개

        assert c.post(f"/api/visits/{v['id']}/accept", headers=t).json()["status"] == "payment"
        booked = c.post(f"/api/visits/{v['id']}/pay", headers=g).json()
        assert booked["status"] == "booked" and booked["address"]

        n = c.post(f"/api/visits/{v['id']}/notices", headers=g, json={"text": NOTICE}).json()
        pending = [i for i in n["items"] if i["status"] == "pending"]
        assert len(pending) == 1 and "11월 23일" in pending[0]["warning"]
        assert c.post(f"/api/notices/{n['id']}/approve", headers=g).status_code == 409
        assert c.get(f"/api/notices/{n['id']}", headers=t).status_code == 403  # 원문은 선생님에게 비노출

        c.patch(f"/api/notices/{n['id']}/items/{pending[0]['id']}", headers=g, json={"action": "edit", "due": "2026-11-23"})
        v2 = c.post(f"/api/notices/{n['id']}/approve", headers=g).json()
        assert v2["phase"] == "approved"
        teacher_view = c.get(f"/api/visits/{v['id']}", headers=t).json()
        assert all(task["owner"] == "teacher" for task in teacher_view["tasks"])  # 납부·서명은 선생님에게 안 감

        c.post(f"/api/visits/{v['id']}/consent", headers=g, json={"value": True})
        c.post(f"/api/visits/{v['id']}/consent", headers=t, json={"value": True})
        live = c.post(f"/api/visits/{v['id']}/start", headers=t).json()
        assert live["status"] == "live" and live["video_state"] == "ready"
        for task in live["tasks"]:
            if task["title"] in ("독서 기록장 챙기기", "숙제 확인", "독서"):
                c.patch(f"/api/tasks/{task['id']}", headers=t, json={"done": True})
        c.put(f"/api/visits/{v['id']}/record", headers=t, json={"homework": 2, "reading_min": 20, "memo": ""})
        c.post(f"/api/visits/{v['id']}/finish", headers=t)
        draft = c.post(f"/api/visits/{v['id']}/report/draft", headers=t).json()
        assert draft["message"].startswith("숙제 2개를 확인하고, 책을 20분 동안 읽었어요.")
        assert "독서 기록장" in draft["message"]
        assert "숙제 2개 · 독서 20분" in draft["activity"]

        assert c.post(f"/api/visits/{v['id']}/report/send", headers=t, json={"message": draft["message"], "confirmed": False}).status_code == 400
        c.post(f"/api/visits/{v['id']}/report/send", headers=t, json={"message": draft["message"], "confirmed": True})
        reports = c.get("/api/reports", headers=g).json()
        assert reports["reports"][0]["message"] == draft["message"]
        assert reports["week"]["reading_min"] == 20


def test_admin_review_and_alert():
    with TestClient(app) as c:
        a = h(c.post("/api/auth/admin").json()["token"])
        r = c.get("/api/admin/reviews", headers=a).json()["reviews"][0]
        assert r["extracted"]["name"] == "이가람" and "정교사(2급)" in r["extracted"]["qualification"]
        assert c.post(f"/api/admin/reviews/{r['id']}", headers=a, json={"action": "approve"}).status_code == 409
        c.post(f"/api/admin/reviews/{r['id']}", headers=a, json={"checked_original": True, "checked_crime": True})
        assert c.post(f"/api/admin/reviews/{r['id']}", headers=a, json={"action": "approve"}).json()["status"] == "approved"
        al = c.get("/api/admin/alerts", headers=a).json()["alerts"][0]
        done = c.post(f"/api/admin/alerts/{al['id']}", headers=a,
                      json={"action": "연락 후 확인", "memo": "선생님에게 도착 시각을 확인했어요.", "resolve": True}).json()
        assert done["status"] == "resolved"

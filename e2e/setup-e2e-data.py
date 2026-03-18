"""
E2E 데이터 세팅 스크립트 — Tenant 9999
강의 + 세션 + 수강등록 + 시험 + 채점 + 과제점수
"""
import requests
import json
from datetime import datetime, timedelta

API = "https://api.hakwonplus.com/api/v1"
TC = "9999"

def auth(u, p):
    r = requests.post(f"{API}/token/", json={"username": u, "password": p, "tenant_code": TC},
                       headers={"X-Tenant-Code": TC, "Content-Type": "application/json"})
    r.raise_for_status()
    return r.json()["access"]

def H(t):
    return {"Authorization": f"Bearer {t}", "X-Tenant-Code": TC, "Content-Type": "application/json; charset=utf-8"}

def main():
    token = auth("admin97", "kjkszpj123")
    print("Admin auth OK")

    STUDENT_ID = 1265
    LECTURE_ID = 1

    # === Enrollment ===
    # OPTIONS to see required fields
    r = requests.options(f"{API}/enrollments/", headers=H(token))
    print(f"Enrollments OPTIONS: allow={r.headers.get('Allow','?')}")

    # Try with tenant
    r = requests.post(f"{API}/enrollments/", headers=H(token), json={
        "student": STUDENT_ID,
        "lecture": LECTURE_ID,
        "tenant": 9999
    })
    print(f"Create enrollment: {r.status_code} {r.text[:300]}")

    if r.status_code != 201:
        # Maybe enrollment already exists — check via different endpoint
        r = requests.get(f"{API}/enrollments/", headers=H(token))
        data = r.json()
        print(f"All enrollments: count={data.get('count', '?')}")
        results = data.get("results", [])
        for e in results[:5]:
            print(f"  id={e.get('id')} student={e.get('student')} lecture={e.get('lecture')}")

        # Filter for our student
        for e in results:
            if e.get("student") == STUDENT_ID:
                print(f"Found enrollment for student: id={e['id']}")
                break

    # === Get sessions ===
    r = requests.get(f"{API}/lectures/sessions/?lecture={LECTURE_ID}", headers=H(token))
    sessions = r.json().get("results", [])
    print(f"\nSessions: {len(sessions)}")
    SESSION_IDS = [s["id"] for s in sessions[:3]]

    # === Create exams ===
    print("\n=== Creating exams ===")
    exam_ids = []
    for i, sid in enumerate(SESSION_IDS):
        title = f"E2E Exam {i+1}"
        r = requests.post(f"{API}/exams/exams/", headers=H(token), json={
            "title": title,
            "sessions": [sid],
            "status": "OPEN",
            "max_score": 100,
            "pass_score": 60,
            "allow_retake": i == 0,  # first exam allows retake
            "max_attempts": 3 if i == 0 else 1,
            "answer_visibility": "always" if i < 2 else "hidden",
        })
        print(f"  Exam '{title}': {r.status_code}")
        if r.status_code == 201:
            eid = r.json()["id"]
            exam_ids.append(eid)
            print(f"    id={eid}")
        else:
            print(f"    {r.text[:200]}")

    if not exam_ids:
        # Check existing
        r = requests.get(f"{API}/exams/exams/", headers=H(token))
        exams = r.json().get("results", [])
        exam_ids = [e["id"] for e in exams[:3]]
        print(f"  Using existing exams: {exam_ids}")

    # === Create answer keys & questions ===
    print("\n=== Answer keys ===")
    for eid in exam_ids:
        answers = {str(q): str((q * 3) % 5 + 1) for q in range(1, 11)}
        r = requests.put(f"{API}/exams/exams/{eid}/answer-key/", headers=H(token), json={
            "answers": answers,
            "question_count": 10,
            "score_per_question": 10
        })
        print(f"  Exam {eid} answer key: {r.status_code}")
        if r.status_code >= 400:
            print(f"    {r.text[:200]}")

    # === Manual score entry ===
    print("\n=== Scoring ===")
    # Get enrollment ID
    r = requests.get(f"{API}/enrollments/", headers=H(token))
    all_enrollments = r.json().get("results", [])
    enrollment_id = None
    for e in all_enrollments:
        if e.get("student") == STUDENT_ID:
            enrollment_id = e["id"]
            break

    if not enrollment_id:
        print("No enrollment found! Cannot score.")
        # Try to find enrollment differently
        stu_token = auth("01099990001", "test1234")
        r = requests.get(f"{API}/student/me/", headers=H(stu_token))
        me = r.json()
        print(f"Student me: {json.dumps(me, ensure_ascii=False)[:500]}")
        return

    print(f"Enrollment ID: {enrollment_id}")

    scores = [85, 72, 45]  # pass, pass, fail
    for i, eid in enumerate(exam_ids):
        score = scores[i] if i < len(scores) else 70
        # Find the session for this exam
        r = requests.get(f"{API}/exams/exams/{eid}/", headers=H(token))
        exam = r.json()
        exam_sessions = exam.get("sessions", [])
        session_id = exam_sessions[0] if exam_sessions else SESSION_IDS[0]

        # Enter total score
        r = requests.patch(
            f"{API}/results/admin/sessions/{session_id}/exams/{eid}/scores/total/",
            headers=H(token),
            json={
                "enrollment_id": enrollment_id,
                "total_score": score
            }
        )
        print(f"  Exam {eid} score={score}: {r.status_code}")
        if r.status_code >= 400:
            print(f"    {r.text[:200]}")

    # === Homework scores ===
    print("\n=== Homework scores ===")
    # Check homeworks
    r = requests.get(f"{API}/exams/homeworks/", headers=H(token))
    print(f"Homeworks endpoint: {r.status_code} {r.text[:200]}")

    # Create homeworks if endpoint allows
    hw_ids = []
    for i, sid in enumerate(SESSION_IDS):
        r = requests.post(f"{API}/exams/homeworks/", headers=H(token), json={
            "title": f"E2E Homework {i+1}",
            "sessions": [sid],
            "status": "OPEN",
            "max_score": 50,
        })
        if r.status_code == 201:
            hw_ids.append(r.json()["id"])
            print(f"  Created homework {r.json()['id']}")
        else:
            print(f"  Homework create: {r.status_code} {r.text[:150]}")

    # Enter homework scores
    hw_scores = [45, 30, 20]
    for i, hwid in enumerate(hw_ids):
        sc = hw_scores[i] if i < len(hw_scores) else 25
        r = requests.patch(
            f"{API}/results/admin/sessions/{SESSION_IDS[i]}/homeworks/{hwid}/scores/",
            headers=H(token),
            json={
                "enrollment_id": enrollment_id,
                "score": sc
            }
        )
        print(f"  Homework {hwid} score={sc}: {r.status_code}")
        if r.status_code >= 400:
            print(f"    {r.text[:200]}")

    # === Final student check ===
    print("\n=== Final student grades ===")
    stu_token = auth("01099990001", "test1234")
    r = requests.get(f"{API}/student/grades/", headers=H(stu_token))
    if r.status_code == 200:
        g = r.json()
        print(f"Exams: {len(g.get('exams', []))}")
        for e in g.get("exams", []):
            print(f"  {e.get('title','?')}: {e.get('total_score')}/{e.get('max_score')} pass={e.get('is_pass')}")
        print(f"Homeworks: {len(g.get('homeworks', []))}")
        for hw in g.get("homeworks", []):
            print(f"  {hw.get('title','?')}: {hw.get('score')}/{hw.get('max_score')} pass={hw.get('passed')}")
    else:
        print(f"Grades: {r.status_code} {r.text[:300]}")

if __name__ == "__main__":
    main()

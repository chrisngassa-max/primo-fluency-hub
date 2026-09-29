"""Explicit, operator-driven HTTP/JWT security test. Never applies a migration.

Requires bcrypt. Run with --serve; controller calls loopback /manifest, /login,
/test, /logout, /shutdown. Passwords/JWTs live only in process memory.
Manifest contains salted password hashes for administrative fixture creation;
never persist it. Auth tokens are obtained normally from /auth/v1/token.
Use the matching manifest UUIDs for administrative cleanup even on failure.
"""
import concurrent.futures
import json
import secrets
import threading
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import bcrypt

BASE = "https://gudcenhmzlcvhgbgklzw.supabase.co"
# Public browser key, never service_role. No Authorization header in anon cases.
KEY = "sb_publishable_z1FGsdO6Zql1fcfVud3gZg_YSLzjaHW"
USERS = {}
for name, role in [("A", "formateur"), ("B", "formateur"), ("C", "eleve"), ("D", "admin")]:
    uid = str(uuid.uuid4())
    password = secrets.token_urlsafe(36)
    USERS[name] = dict(id=uid, email=f"review-{uid}@example.invalid", role=role,
                       password=password, password_hash=bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode())
SOURCES = {name: str(uuid.uuid4()) for name in ["good", "foreign", "no_hash", "no_transcription", "unreviewed", "no_analysis", "no_rights", "concurrent"]}
RESULTS = []

def request(method, path, actor=None, payload=None):
    headers = {"apikey": KEY, "Content-Type": "application/json", "Prefer": "return=representation"}
    if actor:
        headers["Authorization"] = "Bearer " + USERS[actor]["token"]
    req = Request(BASE + path, headers=headers, method=method,
                  data=None if payload is None else json.dumps(payload).encode())
    try:
        with urlopen(req, timeout=30) as response:
            text = response.read().decode()
            return response.status, json.loads(text) if text else None
    except HTTPError as error:
        text = error.read().decode()
        return error.code, json.loads(text) if text else None

def manifest():
    return {"users": {name: {k: v for k, v in user.items() if k in ("id", "email", "role", "password_hash")} for name, user in USERS.items()}, "sources": SOURCES}

def login():
    result = []
    for actor, user in USERS.items():
        status, data = request("POST", "/auth/v1/token?grant_type=password", payload={"email": user["email"], "password": user["password"]})
        if status != 200 or not data.get("access_token"):
            raise RuntimeError(f"Auth {actor}: HTTP {status}, code {data.get('error_code', data.get('code'))}")
        user["token"] = data["access_token"]
        # Do not retain/print refresh tokens, Auth responses, or passwords in evidence.
        result.append({"actor": actor, "http": status, "authenticated_user_matches": data["user"]["id"] == user["id"]})
    return result

def source(name, actor="A"):
    status, data = request("GET", f"/rest/v1/pedagogical_sources?id=eq.{SOURCES[name]}&select=id,review_status,updated_at,title", actor)
    if status != 200 or len(data) != 1:
        raise RuntimeError(f"Source read {name}: HTTP {status}")
    return data[0]

def rpc(actor, name="good", version=None):
    if version is None:
        version = source(name, "B" if name == "foreign" else "A")["updated_at"]
    return request("POST", "/rest/v1/rpc/mark_pedagogical_source_usable", actor,
                   dict(p_source_id=SOURCES[name], p_confirmed=True, p_expected_updated_at=version))

def check(label, response, predicate):
    status, data = response
    passed = predicate(status, data)
    RESULTS.append({"test": label, "http": status, "code": data.get("code") if isinstance(data, dict) else None,
                    "business": data.get("message") if isinstance(data, dict) else None, "passed": passed})
    if not passed:
        raise RuntimeError(f"STOP {label}: HTTP {status}; see redacted results")
    return data

def run_tests():
    def error(code, business=None):
        return lambda status, data: status in (400, 401, 403) and isinstance(data, dict) and data.get("code") == code and (business is None or data.get("message") == business)
    def patch(actor, value):
        return request("PATCH", f"/rest/v1/pedagogical_sources?id=eq.{SOURCES['good']}", actor, value)
    version = source("good")["updated_at"]
    check("anon RPC", rpc(None, version=version), error("42501"))
    check("anon PATCH", patch(None, {"review_status": "utilisable"}), error("42501"))
    for actor, business in [("C", "STAFF_ROLE_REQUIRED"), ("B", "SOURCE_FORBIDDEN")]:
        check(f"{actor} RPC", rpc(actor, version=version), error("42501", business))
        check(f"{actor} PATCH RLS zero rows", patch(actor, {"review_status": "utilisable"}), lambda s,d: s == 200 and d == [])
        assert source("good")["review_status"] == "brouillon"
    check("owner direct PATCH", patch("A", {"review_status": "utilisable"}), error("42501", "SOURCE_REVIEW_DIRECT_WRITE_FORBIDDEN"))
    check("owner PATCH valide", patch("A", {"review_status": "valide"}), error("42501", "SOURCE_REVIEW_DIRECT_WRITE_FORBIDDEN"))
    check("owner legitimate title PATCH", patch("A", {"title": "HTTP test edit"}), lambda s,d: s == 200 and len(d) == 1 and d[0]["title"] == "HTTP test edit")
    for name, business in [("no_hash", "SOURCE_HASH_REQUIRED"), ("no_transcription", "TRANSCRIPTION_NOT_FOUND"), ("unreviewed", "REVIEWED_TRANSCRIPTION_REQUIRED"), ("no_analysis", "SOURCE_NOT_ANALYZED"), ("no_rights", "SOURCE_RIGHTS_REQUIRED")]:
        check(name, rpc("A", name), error("P0001", business))
        assert source(name)["review_status"] == "brouillon"
    version = source("good")["updated_at"]
    first = check("owner RPC", rpc("A", version=version), lambda s,d: s == 200 and len(d) == 1 and d[0]["changed"] and d[0]["review_status"] == "utilisable")
    second = check("owner idempotence", rpc("A", version=version), lambda s,d: s == 200 and len(d) == 1 and not d[0]["changed"])
    assert first[0]["updated_at"] == second[0]["updated_at"]
    check("app admin non-owner RPC", rpc("D", "foreign"), lambda s,d: s == 200 and len(d) == 1 and d[0]["changed"])
    version = source("concurrent")["updated_at"]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        barrier = threading.Barrier(2)
        def simultaneous():
            barrier.wait(timeout=5)
            return rpc("A", "concurrent", version)
        calls = list(executor.map(lambda _: simultaneous(), range(2)))
    changes = []
    for index, response in enumerate(calls):
        data = check(f"concurrent RPC {index + 1}", response, lambda s,d: s == 200 and len(d) == 1 and d[0]["review_status"] == "utilisable")
        changes.append(data[0]["changed"])
    assert sorted(changes) == [False, True]
    assert source("concurrent")["review_status"] == "utilisable"
    return {"passed": True, "results": RESULTS, "concurrent_changes": sorted(changes)}

def logout():
    statuses = []
    for actor, user in USERS.items():
        if "token" in user:
            status, _ = request("POST", "/auth/v1/logout?scope=global", actor)
            statuses.append({"actor": actor, "http": status})
        user.pop("token", None)
        user.pop("password", None)
        user.pop("password_hash", None)
    return statuses

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def do_POST(self):
        try:
            action = {"/manifest": manifest, "/login": login, "/test": run_tests, "/logout": logout}.get(self.path)
            if self.path == "/shutdown":
                USERS.clear()
                result = {"memory_cleared": True}
                threading.Thread(target=self.server.shutdown).start()
            elif action:
                result = action()
            else:
                raise RuntimeError("Unknown action")
            code = 200
        except Exception as error:
            code, result = 500, {"error": str(error), "results": RESULTS}
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--serve", action="store_true", required=True)
    parser.parse_args()
    print("Loopback controller ready on 127.0.0.1:18761; no credentials logged", flush=True)
    HTTPServer(("127.0.0.1", 18761), Handler).serve_forever()

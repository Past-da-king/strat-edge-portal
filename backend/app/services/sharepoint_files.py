"""Microsoft Graph file access for the Portal (Strat Edge Company Docs site).

Uses the same Entra app the Mthashana CRM uses ("Mthashana CRM - MOU Sync"):
client credentials, Sites.Selected with write on /sites/CompanyDocs only.
"""
import os
import re
import time
from typing import Optional, Tuple
from urllib.parse import quote

import httpx

GRAPH = "https://graph.microsoft.com/v1.0"
TENANT_ID = os.getenv("MS_GRAPH_TENANT_ID", "")
CLIENT_ID = os.getenv("MS_GRAPH_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("MS_GRAPH_CLIENT_SECRET", "")
SITE = os.getenv("SHAREPOINT_SITE", "stratedgesolutions.sharepoint.com:/sites/CompanyDocs")

PREFIX = "sp:"
SIMPLE_MAX = 4 * 1024 * 1024
CHUNK = 10 * 320 * 1024          # upload-session chunks must be multiples of 320 KiB

_token = {"value": None, "exp": 0.0}
_drive = {}


class SharePointError(RuntimeError):
    pass


def configured() -> bool:
    return bool(TENANT_ID and CLIENT_ID and CLIENT_SECRET)


def is_key(path: Optional[str]) -> bool:
    return bool(path) and path.startswith(PREFIX)


def make_key(item_id: str, name: str) -> str:
    return f"{PREFIX}{item_id}:{name}"


def parse_key(key: str) -> Tuple[str, str]:
    item_id, _, name = key[len(PREFIX):].partition(":")
    return item_id, name or "document"


def clean(name: str, fallback: str = "document") -> str:
    out = re.sub(r'[\\/:*?"<>|#%\x00-\x1f]+', " ", name or "").strip(" .")
    return re.sub(r"\s{2,}", " ", out)[:150] or fallback


def _access_token() -> str:
    if _token["value"] and time.time() < _token["exp"] - 120:
        return _token["value"]
    res = httpx.post(f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
                     data={"client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
                           "grant_type": "client_credentials",
                           "scope": "https://graph.microsoft.com/.default"}, timeout=20)
    if res.status_code != 200:
        raise SharePointError(f"Microsoft sign-in failed ({res.status_code}).")
    body = res.json()
    _token.update(value=body["access_token"], exp=time.time() + int(body.get("expires_in", 3600)))
    return _token["value"]


def graph(method: str, path: str, **kw) -> httpx.Response:
    url = path if path.startswith("https://") else GRAPH + path
    headers = {"Authorization": f"Bearer {_access_token()}", **kw.pop("headers", {})}
    return httpx.request(method, url, headers=headers, timeout=kw.pop("timeout", 30),
                         follow_redirects=True, **kw)


def drive_id() -> str:
    if "id" not in _drive:
        site = graph("GET", f"/sites/{SITE}?$select=id")
        if site.status_code != 200:
            raise SharePointError(f"SharePoint site not reachable ({site.status_code}).")
        d = graph("GET", f"/sites/{site.json()['id']}/drive?$select=id")
        if d.status_code != 200:
            raise SharePointError(f"SharePoint library not reachable ({d.status_code}).")
        _drive["id"] = d.json()["id"]
    return _drive["id"]


def put(folder: str, name: str, data: bytes, content_type: Optional[str] = None) -> dict:
    """Upload to <folder>/<name> in the library (folders are created as needed).
    A name already taken is renamed, never overwritten. Returns the driveItem."""
    folder = "/".join(clean(p, "Files") for p in (folder or "").split("/") if p.strip())
    rel = quote(f"{folder}/{clean(name)}")
    qs = "?@microsoft.graph.conflictBehavior=rename"
    drive = drive_id()
    try:
        if len(data) <= SIMPLE_MAX:
            res = graph("PUT", f"/drives/{drive}/root:/{rel}:/content{qs}", content=data, timeout=90,
                        headers={"Content-Type": content_type or "application/octet-stream"})
            if res.status_code not in (200, 201):
                raise SharePointError(f"SharePoint refused the file ({res.status_code}): {res.text[:160]}")
            return res.json()
        sess = graph("POST", f"/drives/{drive}/root:/{rel}:/createUploadSession",
                     json={"item": {"@microsoft.graph.conflictBehavior": "rename"}})
        if sess.status_code != 200:
            raise SharePointError(f"SharePoint would not start the upload ({sess.status_code}).")
        url, total, done = sess.json()["uploadUrl"], len(data), 0
        while done < total:
            chunk = data[done:done + CHUNK]
            r = httpx.put(url, content=chunk, timeout=120, headers={
                "Content-Length": str(len(chunk)),
                "Content-Range": f"bytes {done}-{done + len(chunk) - 1}/{total}"})
            if r.status_code not in (200, 201, 202):
                raise SharePointError(f"SharePoint upload stopped at byte {done} ({r.status_code}).")
            done += len(chunk)
            if r.status_code in (200, 201):
                return r.json()
        raise SharePointError("SharePoint upload ended without a file.")
    except SharePointError:
        raise
    except Exception as e:
        raise SharePointError(f"SharePoint could not be reached: {str(e)[:160]}") from e


def item(key: str) -> Optional[dict]:
    item_id, _ = parse_key(key)
    res = graph("GET", f"/drives/{drive_id()}/items/{item_id}"
                       "?$select=id,name,webUrl,size,@microsoft.graph.downloadUrl", timeout=20)
    return res.json() if res.status_code == 200 else None


def read(key: str) -> bytes:
    item_id, _ = parse_key(key)
    res = graph("GET", f"/drives/{drive_id()}/items/{item_id}/content", timeout=90)
    if res.status_code != 200:
        raise SharePointError(f"SharePoint could not return the file ({res.status_code}).")
    return res.content


def browser_url(key: str, inline: bool = False) -> str:
    it = item(key)
    if not it:
        raise SharePointError("The file is no longer in SharePoint.")
    if inline:
        item_id, _ = parse_key(key)
        res = graph("POST", f"/drives/{drive_id()}/items/{item_id}/preview", json={}, timeout=30)
        if res.status_code == 200 and res.json().get("getUrl"):
            return res.json()["getUrl"]
    # A short-lived link that downloads the file with no further sign-in: the
    # redirect target of /content, not followed.
    item_id, _ = parse_key(key)
    res = httpx.get(f"{GRAPH}/drives/{drive_id()}/items/{item_id}/content",
                    headers={"Authorization": f"Bearer {_access_token()}"}, timeout=30,
                    follow_redirects=False)
    if res.status_code in (301, 302, 303, 307) and res.headers.get("location"):
        return res.headers["location"]
    return it.get("@microsoft.graph.downloadUrl") or it["webUrl"]


def delete(key: str) -> None:
    item_id, _ = parse_key(key)
    graph("DELETE", f"/drives/{drive_id()}/items/{item_id}", timeout=20)

"""Where the Portal's files live.

OPERATOR RULING (Ayanda, 7 Oct 2026): every document in a Strat Edge system goes
to SharePoint (Company Docs site) the moment it is added, in the project's own
folder. No cloud bucket, no blob store.

upload_file() saves to SharePoint and returns the key "sp:<driveItemId>:<name>",
which is what gets stored in file_path. get_signed_url() / delete_file() take
that key back. Rows saved before the move hold a Google Cloud Storage path
("projects/1/tasks/11/x.pdf"); those still resolve through GCS until
scripts/migrate_gcs_to_sharepoint.py (or POST /admin/migrate-files) has moved
them, so nothing breaks in between.

Where a file goes is decided in app/services/file_locations.py.
"""
import os
from datetime import timedelta
from typing import Optional

from ..core.config import settings
from . import sharepoint_files as sp


def is_sp(path: Optional[str]) -> bool:
    return sp.is_key(path)


class StorageService:
    _client = None

    # ── legacy Google Cloud Storage (read/delete of old rows only) ──────────
    @classmethod
    def get_client(cls):
        if cls._client is None:
            from google.cloud import storage
            if os.path.exists(settings.GOOGLE_APPLICATION_CREDENTIALS):
                cls._client = storage.Client.from_service_account_json(settings.GOOGLE_APPLICATION_CREDENTIALS)
            else:
                cls._client = storage.Client(project=settings.GCP_PROJECT_ID)
        return cls._client

    @classmethod
    def read_legacy(cls, file_path: str) -> Optional[bytes]:
        """Bytes of a file still in the old bucket, or None when it is not there."""
        blob = cls.get_client().bucket(settings.GCP_BUCKET_NAME).blob(file_path)
        return blob.download_as_bytes() if blob.exists() else None

    # ── the store ───────────────────────────────────────────────────────────
    @classmethod
    def upload_file(cls, file_content: bytes, destination_path: str, content_type: str = None,
                    folder: Optional[str] = None, name: Optional[str] = None) -> str:
        """Save to SharePoint and return the key to store in file_path.

        `folder` is the full folder inside the Company Docs library (see
        file_locations); `name` is the file name. When SharePoint is not
        configured (a laptop with no Microsoft credentials) this raises: files are
        never silently put anywhere else.
        """
        if not sp.configured():
            raise RuntimeError("SharePoint is not configured: set MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID "
                               "and MS_GRAPH_CLIENT_SECRET.")
        fname = name or os.path.basename(destination_path)
        item = sp.put(folder or "10 Projects/02 Internal Operations and Meetings/Unfiled",
                      fname, file_content, content_type)
        return sp.make_key(item["id"], item.get("name") or fname)

    @classmethod
    def get_signed_url(cls, file_path: str, expiration_minutes: int = 60, inline: bool = False) -> str:
        """A short-lived link the browser can open.

        SharePoint: Microsoft's own pre-authenticated link (good for about an hour);
        inline asks for the embeddable preview so a PDF or image opens in the page.
        Old GCS rows: a signed Google link, as before.
        """
        if is_sp(file_path):
            return sp.browser_url(file_path, inline=inline)
        client = cls.get_client()
        blob = client.bucket(settings.GCP_BUCKET_NAME).blob(file_path)
        disposition = "inline" if inline else "attachment"
        return blob.generate_signed_url(
            version="v4", expiration=timedelta(minutes=expiration_minutes), method="GET",
            response_disposition=f"{disposition}; filename=\"{os.path.basename(file_path)}\"")

    @classmethod
    def delete_file(cls, file_path: str):
        if is_sp(file_path):
            sp.delete(file_path)
            return
        blob = cls.get_client().bucket(settings.GCP_BUCKET_NAME).blob(file_path)
        if blob.exists():
            blob.delete()

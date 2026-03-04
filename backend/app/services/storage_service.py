import os
from google.cloud import storage
from datetime import datetime, timedelta
from ..core.config import settings

class StorageService:
    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is None:
            print(f"DEBUG: Initializing GCS Client with: {settings.GOOGLE_APPLICATION_CREDENTIALS}")
            abs_path = os.path.abspath(settings.GOOGLE_APPLICATION_CREDENTIALS)
            print(f"DEBUG: Absolute path: {abs_path}")
            
            if os.path.exists(settings.GOOGLE_APPLICATION_CREDENTIALS):
                try:
                    cls._client = storage.Client.from_service_account_json(
                        settings.GOOGLE_APPLICATION_CREDENTIALS
                    )
                    print("DEBUG: GCS Client initialized successfully")
                except Exception as e:
                    print(f"DEBUG: GCS Initialization Error: {str(e)}")
                    raise e
            else:
                # Fallback to default auth (useful for production environments with env vars)
                cls._client = storage.Client(project=settings.GCP_PROJECT_ID)
        return cls._client

    @classmethod
    def upload_file(cls, file_content: bytes, destination_path: str, content_type: str = None) -> str:
        """
        Uploads a file to GCS and returns the path.
        """
        client = cls.get_client()
        bucket = client.bucket(settings.GCP_BUCKET_NAME)
        blob = bucket.blob(destination_path)
        
        blob.upload_from_string(file_content, content_type=content_type)
        return destination_path

    @classmethod
    def get_signed_url(cls, file_path: str, expiration_minutes: int = 60, inline: bool = False) -> str:
        """
        Generates a temporary signed URL for secure access to a private file.
        If inline is True, the file will be viewable in-browser rather than downloaded.
        """
        client = cls.get_client()
        bucket = client.bucket(settings.GCP_BUCKET_NAME)
        blob = bucket.blob(file_path)

        disposition = "inline" if inline else "attachment"

        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiration_minutes),
            method="GET",
            response_disposition=f"{disposition}; filename=\"{os.path.basename(file_path)}\""
        )
        return url


    @classmethod
    def delete_file(cls, file_path: str):
        """
        Deletes a file from GCS.
        """
        client = cls.get_client()
        bucket = client.bucket(settings.GCP_BUCKET_NAME)
        blob = bucket.blob(file_path)
        if blob.exists():
            blob.delete()

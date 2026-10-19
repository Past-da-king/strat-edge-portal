from pydantic import BaseModel, ConfigDict, field_validator
from datetime import date, datetime
from typing import Optional, List

from ..models.database import TENDER_CATEGORIES, TENDER_STATUSES


class TenderDocument(BaseModel):
    """One file attached to a brief, as the watcher filed it."""
    name: str
    url: Optional[str] = None
    local_path: Optional[str] = None
    size_bytes: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class TenderBriefBase(BaseModel):
    """The brief exactly as the tender watcher posts it.

    Only id and title are compulsory. A watcher that has not managed to read a
    closing date, or a portal that gives no reference, should still get its
    brief filed rather than have the whole batch refused: an incomplete brief a
    person can see beats a rejected one nobody hears about.
    """

    id: str
    title: str
    reference: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    buyer: Optional[str] = None
    category: Optional[str] = "Other"
    published: Optional[date] = None
    closing: Optional[date] = None
    days_to_close: Optional[int] = None
    amount: Optional[str] = None                      # "R 1 200 000", kept as written
    summary: Optional[str] = None
    requirements: List[str] = []
    documents: List[TenderDocument] = []
    relevance_score: Optional[int] = 0
    relevance_reason: Optional[str] = None
    status: Optional[str] = "new"
    created_at: Optional[datetime] = None

    @field_validator("category")
    @classmethod
    def known_category(cls, v):
        if v in (None, ""):
            return "Other"
        if v not in TENDER_CATEGORIES:
            raise ValueError(f"category must be one of {TENDER_CATEGORIES}")
        return v

    @field_validator("status")
    @classmethod
    def known_status(cls, v):
        if v in (None, ""):
            return "new"
        if v not in TENDER_STATUSES:
            raise ValueError(f"status must be one of {TENDER_STATUSES}")
        return v

    @field_validator("amount", mode="before")
    @classmethod
    def amount_is_text(cls, v):
        # Kept as text on purpose: some portals say "R 1,2m", others "R 1200000",
        # and flattening those to a number would invent a precision we do not have.
        if v is None or isinstance(v, str):
            return v
        return str(v)

    @field_validator("requirements", mode="before")
    @classmethod
    def requirements_may_be_absent(cls, v):
        return v or []

    @field_validator("documents", mode="before")
    @classmethod
    def documents_may_be_absent(cls, v):
        return v or []


class TenderBriefIn(TenderBriefBase):
    pass


class TenderBrief(TenderBriefBase):
    """A stored brief on its way out."""
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TenderIngest(BaseModel):
    """The watcher's batch. Posting the same brief again updates it."""
    briefs: List[TenderBriefIn]


class TenderIngestResult(BaseModel):
    received: int
    created: int
    updated: int
    ids: List[str]

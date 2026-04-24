from pydantic import BaseModel


class MultipartInitRequest(BaseModel):
    key: str
    content_type: str = "application/octet-stream"
    file_size: int  # total bytes


class MultipartInitResponse(BaseModel):
    upload_id: str
    key: str
    part_size: int
    num_parts: int
    urls: list[str]


class PartETag(BaseModel):
    part_number: int
    etag: str


class MultipartCompleteRequest(BaseModel):
    key: str
    upload_id: str
    parts: list[PartETag]


class MultipartAbortRequest(BaseModel):
    key: str
    upload_id: str


class PresignDownloadRequest(BaseModel):
    key: str


class PresignDownloadResponse(BaseModel):
    url: str

from pydantic import BaseModel, model_validator


class AuthConfig(BaseModel):
    enable_local_auth: bool
    enable_azure_ad: bool


class AuthConfigUpdate(BaseModel):
    enable_local_auth: bool
    enable_azure_ad: bool

    @model_validator(mode="after")
    def at_least_one_enabled(self) -> "AuthConfigUpdate":
        if not self.enable_local_auth and not self.enable_azure_ad:
            raise ValueError("At least one authentication method must be enabled")
        return self


class AzureAdConfig(BaseModel):
    tenant_id: str
    client_id: str
    redirect_uri: str
    has_secret: bool  # secret is write-only; this flag shows if one is configured


class AzureAdConfigUpdate(BaseModel):
    tenant_id: str
    client_id: str
    client_secret: str | None = None  # None = keep existing secret
    redirect_uri: str


# ── S3 connection ─────────────────────────────────────────────────────────────

class S3ConnectionConfig(BaseModel):
    provider: str  # "aws" | "minio" | "custom"
    access_key_id: str
    region: str
    endpoint_url: str
    presigned_base: str
    use_ssl: bool
    has_secret: bool           # secret is write-only
    configured: bool           # true when an admin-saved (DB) connection is active
    source: str                # "db" | "env"


class S3ConnectionUpdate(BaseModel):
    provider: str = "aws"
    access_key_id: str
    secret_access_key: str | None = None  # None = keep existing secret
    region: str = "us-east-1"
    endpoint_url: str = ""
    presigned_base: str = ""
    use_ssl: bool = True


# ── Generic auth providers (github / saml / …) ────────────────────────────────

class AuthProvider(BaseModel):
    id: str                    # "github" | "saml" | …
    name: str                  # display name
    type: str                  # "oauth2" | "saml"
    enabled: bool
    configured: bool
    has_secret: bool
    config: dict               # non-secret config fields


class AuthProviderUpdate(BaseModel):
    enabled: bool = False
    config: dict = {}
    secret: str | None = None  # None = keep existing secret

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

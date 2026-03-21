from pydantic import BaseModel


class UserMeRead(BaseModel):
    id: int
    email: str
    name: str | None = None
    role: str
    dojo_id: int | None
    avatar_url: str | None = None
    graduacao: str | None = None
    fcm_token: str | None = None

    class Config:
        from_attributes = True


class AvatarUpdate(BaseModel):
    avatar_url: str | None = None
    name: str | None = None
    fcm_token: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

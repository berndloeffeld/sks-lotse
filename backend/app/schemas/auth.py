from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class OtpRequestCreate(BaseModel):
    email: EmailStr


class OtpRequestAccepted(BaseModel):
    detail: str = "A login code has been sent if delivery was possible."


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str


class TokenRead(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: datetime

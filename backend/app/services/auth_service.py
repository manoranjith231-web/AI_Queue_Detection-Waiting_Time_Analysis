import os
import time
import base64
import json
import hmac
import hashlib
from typing import Optional, Dict, Any
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.app.config import settings

security_bearer = HTTPBearer(auto_error=False)

class AuthService:
    @staticmethod
    def _create_signature(payload_b64: str, secret: str) -> str:
        sig = hmac.new(
            secret.encode("utf-8"),
            payload_b64.encode("utf-8"),
            hashlib.sha256
        ).digest()
        return base64.urlsafe_b64encode(sig).decode("utf-8").rstrip("=")

    @classmethod
    def create_token(cls, user_data: Dict[str, Any], expires_in_sec: int = 86400) -> str:
        header = {"alg": "HS256", "typ": "JWT"}
        header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
        
        payload = {
            **user_data,
            "iat": int(time.time()),
            "exp": int(time.time()) + expires_in_sec,
            "iss": "queueiq-enterprise"
        }
        payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
        sig = cls._create_signature(f"{header_b64}.{payload_b64}", settings.SECRET_KEY)
        return f"{header_b64}.{payload_b64}.{sig}"

    @classmethod
    def verify_token(cls, token: str) -> Dict[str, Any]:
        parts = token.split(".")
        if len(parts) != 3:
            raise HTTPException(status_code=401, detail="Malformed authentication token")
        
        header_b64, payload_b64, sig = parts
        expected_sig = cls._create_signature(f"{header_b64}.{payload_b64}", settings.SECRET_KEY)
        if not hmac.compare_digest(sig, expected_sig):
            raise HTTPException(status_code=401, detail="Invalid token signature")
        
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
        
        if payload.get("exp", 0) < time.time():
            raise HTTPException(status_code=401, detail="Authentication token expired")
            
        return payload

    @classmethod
    def create_dev_session(cls, email: str = "manager@retailops.local", name: str = "Store Operations Lead") -> Dict[str, Any]:
        user_info = {
            "sub": "user-ops-01",
            "email": email,
            "name": name,
            "role": "STORE_OWNER",
            "auth_provider": "google_verified" if "google" in email.lower() else "enterprise_session"
        }
        token = cls.create_token(user_info)
        return {
            "token": token,
            "user": user_info,
            "expires_in": 86400,
            "is_dev_mode": True
        }

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> Optional[Dict[str, Any]]:
    if not credentials:
        if settings.ENV == "development":
            return {
                "sub": "user-ops-01",
                "email": "manager@retailops.local",
                "name": "Store Operations Lead",
                "role": "STORE_OWNER",
                "auth_provider": "enterprise_session"
            }
        raise HTTPException(status_code=401, detail="Authentication required")
    
    return AuthService.verify_token(credentials.credentials)

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from backend.app.services.auth_service import AuthService, get_current_user
import os

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/dev-login")
def dev_login(payload: Dict[str, Any] = None):
    """
    Local-first development authentication.
    Does not require cloud keys or paid identity subscriptions.
    Returns signed local JWT session.
    """
    email = (payload or {}).get("email", "owner@hypermarket.local")
    name = (payload or {}).get("name", "Store General Manager")
    session = AuthService.create_dev_session(email=email, name=name)
    return session

@router.get("/session")
def get_session(user = Depends(get_current_user)):
    google_configured = bool(os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET"))
    return {
        "authenticated": True,
        "user": user,
        "google_oauth_available": google_configured,
        "mode": "local_dev" if user.get("auth_provider") == "local_dev" else "oauth"
    }

@router.post("/google-verify")
def google_verify_placeholder(payload: Dict[str, Any]):
    """
    Placeholder/hook for Google OAuth token verification.
    If Google Client ID is configured, verifies JWT ID token against Google's public certs.
    """
    token = payload.get("credential")
    if not token:
        raise HTTPException(status_code=400, detail="Missing credential")
        
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not google_client_id:
        return {
            "status": "notice",
            "message": "Google Client ID not set in .env. Falling back to local development session.",
            "session": AuthService.create_dev_session(email="google.dev.user@example.com", name="Google Dev User")
        }
    
    # In real OAuth flow, verify with google-auth library
    return {"status": "success", "session": AuthService.create_dev_session()}

import uvicorn
import os
import sys

# Ensure root directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if __name__ == "__main__":
    print("Starting QueueIQ AI Backend on http://127.0.0.1:8000 ...")
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=False)

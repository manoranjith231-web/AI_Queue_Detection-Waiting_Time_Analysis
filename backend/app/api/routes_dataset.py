from fastapi import APIRouter, HTTPException, Response, Body
from typing import Dict, Any, Optional
from backend.app.services.dataset_service import DatasetService

router = APIRouter(prefix="/dataset", tags=["Dataset Testing"])

dataset_service: Optional[DatasetService] = None

def get_dataset_service() -> DatasetService:
    global dataset_service
    if dataset_service is None:
        raise HTTPException(status_code=503, detail="Dataset service not initialized")
    return dataset_service

@router.get("/overview")
def get_dataset_overview():
    svc = get_dataset_service()
    return svc.get_dataset_overview()

@router.get("/sequences")
def list_dataset_sequences():
    svc = get_dataset_service()
    return svc.list_sequences()

@router.get("/models")
def get_available_models():
    """Returns information on available and active YOLO models."""
    svc = get_dataset_service()
    return svc.get_available_models()

@router.post("/switch-model")
def switch_active_model(payload: Dict[str, Any] = Body(default={})):
    """Switches the active model between 'custom' and 'pretrained'."""
    svc = get_dataset_service()
    model_type = payload.get("model_type", "custom")
    res = svc.switch_model(model_type=model_type)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to switch model"))
    return res

@router.post("/reset")
def reset_dataset_state():
    """Force-resets the dataset worker, clearing all progress and allowing a fresh start."""
    svc = get_dataset_service()
    return svc.reset_state()

@router.post("/start")
def start_processing(payload: Dict[str, Any] = Body(default={})):
    svc = get_dataset_service()
    seq_name = payload.get("sequence_name", "seq01")
    sampling_rate = int(payload.get("sampling_rate", 2))
    conf_threshold = float(payload.get("conf_threshold", 0.35))
    force_restart = bool(payload.get("force_restart", True))  # Default True: always force fresh start
    
    return svc.start_processing(
        sequence_name=seq_name,
        sampling_rate=sampling_rate,
        conf_threshold=conf_threshold,
        force_restart=force_restart
    )

@router.post("/pause")
def pause_processing():
    svc = get_dataset_service()
    return svc.pause_processing()

@router.post("/resume")
def resume_processing():
    svc = get_dataset_service()
    return svc.resume_processing()

@router.post("/stop")
def stop_processing():
    svc = get_dataset_service()
    return svc.stop_processing()

@router.get("/progress")
def get_progress():
    svc = get_dataset_service()
    return svc.get_progress()

@router.get("/frame")
def get_frame(sequence_name: Optional[str] = None, frame_index: Optional[int] = None, conf_threshold: float = 0.35):
    svc = get_dataset_service()
    jpeg_bytes = svc.get_frame_jpeg(sequence_name=sequence_name, frame_index=frame_index, conf_threshold=conf_threshold)
    if not jpeg_bytes:
        raise HTTPException(status_code=404, detail="No frame available yet")
    return Response(content=jpeg_bytes, media_type="image/jpeg")

@router.get("/frame-info")
def get_frame_info(sequence_name: Optional[str] = None, frame_index: Optional[int] = None, conf_threshold: float = 0.35):
    svc = get_dataset_service()
    return svc.get_frame_analysis(sequence_name=sequence_name, frame_index=frame_index, conf_threshold=conf_threshold)

@router.get("/summary")
def get_summary():
    svc = get_dataset_service()
    return svc.get_latest_results_summary()

@router.get("/export-csv")
def export_csv(run_id: Optional[str] = None):
    svc = get_dataset_service()
    csv_content = svc.export_csv(run_id=run_id)
    return Response(
        content=csv_content.encode('utf-8'),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=queueiq_dataset_results.csv"}
    )

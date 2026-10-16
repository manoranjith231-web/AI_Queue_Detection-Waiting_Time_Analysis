import pytest
import os
from backend.app.services.dataset_service import DatasetService

def test_dataset_overview():
    svc = DatasetService()
    ov = svc.get_dataset_overview()
    assert ov["exists"] is True
    assert ov["total_sequences"] == 44
    assert ov["total_frames"] > 25000
    assert "active_model_name" in ov

def test_dataset_sequences():
    svc = DatasetService()
    seqs = svc.list_sequences()
    assert len(seqs) == 44
    seq01 = next(s for s in seqs if s["sequence_name"] == "seq01")
    assert seq01["frame_count"] == 302
    assert seq01["has_annotations"] is True

def test_single_frame_inspection():
    svc = DatasetService()
    frame_bytes = svc.get_frame_jpeg(sequence_name="seq01", frame_index=1)
    assert frame_bytes is not None
    assert len(frame_bytes) > 5000

def test_model_switching():
    svc = DatasetService()
    # Switch to pretrained
    res_pre = svc.switch_model("pretrained")
    assert res_pre["success"] is True
    assert res_pre["active_model_type"] == "pretrained"
    
    # Switch to custom if checkpoint exists
    if os.path.exists(svc.custom_checkpoint_path):
        res_cust = svc.switch_model("custom")
        assert res_cust["success"] is True
        assert res_cust["active_model_type"] == "custom"

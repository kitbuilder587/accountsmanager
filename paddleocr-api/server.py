import base64
import io
import logging

import numpy as np
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="PaddleOCR API")

ocr_engines = {}


def get_ocr(lang: str = "en"):
    global ocr_engines
    if lang not in ocr_engines:
        from paddleocr import PaddleOCR
        ocr_engines[lang] = PaddleOCR(
            use_angle_cls=True,
            lang=lang,
            det_db_unclip_ratio=2.5,
            show_log=False,
        )
    return ocr_engines[lang]


class DetectRequest(BaseModel):
    image: str  # base64 encoded
    lang: str = "en"  # language for OCR recognition ("en", "ru", etc.)


class BboxResult(BaseModel):
    text: str
    confidence: float
    bbox: list[list[float]]


class DetectResponse(BaseModel):
    results: list[BboxResult]


def run_ocr_for_lang(img_array, lang: str) -> list[BboxResult]:
    ocr = get_ocr(lang)
    result = ocr.ocr(img_array, cls=True)
    results = []
    if result and result[0]:
        for line in result[0]:
            bbox, (text, confidence) = line
            results.append(BboxResult(
                text=text,
                confidence=round(confidence, 4),
                bbox=[[float(p[0]), float(p[1])] for p in bbox],
            ))
    return results


def bbox_iou(bbox1, bbox2) -> float:
    """Calculate IoU between two bounding boxes (4-point polygons) using their bounding rects."""
    xs1 = [p[0] for p in bbox1]
    ys1 = [p[1] for p in bbox1]
    xs2 = [p[0] for p in bbox2]
    ys2 = [p[1] for p in bbox2]

    x1 = max(min(xs1), min(xs2))
    y1 = max(min(ys1), min(ys2))
    x2 = min(max(xs1), max(xs2))
    y2 = min(max(ys1), max(ys2))

    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = (max(xs1) - min(xs1)) * (max(ys1) - min(ys1))
    area2 = (max(xs2) - min(xs2)) * (max(ys2) - min(ys2))
    union = area1 + area2 - inter

    return inter / union if union > 0 else 0


@app.post("/detect", response_model=DetectResponse)
async def detect_text(request: DetectRequest):
    try:
        image_data = base64.b64decode(request.image)
        image = Image.open(io.BytesIO(image_data)).convert("RGB")
        img_array = np.array(image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    try:
        # Run English OCR
        en_results = run_ocr_for_lang(img_array, "en")

        # Run Russian OCR
        ru_results = run_ocr_for_lang(img_array, "ru")

        # Merge: for overlapping regions (IoU > 0.5), keep the one with higher confidence
        merged = list(en_results)
        for ru_r in ru_results:
            is_duplicate = False
            for i, en_r in enumerate(merged):
                if bbox_iou(ru_r.bbox, en_r.bbox) > 0.5:
                    is_duplicate = True
                    if ru_r.confidence > en_r.confidence:
                        merged[i] = ru_r
                    break
            if not is_duplicate:
                merged.append(ru_r)

        return DetectResponse(results=merged)

    except Exception as e:
        logger.error(f"OCR error: {e}")
        raise HTTPException(status_code=500, detail=f"OCR processing error: {e}")


@app.get("/health")
async def health():
    return {"status": "ok"}

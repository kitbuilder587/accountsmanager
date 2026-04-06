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

ocr_engine = None


def get_ocr():
    global ocr_engine
    if ocr_engine is None:
        from paddleocr import PaddleOCR
        ocr_engine = PaddleOCR(
            use_angle_cls=True,
            lang="en",
            det_db_unclip_ratio=2.5,
            show_log=False,
        )
    return ocr_engine


class DetectRequest(BaseModel):
    image: str  # base64 encoded


class BboxResult(BaseModel):
    text: str
    confidence: float
    bbox: list[list[float]]


class DetectResponse(BaseModel):
    results: list[BboxResult]


@app.post("/detect", response_model=DetectResponse)
async def detect_text(request: DetectRequest):
    try:
        image_data = base64.b64decode(request.image)
        image = Image.open(io.BytesIO(image_data)).convert("RGB")
        img_array = np.array(image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    try:
        ocr = get_ocr()
        result = ocr.ocr(img_array, cls=True)
    except Exception as e:
        logger.error(f"OCR error: {e}")
        raise HTTPException(status_code=500, detail=f"OCR processing error: {e}")

    results = []
    if result and result[0]:
        for line in result[0]:
            bbox, (text, confidence) = line
            results.append(BboxResult(
                text=text,
                confidence=round(confidence, 4),
                bbox=[[float(p[0]), float(p[1])] for p in bbox],
            ))

    return DetectResponse(results=results)


@app.get("/health")
async def health():
    return {"status": "ok"}

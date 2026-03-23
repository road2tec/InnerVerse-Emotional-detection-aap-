"""
Phase 7: Emotion History Tracking Routes
==========================================
GET    /history              → paginated emotion history with filters
GET    /history/stats        → aggregated emotion stats for a user
GET    /history/{id}         → single history record
DELETE /history/{id}         → delete a record
DELETE /history/clear        → delete all records for a user

Schema (emotion_history collection):
{
  user_id:          str,
  input_type:       "text" | "voice" | "face"  (= detection_method),
  emotion:          str,
  confidence:       float,
  all_emotions:     dict,
  recommendations:  list[str],   (enriched on fetch — from recommendation engine)
  detection_method: str,
  model_used:       str,
  input_text:       str | None,
  audio_features:   dict | None,
  face_detected:    bool | None,
  processed_at:     str,
  created_at:       datetime,
}
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from bson import ObjectId, errors as bson_errors
from fastapi import APIRouter, HTTPException, Query, Depends

from utils.db import get_async_db
from utils.middleware import get_optional_user
from services.recommendation_service import get_activity_recommendations

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _serialize(rec: dict) -> dict:
    """Convert MongoDB doc to JSON-safe dict and enrich with inline recommendations."""
    rec["id"] = str(rec["_id"])
    del rec["_id"]

    # Normalise input_type / detection_method
    if "detection_method" in rec and "input_type" not in rec:
        rec["input_type"] = rec["detection_method"]
    elif "input_type" in rec and "detection_method" not in rec:
        rec["detection_method"] = rec["input_type"]

    # Format timestamps
    if isinstance(rec.get("created_at"), datetime):
        rec["created_at"] = rec["created_at"].isoformat() + "Z"

    # Enrich with recommendations if not already stored
    if not rec.get("recommendations"):
        try:
            recs = get_activity_recommendations(
                emotion=rec.get("emotion", "neutral"),
                age_group=rec.get("age_group", "adult"),
                top_n=3,
            )
            rec["recommendations"] = recs["activities"]
        except Exception:
            rec["recommendations"] = []

    return rec


def _parse_oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except (bson_errors.InvalidId, Exception):
        raise HTTPException(status_code=400, detail=f"Invalid history record ID: {id_str}")


# ─── GET /history ─────────────────────────────────────────────────────────────

@router.get(
    "/",
    summary="Get emotion history (Phase 7)",
    description="""
Retrieve paginated emotion detection history.

Filters:
- `user_id` — restrict to specific user
- `input_type` — filter by detection method: `text` | `voice` | `face`
- `emotion` — filter by specific emotion label
- `limit` / `skip` — pagination
    """,
)
async def get_history(
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    input_type: Optional[str] = Query(None, description="text | voice | face"),
    emotion: Optional[str] = Query(None, description="Filter by emotion label"),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    db = get_async_db()

    # Build query
    query = {}

    # Auth: authenticated users auto-filter to their own records
    if current_user:
        query["user_id"] = str(current_user["_id"])
    elif user_id:
        query["user_id"] = user_id

    if input_type:
        clean_type = input_type.lower().strip()
        query["$or"] = [
            {"detection_method": clean_type},
            {"input_type": clean_type},
        ]

    if emotion:
        query["emotion"] = emotion.lower().strip()

    total = await db["emotion_history"].count_documents(query)
    cursor = db["emotion_history"].find(
        query,
        sort=[("created_at", -1)],
        skip=skip,
        limit=limit,
    )

    records = []
    async for rec in cursor:
        records.append(_serialize(rec))

    return {
        "history": records,
        "total": total,
        "limit": limit,
        "skip": skip,
        "has_more": (skip + limit) < total,
        "filters_applied": {k: v for k, v in {"user_id": user_id, "input_type": input_type, "emotion": emotion}.items() if v},
    }


# ─── GET /history/stats ───────────────────────────────────────────────────────

@router.get("/stats", summary="Get emotion history statistics")
async def get_history_stats(
    user_id: Optional[str] = Query(None),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    db = get_async_db()

    resolved_user_id = (
        str(current_user["_id"]) if current_user
        else user_id
    )

    match = {"user_id": resolved_user_id} if resolved_user_id else {}

    # Aggregate: count by emotion
    emotion_pipeline = [
        {"$match": match},
        {"$group": {"_id": "$emotion", "count": {"$sum": 1}, "avg_confidence": {"$avg": "$confidence"}}},
        {"$sort": {"count": -1}},
    ]
    # Aggregate: count by detection method
    method_pipeline = [
        {"$match": match},
        {"$group": {"_id": {"$ifNull": ["$detection_method", "$input_type"]}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    # Total docs
    total = await db["emotion_history"].count_documents(match)

    emotion_agg = db["emotion_history"].aggregate(emotion_pipeline)
    method_agg = db["emotion_history"].aggregate(method_pipeline)

    emotion_counts = {d["_id"]: {"count": d["count"], "avg_confidence": round(d.get("avg_confidence", 0), 3)}
                     async for d in emotion_agg}
    method_counts = {d["_id"]: d["count"] async for d in method_agg}

    # Most frequent emotion
    dominant_emotion = max(emotion_counts, key=lambda k: emotion_counts[k]["count"], default="none")

    # Most recent record
    last_rec = await db["emotion_history"].find_one(match, sort=[("created_at", -1)])
    last_emotion = last_rec.get("emotion") if last_rec else None
    last_date = last_rec.get("created_at") if last_rec else None
    if isinstance(last_date, datetime):
        last_date = last_date.isoformat() + "Z"

    return {
        "total_detections": total,
        "dominant_emotion": dominant_emotion,
        "last_emotion": last_emotion,
        "last_detected_at": last_date,
        "by_emotion": emotion_counts,
        "by_method": method_counts,
    }


# ─── GET /history/weekly-summary (Phase 10) ───────────────────────────────────

@router.get("/weekly-summary", summary="Weekly emotion trend for analytics chart")
async def get_weekly_summary(
    user_id: Optional[str] = Query(None),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    db = get_async_db()
    resolved_user_id = str(current_user["_id"]) if current_user else user_id
    match = {"user_id": resolved_user_id} if resolved_user_id else {}

    # 7 days ago boundary
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    match["created_at"] = {"$gte": seven_days_ago}

    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                },
                "emotions": {"$push": "$emotion"}
            }
        },
        {"$sort": {"_id": 1}}
    ]

    cursor = db["emotion_history"].aggregate(pipeline)
    
    # Fill gap days
    trend = []
    daily_data = {doc["_id"]: doc["emotions"] async for doc in cursor}

    for i in range(6, -1, -1):
        dt = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        emotions = daily_data.get(dt, [])
        trend.append({
            "date": dt,
            "total": len(emotions),
            # Find most frequent emotion for the day, or neutral if none
            "dominant": max(set(emotions), key=emotions.count) if emotions else None
        })

    return {"trend": trend}


# ─── GET /history/{id} ────────────────────────────────────────────────────────

@router.get("/{record_id}", summary="Get single history record")
async def get_history_record(record_id: str):
    db = get_async_db()
    oid = _parse_oid(record_id)
    rec = await db["emotion_history"].find_one({"_id": oid})
    if not rec:
        raise HTTPException(status_code=404, detail="History record not found.")
    return _serialize(rec)


# ─── DELETE /history/clear ────────────────────────────────────────────────────

@router.delete("/clear", summary="Clear all history for a user")
async def clear_history(
    user_id: Optional[str] = Query(None),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    db = get_async_db()
    resolved = str(current_user["_id"]) if current_user else user_id
    if not resolved:
        raise HTTPException(status_code=400, detail="user_id required")

    result = await db["emotion_history"].delete_many({"user_id": resolved})
    return {"deleted": result.deleted_count, "user_id": resolved}


# ─── DELETE /history/{id} ────────────────────────────────────────────────────

@router.delete("/{record_id}", summary="Delete a history record (Phase 7 spec)")
async def delete_history_record(
    record_id: str,
    current_user: Optional[dict] = Depends(get_optional_user),
):
    db = get_async_db()
    oid = _parse_oid(record_id)

    # Optional ownership check
    record = await db["emotion_history"].find_one({"_id": oid})
    if not record:
        raise HTTPException(status_code=404, detail="History record not found.")

    if current_user:
        if record.get("user_id") and record["user_id"] != str(current_user["_id"]):
            raise HTTPException(status_code=403, detail="You can only delete your own records.")

    result = await db["emotion_history"].delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found.")

    return {"deleted": True, "id": record_id, "emotion": record.get("emotion")}

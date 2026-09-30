"""Platinum recommendations: POST /recommend with the library and what to leave out."""

from fastapi import APIRouter

from ..recommend import RecommendRequest, RecommendResponse, recommend

router = APIRouter(prefix='/recommend')


@router.post('')
async def recommendations(req: RecommendRequest) -> RecommendResponse:
    return await recommend(req)

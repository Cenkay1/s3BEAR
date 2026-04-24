import uuid
from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.policy import CleanupPolicy
from app.models.user import User
from app.schemas.policy import CleanupPolicyCreate, CleanupPolicyRead, CleanupPolicyUpdate, RunResult
from app.services.cleanup import run_policy

router = APIRouter(prefix="/policies", tags=["policies"])

MSG_POLICY_NOT_FOUND = "Policy not found"


@router.get("", response_model=list[CleanupPolicyRead])
async def list_policies(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(CleanupPolicy).order_by(CleanupPolicy.name))
    return result.scalars().all()


@router.get("/{policy_id}", response_model=CleanupPolicyRead, responses={404: {"description": "Policy not found"}})
async def get_policy(
    policy_id: uuid.UUID,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(CleanupPolicy).where(CleanupPolicy.id == policy_id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail=MSG_POLICY_NOT_FOUND)
    return policy


@router.post("", response_model=CleanupPolicyRead, status_code=201)
async def create_policy(
    body: CleanupPolicyCreate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    policy = CleanupPolicy(**body.model_dump())
    db.add(policy)
    await db.flush()
    await db.refresh(policy)
    # Re-schedule in APScheduler
    from app.worker.scheduler import reschedule_policy
    reschedule_policy(policy)
    return policy


@router.patch("/{policy_id}", response_model=CleanupPolicyRead, responses={404: {"description": "Policy not found"}})
async def update_policy(
    policy_id: uuid.UUID,
    body: CleanupPolicyUpdate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(CleanupPolicy).where(CleanupPolicy.id == policy_id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail=MSG_POLICY_NOT_FOUND)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(policy, field, value)
    await db.flush()
    await db.refresh(policy)
    from app.worker.scheduler import reschedule_policy
    reschedule_policy(policy)
    return policy


@router.delete("/{policy_id}", status_code=204, responses={404: {"description": "Policy not found"}})
async def delete_policy(
    policy_id: uuid.UUID,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(CleanupPolicy).where(CleanupPolicy.id == policy_id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail=MSG_POLICY_NOT_FOUND)
    from app.worker.scheduler import remove_policy_job
    remove_policy_job(str(policy_id))
    await db.delete(policy)


@router.post("/{policy_id}/run", response_model=RunResult, responses={404: {"description": "Policy not found"}})
async def run_policy_manually(
    policy_id: uuid.UUID,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(CleanupPolicy).where(CleanupPolicy.id == policy_id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail=MSG_POLICY_NOT_FOUND)

    run_result = await run_policy(
        policy_id=str(policy_id),
        bucket_patterns=policy.bucket_patterns,
        prefix_filter=policy.prefix_filter,
        older_than_days=policy.older_than_days,
    )

    policy.last_run_at = datetime.now(timezone.utc)
    policy.last_run_status = run_result["status"]
    policy.last_run_deleted_count = run_result["deleted_count"]

    return RunResult(
        policy_id=policy_id,
        deleted_count=run_result["deleted_count"],
        status=run_result["status"],
        message=f"Deleted {run_result['deleted_count']} objects. Errors: {run_result['errors']}",
    )

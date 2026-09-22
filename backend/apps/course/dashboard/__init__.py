"""
Instructor dashboard: one read-only snapshot of an instructor's business (spec 008).

    dto.py        DashboardSnapshot and its parts; to_dict() is the wire format
    attention.py  classify() / rank() — needs attention, built on 007 readiness
    service.py    InstructorDashboardService — the fixed query plan and metric definitions

Import from here, not from the submodules.
"""
from .dto import AttentionItem, AttentionType, DashboardSnapshot
from .service import InstructorDashboardService , person_name , person_ref

__all__ = [
    'AttentionItem',
    'AttentionType',
    'DashboardSnapshot',
    'InstructorDashboardService',
    'person_name',
    'person_ref',
]

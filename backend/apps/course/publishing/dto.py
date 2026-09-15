"""
Plain data carriers for the publishing package (data-model.md §3).

Frozen, with tuples rather than lists, so a verdict handed back by the gate
can't be edited into a different verdict afterwards. `frozen=True` alone only
stops reassigning a field — a list field could still be appended to.
"""
from dataclasses import asdict, dataclass
from typing import Literal

Severity = Literal['blocking', 'advisory']
StateName = Literal['draft', 'published']


@dataclass(frozen=True)
class ReadinessItem:
    # Stable machine identifier. Clients switch on this, never on `message`.
    code: str
    severity: Severity
    # Display-ready text naming the specific offending item (FR-015).
    message: str
    # What to fix, with enough identity to deep-link to it (FR-018):
    # {'kind': 'course'|'section'|'lecture'|'quiz', 'id': int, 'section_id'?: int}
    target: dict | None


@dataclass(frozen=True)
class ReadinessReport:
    status: StateName
    is_publishable: bool
    # status == 'published' and not is_publishable (FR-024).
    needs_attention: bool
    blockers: tuple[ReadinessItem, ...]
    advisories: tuple[ReadinessItem, ...]

    def to_dict(self) -> dict:
        # asdict() keeps tuples as tuples; the API contract is JSON arrays, and
        # response.data should match the wire format before rendering too.
        data = asdict(self)
        data['blockers'] = list(data['blockers'])
        data['advisories'] = list(data['advisories'])
        return data


@dataclass(frozen=True)
class TransitionResult:
    # Whether is_published was actually flipped. False for both idempotent
    # no-ops (FR-005) and gate refusals — `refused` tells those two apart, so
    # callers never have to infer a refusal from blockers being non-empty.
    changed: bool
    status: StateName
    detail: str
    refused: bool = False
    blockers: tuple[ReadinessItem, ...] = ()

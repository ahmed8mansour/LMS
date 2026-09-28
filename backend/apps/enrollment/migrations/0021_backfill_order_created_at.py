"""013 — Backfill Order.created_at from the order's enrolment (research R4).

`created_at` was added by migration 0011 on 2026-07-07 as `auto_now_add=True,
null=True`. `auto_now_add` fills it for every row written since, so every order placed
BEFORE that migration has no date at all.

That breaks the earnings page two different ways, and there is no handling that avoids
both: excluding the dateless orders drops their revenue from all-time net while the
dashboard tile still counts it (FR-014), and including them in the tiles but not in the
dateless trend stops the bars adding up to Net (FR-041).

`Enrollment.enrolled_at` is the faithful source. It is non-null, it is written by
FulfillmentFacade at the moment the order is fulfilled — within seconds of the purchase
— and every counted sale has one, because a paid order is what creates an enrolment. A
refunded order keeps its (deactivated) enrolment, so it is covered too. Orders with no
enrolment are pending or failed; they are excluded from the earnings page anyway and are
left untouched here.

This migration fills a null timestamp and nothing else. No amount, status, or relation
is read or written.
"""
from django.db import migrations

BATCH = 500


def backfill(apps, schema_editor):
    Order = apps.get_model('enrollment', 'Order')

    pending = (
        Order.objects
        .filter(created_at__isnull=True, enrollment__isnull=False)
        .values_list('id', 'enrollment__enrolled_at')
        .order_by('id')
        .distinct()
    )

    updates = []
    seen = set()
    for order_id, enrolled_at in pending.iterator(chunk_size=BATCH):
        # unique_together on (user, course) makes a second enrolment per order
        # impossible in practice, but .values_list over a reverse relation can still
        # repeat a row; keep the first date and ignore any repeat.
        if order_id in seen or enrolled_at is None:
            continue
        seen.add(order_id)
        updates.append(Order(id=order_id, created_at=enrolled_at))

        if len(updates) >= BATCH:
            Order.objects.bulk_update(updates, ['created_at'])
            updates = []

    if updates:
        Order.objects.bulk_update(updates, ['created_at'])


def noop(apps, schema_editor):
    """Deliberately irreversible-as-a-no-op: the previous state was "unknown"."""


class Migration(migrations.Migration):

    dependencies = [
        ('enrollment', '0020_remove_transaction_idempotency_key_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]

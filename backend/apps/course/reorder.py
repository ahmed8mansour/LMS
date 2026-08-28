from django.db import transaction

# Rows are shifted to this out-of-range band during a reorder so that no
# intermediate state ever holds two siblings at the same (parent, order) —
# Postgres checks unique_together per-statement, so a temporary offset is the
# safe way to renumber under the constraint without a schema change.
_TEMP_OFFSET = 1_000_000


@transaction.atomic
def reorder_within_parent(model, parent_filter, instance, target_order):
    """Move ``instance`` to ``target_order`` among its siblings (the rows matching
    ``parent_filter``) and compact the whole group to a gap-free ``0..n-1`` sequence.

    Driven by a per-item PATCH (the client sends the moved item's new ``order``);
    the renumber runs in a single transaction using a two-phase temp-offset so the
    ``unique_together (parent, order)`` constraint is never transiently violated.
    Works for models without the constraint too (e.g. Question), where it simply
    keeps ordering gap-free.
    """
    siblings = list(
        model.objects.filter(**parent_filter)
        .exclude(pk=instance.pk)
        .order_by('order')
    )

    # Clamp the requested position into [0, len(siblings)].
    target = max(0, min(int(target_order), len(siblings)))
    ordered = siblings[:target] + [instance] + siblings[target:]

    # Phase 1 — park every affected row in a collision-free out-of-range band.
    for i, obj in enumerate(ordered):
        model.objects.filter(pk=obj.pk).update(order=_TEMP_OFFSET + i)

    # Phase 2 — write the final compact 0..n-1 sequence.
    for i, obj in enumerate(ordered):
        model.objects.filter(pk=obj.pk).update(order=i)

    instance.order = ordered.index(instance)
    return instance

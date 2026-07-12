"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import BounceLoader from "@/components/atoms/bouncing-loader";
import { StarRating } from "@/components/atoms/StarRating";
import { StarInput } from "@/components/atoms/StarInput";
import { reviewSchema, ReviewFormData } from "../../schemas/reviews.schma";
import { Review } from "../../types/reviews.types";
import { useMyReviews } from "../../hooks/useMyReviews";
import { useUpdateReview } from "../../hooks/useUpdateReview";
import { useDeleteReview } from "../../hooks/useDeleteReview";

export function MyReviewsList() {
    const { data: reviews, isLoading, isError } = useMyReviews();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <BounceLoader />
            </div>
        );
    }

    if (isError) {
        return (
            <p className="text-center text-graytext2 py-8">
                Failed to load your reviews. Please try again later.
            </p>
        );
    }

    if (!reviews || reviews.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-xl border border-graylighttext/30 shadow-sm">
                <p className="text-graytext2 text-lg font-medium">No reviews yet</p>
                <p className="text-graytext2 text-sm mt-1">
                    Complete a course and share your thoughts!
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {reviews.map((review) => (
                <div key={review.id}>
                    {editingId === review.id ? (
                        <EditReviewForm
                            review={review}
                            onCancel={() => setEditingId(null)}
                            onSuccess={() => setEditingId(null)}
                        />
                    ) : deletingId === review.id ? (
                        <DeleteConfirm
                            review={review}
                            onCancel={() => setDeletingId(null)}
                            onSuccess={() => setDeletingId(null)}
                        />
                    ) : (
                        <ReviewItem
                            review={review}
                            onEdit={() => setEditingId(review.id)}
                            onDelete={() => setDeletingId(review.id)}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

function ReviewItem({
    review,
    onEdit,
    onDelete,
}: {
    review: Review;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="bg-white rounded-xl border border-graylighttext/30 shadow-sm p-5">
            <div className="flex gap-4 items-start">
                {review.course_thumbnail && (
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-graylighttext/20 relative">
                        <Image
                            src={review.course_thumbnail}
                            alt={review.course_title || ""}
                            fill
                            className="object-cover"
                        />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-darktext text-sm truncate">
                        {review.course_title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                        <StarRating rating={review.rating} size={14} />
                        <span className="text-xs text-graytext2">
                            {new Date(review.updated_at).toLocaleDateString()}
                        </span>
                    </div>
                    {review.comment && (
                        <p className="text-sm text-graytext2 mt-2 line-clamp-3">
                            {review.comment}
                        </p>
                    )}
                </div>
                <div className="flex gap-1 shrink-0">
                    <button
                        onClick={onEdit}
                        className="p-2 rounded-lg text-darkmint hover:bg-darkmint/10 transition-colors"
                        aria-label="Edit review"
                    >
                        <FiEdit2 size={16} />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                        aria-label="Delete review"
                    >
                        <FiTrash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

function EditReviewForm({
    review,
    onCancel,
    onSuccess,
}: {
    review: Review;
    onCancel: () => void;
    onSuccess: () => void;
}) {
    const { mutate: updateReview, isPending } = useUpdateReview();
    const {
        control,
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ReviewFormData>({
        resolver: zodResolver(reviewSchema),
        defaultValues: { rating: review.rating, comment: review.comment || "" },
    });

    const onSubmit = (data: ReviewFormData) => {
        updateReview(
            { id: review.id, input: { rating: data.rating, comment: data.comment } },
            { onSuccess }
        );
    };

    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            className="bg-white rounded-xl border-2 border-darkmint/30 shadow-sm p-5 space-y-4"
        >
            <div className="flex items-center justify-between">
                <h4 className="font-bold text-darktext text-sm">
                    Editing: {review.course_title}
                </h4>
                <button
                    type="button"
                    onClick={onCancel}
                    className="p-1.5 rounded-lg text-graytext2 hover:bg-gray-100 transition-colors"
                    aria-label="Cancel editing"
                >
                    <FiX size={18} />
                </button>
            </div>

            <div>
                <label className="block text-sm font-medium text-darktext mb-2">Rating</label>
                <Controller
                    control={control}
                    name="rating"
                    render={({ field }) => (
                        <StarInput value={field.value} onChange={field.onChange} disabled={isPending} />
                    )}
                />
                {errors.rating && (
                    <p className="text-destructive text-xs mt-1">{errors.rating.message}</p>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-darktext mb-2">Comment</label>
                <textarea
                    rows={3}
                    className="w-full rounded-lg border border-graylighttext/40 bg-lightbg focus:ring-2 focus:ring-darkmint focus:border-darkmint text-sm p-3 text-darktext placeholder-graytext2/60 resize-none transition-shadow outline-none"
                    {...register("comment")}
                />
                {errors.comment && (
                    <p className="text-destructive text-xs mt-1">{errors.comment.message}</p>
                )}
            </div>

            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isPending}
                    className="py-2 px-4 rounded-lg border border-graylighttext/40 text-sm font-medium text-graytext2 hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isPending}
                    className="bg-darkmint hover:bg-darkmint/90 text-white font-semibold py-2 px-5 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending ? "Saving..." : "Save Changes"}
                </button>
            </div>
        </form>
    );
}

function DeleteConfirm({
    review,
    onCancel,
    onSuccess,
}: {
    review: Review;
    onCancel: () => void;
    onSuccess: () => void;
}) {
    const { mutate: deleteReview, isPending } = useDeleteReview();

    const handleDelete = () => {
        deleteReview(review.id, { onSuccess });
    };

    return (
        <div className="bg-white rounded-xl border-2 border-red-200 shadow-sm p-5">
            <p className="text-darktext font-medium text-sm">
                Delete your review for <span className="font-bold">{review.course_title}</span>?
            </p>
            <p className="text-graytext2 text-xs mt-1">
                This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-4">
                <button
                    onClick={onCancel}
                    disabled={isPending}
                    className="py-2 px-4 rounded-lg border border-graylighttext/40 text-sm font-medium text-graytext2 hover:bg-gray-50 transition-colors"
                >
                    Keep it
                </button>
                <button
                    onClick={handleDelete}
                    disabled={isPending}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-5 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending ? "Deleting..." : "Delete"}
                </button>
            </div>
        </div>
    );
}

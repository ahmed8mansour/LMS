"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { StarInput } from "@/components/atoms/StarInput";
import { reviewSchema, ReviewFormData } from "../../schemas/reviews.schma";
import { ReviewableCourse } from "../../types/reviews.types";
import { useSubmitReview } from "../../hooks/useSubmitReview";

interface ReviewSubmissionCardProps {
    course: ReviewableCourse;
}

export function ReviewSubmissionCard({ course }: ReviewSubmissionCardProps) {
    const { mutate: submitReview, isPending } = useSubmitReview();
    const {
        control,
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ReviewFormData>({
        resolver: zodResolver(reviewSchema),
        defaultValues: { rating: 0, comment: "" },
    });

    const onSubmit = (data: ReviewFormData) => {
        submitReview(
            { course_id: course.course_id, rating: data.rating, comment: data.comment },
            { onSuccess: () => reset({ rating: 0, comment: "" }) }
        );
    };

    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            className="bg-white rounded-xl border border-graylighttext/30 shadow-sm overflow-hidden flex flex-col"
        >
            <div className="p-6 border-b border-graylighttext/20 flex flex-col sm:flex-row gap-4 bg-lightbg/60 items-start">
                <div className="w-24 h-24 sm:w-32 sm:h-24 rounded-lg overflow-hidden shrink-0 shadow-sm border border-graylighttext/20 relative">
                    <Image src={course.thumbnail} alt={course.title} fill className="object-cover" />
                </div>
                <div>
                    <h3 className="font-bold text-lg text-darktext">{course.title}</h3>
                    <p className="text-sm text-graytext2 mt-1">Instructor: {course.instructor_name}</p>
                </div>
            </div>

            <div className="p-6 space-y-5">
                <div>
                    <label className="block text-sm font-medium text-darktext mb-2">
                        Rate your experience
                    </label>
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
                    <label
                        className="block text-sm font-medium text-darktext mb-2"
                        htmlFor={`comment-${course.course_id}`}
                    >
                        Write your feedback
                    </label>
                    <textarea
                        id={`comment-${course.course_id}`}
                        rows={4}
                        placeholder="What did you like about this course? How could it be improved?"
                        className="w-full rounded-lg border border-graylighttext/40 bg-lightbg focus:ring-2 focus:ring-darkmint focus:border-darkmint text-sm p-3 text-darktext placeholder-graytext2/60 resize-none transition-shadow outline-none"
                        {...register("comment")}
                    />
                    {errors.comment && (
                        <p className="text-destructive text-xs mt-1">{errors.comment.message}</p>
                    )}
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={isPending}
                        className="bg-darkmint hover:bg-darkmint/90 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors shadow-sm active:scale-95 duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPending ? "Submitting..." : "Submit Review"}
                    </button>
                </div>
            </div>
        </form>
    );
}

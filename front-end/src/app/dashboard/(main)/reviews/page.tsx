import { ReviewableCoursesCards } from "@/featuers/reviews/components/student/ReviewableCoursesCards";
import { MyReviewsList } from "@/featuers/reviews/components/student/MyReviewsList";

export default function ReviewsPage() {
    return (
        <main className="bg-lightbg overflow-y-auto p-8">
            <div>
                <h1 className="font-extrabold text-3xl md:text-4xl text-darktext tracking-tight">
                    My Reviews &amp; Ratings
                </h1>
                <p className="text-graytext2 mt-2 max-w-2xl text-base">
                    Share your thoughts on courses you&apos;ve completed and manage your past feedback
                    to help others in the learning community.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <div>
                    <h2 className="font-bold text-xl text-darktext mb-4">Courses You Can Review</h2>
                    <ReviewableCoursesCards />
                </div>
                <div>
                    <h2 className="font-bold text-xl text-darktext mb-4">Your Submitted Reviews</h2>
                    <MyReviewsList />
                </div>
            </div>
        </main>
    );
}

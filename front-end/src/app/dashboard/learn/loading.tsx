import BounceLoader from "@/components/atoms/bouncing-loader";
export default function Loading() {
    return (
        <div className="flex items-center justify-center h-screen">
            <BounceLoader/>
        </div>
    );
}

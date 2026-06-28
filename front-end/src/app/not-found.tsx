"use client"
import { InfoIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/atoms/button';
export default function NotFound() {
    return (
        <main className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="relative mb-8">
            <span className="text-[120px] md:text-[180px] font-extrabold leading-none tracking-tighter text-darkmint/30 select-none">
                            404
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
                    <InfoIcon width={30} height={30} className='text-darkmint' />
            </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-darkmint">Page Not Found</h1>
            <p className="text-graytext2 max-w-lg mx-auto text-lg mb-10">
                        The page you are looking for might have been moved, removed, or had its name changed. Our team has been notified of this missing link.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 ">
                <Link href={"/dashboard"}>
                    <Button className="px-8 py-5" variant={"darkmint"}>
                        Go to Dashboard
                    </Button>
                </Link>
                <Link href={"/"}>
                    <Button className="text-darktext px-8 py-5"  variant={"outline"}>
                        Back To Home
                    </Button>
                </Link>
            </div>
        </main>
    )
}
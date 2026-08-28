'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Input } from '@/components/atoms/input';
import { Button } from '@/components/atoms/button';
import ButtonLoading from '@/components/atoms/buttonloading';
import { Skeleton } from '@/components/atoms/skeleton';
import { instructorCurriculumAPI } from '../api/instructorCurriculum.api';
import { useLectureMutations } from '../hooks/useLectureMutations';
import { lectureSchema, LectureFormData } from '../schemas/instructorCurriculum.schma';
import { formatMinutes } from '@/lib/duration';
import { VideoSlotPlaceholder } from './VideoSlotPlaceholder';

interface LectureEditorProps {
    courseId: number;
    lectureId: number;
}

export function LectureEditor({ courseId, lectureId }: LectureEditorProps) {
    const { update } = useLectureMutations(courseId);
    const lectureQuery = useQuery({
        queryKey: ['instructor', 'lecture', lectureId],
        queryFn: () => instructorCurriculumAPI.getLecture(lectureId),
        enabled: Number.isFinite(lectureId),
        retry: false,
    });

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<LectureFormData>({ resolver: zodResolver(lectureSchema) });

    // Prefill once the lecture loads (duration shown as mm:ss).
    useEffect(() => {
        if (lectureQuery.data) {
            reset({
                title: lectureQuery.data.title,
                duration: formatMinutes(lectureQuery.data.duration),
            });
        }
    }, [lectureQuery.data, reset]);

    const onSubmit = (data: LectureFormData) =>
        update.mutate({ id: lectureId, title: data.title, duration: data.duration });

    if (lectureQuery.isLoading) {
        return <Skeleton className="h-64 w-full rounded-xl" />;
    }
    if (lectureQuery.isError || !lectureQuery.data) {
        return (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-graytext/20 bg-white py-16 text-center">
                <h1 className="text-lg font-bold text-darktext">Lecture not found</h1>
                <Link
                    href={`/instructor/courses/${courseId}/curriculum`}
                    className="font-semibold text-darkmint hover:underline"
                >
                    Back to curriculum
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <Link
                href={`/instructor/courses/${courseId}/curriculum`}
                className="flex items-center gap-1.5 text-sm text-graytext2 hover:text-darkmint"
            >
                <ArrowLeft className="h-4 w-4" /> Back to curriculum
            </Link>
            <div>
                <h1 className="text-xl font-bold text-darktext">Lecture editor</h1>
                <p className="text-sm text-graytext2">Edit details and manage the video</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-mono uppercase tracking-wide text-graytext2">
                            Lecture title
                        </label>
                        <Input {...register('title')} />
                        {errors.title && <span className="text-xs text-red-500">{errors.title.message}</span>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-mono uppercase tracking-wide text-graytext2">
                            Duration (mm:ss)
                        </label>
                        <Input {...register('duration')} placeholder="4:20" className="max-w-32" />
                        {errors.duration && (
                            <span className="text-xs text-red-500">{errors.duration.message}</span>
                        )}
                    </div>
                    <div>
                        <Button variant="darkmint" type="submit" disabled={update.isPending} className="min-w-28">
                            {update.isPending ? <ButtonLoading /> : 'Save'}
                        </Button>
                    </div>
                </form>

                <VideoSlotPlaceholder status={lectureQuery.data.video_status} />
            </div>
        </div>
    );
}

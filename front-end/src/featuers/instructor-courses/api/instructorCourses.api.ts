import axiosInstance from '@/lib/axios';
import uploadToCloudinary from '@/lib/cloudinary';
import { InstructorCourse } from '../types/instructorCourses.types';
import { CourseFormData } from '../schemas/instructorCourses.schma';

const BASE = '/courses/instructor/courses/';

// Build the JSON body the backend expects. Maps the form's `goals` → model `goals_list`,
// never leaks the raw FileList, and only includes `thumbnail` when a URL was resolved.
function toPayload(form: CourseFormData, thumbnailUrl?: string) {
    const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        price: form.price,
        category: form.category,
        level: form.level,
        language: form.language ?? '',
        // Strip blank rows so no empty goals are persisted.
        goals_list: form.goals.map((g) => g.trim()).filter((g) => g !== ''),
    };
    if (thumbnailUrl !== undefined) {
        payload.thumbnail = thumbnailUrl;
    }
    return payload;
}

async function resolveThumbnail(files?: FileList): Promise<string | undefined> {
    if (files instanceof FileList && files.length > 0) {
        return uploadToCloudinary(files[0]);
    }
    return undefined;
}

async function list(): Promise<InstructorCourse[]> {
    const { data } = await axiosInstance.get(BASE);
    return data;
}

async function get(id: number): Promise<InstructorCourse> {
    const { data } = await axiosInstance.get(`${BASE}${id}/`);
    return data;
}

async function create(form: CourseFormData): Promise<InstructorCourse> {
    const thumbnailUrl = await resolveThumbnail(form.thumbnail);
    const { data } = await axiosInstance.post(BASE, toPayload(form, thumbnailUrl));
    return data;
}

// PATCH (partial): omitting `thumbnail` keeps the existing image; a new file replaces it.
async function update(id: number, form: CourseFormData): Promise<InstructorCourse> {
    const thumbnailUrl = await resolveThumbnail(form.thumbnail);
    const { data } = await axiosInstance.patch(`${BASE}${id}/`, toPayload(form, thumbnailUrl));
    return data;
}

async function remove(id: number): Promise<void> {
    await axiosInstance.delete(`${BASE}${id}/`);
}

export const instructorCoursesAPI = {
    list,
    get,
    create,
    update,
    remove,
};

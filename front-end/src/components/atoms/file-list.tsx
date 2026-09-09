import { cn } from '@/lib/utils';
import { FileItemData, UploadedFileItem } from './file-item';

export function FileList({ items }: { items: FileItemData[] }) {
    if (items.length === 0) {
        return null;
    }

    return (
        <div className={cn('my-4 space-y-3 px-6 pb-5')}>
            {items.map(({ key, ...item }) => (
                <UploadedFileItem key={key} {...item} />
            ))}
        </div>
    );
}

'use client';

import { Upload } from 'lucide-react';
import type React from 'react';
import { useId, useState } from 'react';
import type { RefObject } from 'react';

interface FileDropzoneProps {
    fileInputRef: RefObject<HTMLInputElement | null>;
    /** Called with everything the user picked or dropped; the caller decides what to keep. */
    handleFileSelect: (files: FileList | null) => void;
    /** e.g. "MP4, MOV, WEBM up to 2 GB" — the limits actually enforced on upload. */
    limitsLabel?: string;
    accept?: string;
    disabled?: boolean;
}

export default function FileDropzone({
    fileInputRef,
    handleFileSelect,
    limitsLabel,
    accept = 'video/*',
    disabled = false,
}: FileDropzoneProps) {
    // Generated, not hardcoded: two dropzones on one page would otherwise share
    // an id and the label would open the wrong picker.
    const inputId = useId();
    const [isDragging, setIsDragging] = useState(false);

    const open = () => {
        if (!disabled) fileInputRef.current?.click();
    };

    return (
        <div className="p-6">
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled}
                aria-label="Upload a video file"
                onClick={open}
                onKeyDown={(e) => {
                    // A div is not a button: Enter/Space have to be wired by hand
                    // or the dropzone is unreachable without a mouse.
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        open();
                    }
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!disabled) setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (!disabled) handleFileSelect(e.dataTransfer.files);
                }}
                className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-8 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-darkmint ${
                    disabled
                        ? 'cursor-not-allowed border-graytext/20 opacity-60'
                        : 'cursor-pointer'
                } ${isDragging ? 'border-darkmint bg-darkmint/5' : 'border-graytext/30'}`}
            >
                <div className="mb-2 rounded-full bg-darkbg p-3">
                    <Upload className="h-5 w-5 text-graytext2" />
                </div>
                <p className="text-sm font-medium text-darktext">Upload a video file</p>
                <p className="mt-1 text-sm text-graytext2">
                    Drag and drop, or{' '}
                    <label
                        className="cursor-pointer font-medium text-darkmint hover:underline"
                        htmlFor={inputId}
                        onClick={(e) => e.stopPropagation()} // the label opens the picker itself
                    >
                        click to browse
                    </label>
                </p>
                {limitsLabel && <p className="mt-2 text-xs text-graytext2">{limitsLabel}</p>}
                <input
                    accept={accept}
                    className="hidden"
                    id={inputId}
                    disabled={disabled}
                    onChange={(e) => {
                        handleFileSelect(e.target.files);
                        // Reset so picking the same file twice in a row still fires
                        // change (after a failed upload, that's the common retry).
                        e.target.value = '';
                    }}
                    ref={fileInputRef}
                    type="file"
                    multiple={false}
                />
            </div>
        </div>
    );
}

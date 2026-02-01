interface CourseSectionItem {
    title :string,
    pretitle :string,
    icon: React.ReactNode,
}
export default function CourseSectionItem({title , pretitle , icon} : CourseSectionItem) {
    return (
        <div className="quiz_item py-4 flex items-center justify-between">
            <div className="flex items-center gap-x-3">
                {icon}
                <p className="text-sm font-normal text-darkmint hover:underline cursor-pointer">{title}</p>
            </div>
            <span className="font-normal text-sm text-graytext2">{pretitle}</span>
        </div>
    )
}

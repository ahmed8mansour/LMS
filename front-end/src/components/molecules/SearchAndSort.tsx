"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/atoms/select";
import InputSearchLoaderDemo from "@/components/atoms/search-loading";
import { useFilters } from "@/hooks/useFilters";
export default function SearchAndSort() {
    const {searchParams , setFilter} = useFilters()

    return (
            <div className="searching bg-white p-4 rounded-2xl flex items-center justify-between gap-4 border border-[#E2E8F0] lg:flex-nowrap flex-wrap ">
                <InputSearchLoaderDemo />
                <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-sm/5 text-graytext2">Sort by:</p>
                    <Select onValueChange={(value) => setFilter('sort',value)}>
                        <SelectTrigger className="xl:w-[190px] !h-12 bg-lightbg font-semibold text-sm/5 text-darktext data-[placeholder]:text-darktext data-[placeholder]:text-sm/5 data-[placeholder]:font-semibold " >
                            <SelectValue  placeholder={searchParams.get('sort') ?? 'Most Popular'} />
                        </SelectTrigger>
                        <SelectContent className="bg-lightbg ">
                            <SelectItem className="font-semibold text-sm/5 text-darktext" value="popular">Most Popular</SelectItem>
                            <SelectItem className="font-semibold text-sm/5 text-darktext" value="newest">Newest</SelectItem>
                            <SelectItem className="font-semibold text-sm/5 text-darktext" value="system">System</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
    )
}

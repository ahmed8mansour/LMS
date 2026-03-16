"use client";
import { useState } from "react";
import { IoFilterSharp } from "react-icons/io5";
import { Button } from "@/components/atoms/button";
import { Checkbox } from "@/components/atoms/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet, } from "@/components/atoms/field";
import { Slider } from "@/components/atoms/slider"
import { Label } from "@/components/atoms/label";
import { RadioGroup, RadioGroupItem } from "@/components/molecules/radio-group";
import { IoMdStarOutline } from "react-icons/io";
import { useFilters } from "@/hooks/useFilters";



type RadioProps = {
    level: string | null
    setFilter: (key: string, value: string) => void
}

type CheckboxProps = {
    categories: string[]
    toggleFilter: (key: string, value: string) => void
}



export function RadioGroupF( {level , setFilter} :RadioProps ) {
    return (
        <RadioGroup value={level ?? ""} onValueChange={(value) => setFilter("level",value)} className="w-fit">
            <FieldLegend variant="label" className="text-graylighttext font-bold text-sm/5 uppercase mb-0">
                levels
            </FieldLegend>
            <div className="flex items-center gap-3">
                <RadioGroupItem  value="beginner" id="r1" />
                <Label htmlFor="r1" className="font-medium text-sm/5 text-darktext hover:text-darkmint">Beginner</Label>
            </div>
            <div className="flex items-center gap-3">
                <RadioGroupItem  value="intermediate" id="r2" />
                <Label htmlFor="r2" className="font-medium text-sm/5 text-darktext hover:text-darkmint">Intermediate</Label>
            </div>
            <div className="flex items-center gap-3">
                <RadioGroupItem  value="advanced" id="r3" />
                <Label htmlFor="r3" className="font-medium text-sm/5 text-darktext hover:text-darkmint">Advanced</Label>
            </div>

        </RadioGroup>
    )
}

export function CheckboxGroup({categories , toggleFilter} : CheckboxProps) {
    return (
        <FieldSet>
            <FieldLegend variant="label" className="text-graylighttext font-bold text-sm/5 uppercase">
                Categories
            </FieldLegend>

            <FieldGroup className="gap-3">
                <Field orientation="horizontal">
                    <Checkbox
                        id="category"
                        checked={categories.includes("development")}
                        onCheckedChange={() => toggleFilter("category","development")}
                    />
                    <FieldLabel
                        htmlFor="category"
                        className="font-medium text-sm/5 text-darktext hover:text-darkmint"
                    >
                        Development
                    </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                    <Checkbox
                        id="finder-pref-9k2-external-disks-1yg-checkbox"
                        checked={categories.includes("business")}
                        onCheckedChange={() => toggleFilter("category","business")}        
                    />
                    <FieldLabel
                        htmlFor="finder-pref-9k2-external-disks-1yg-checkbox"
                        className="font-medium text-sm/5 text-darktext hover:text-darkmint"
                    >
                        Business
                    </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                    <Checkbox
                        id="finder-pref-9k2-cds-dvds-fzt-checkbox"
                        checked={categories.includes("design & UI/UX")}
                        onCheckedChange={() => toggleFilter("category","design & UI/UX")}      
                    />
                    <FieldLabel
                        htmlFor="finder-pref-9k2-cds-dvds-fzt-checkbox"
                        className="font-medium text-sm/5 text-darktext hover:text-darkmint"
                    >
                        Design & UI/UX
                    </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                    <Checkbox
                        id="finder-pref-9k2-connected-servers-6l2-checkbox"
                        checked={categories.includes("marketing")}
                        onCheckedChange={() => toggleFilter("category","marketing")}  
                    />
                    <FieldLabel
                        htmlFor="finder-pref-9k2-connected-servers-6l2-checkbox"
                        className="font-medium text-sm/5 text-darktext hover:text-darkmint"
                    >
                        Marketing
                    </FieldLabel>
                </Field>
            </FieldGroup>
        </FieldSet>
    )
}


export default function Filters() {
    const [selected, setSelected] = useState(0); // State variable to store selected rating
    const [hover, setHover] = useState(0); // State variable to store hover state
    

    const {setFilter  , toggleFilter, searchParams , resetFilters} = useFilters()
    const [price,setPrice] = useState([
        Number(searchParams.get("min_price")) || 0,
        Number(searchParams.get("max_price")) || 1000
    ])

    const rating = Number(searchParams.get("rating")) || 0

    const level = searchParams.get('level')
    const categories = searchParams.getAll('category')

    return (
        <>
            <div className="filtering_head mb-6 flex items-center justify-between">
                <div className="flex items-center text-darktext font-bold text-lg/">
                    <IoFilterSharp className="text-darkmint me-2" />
                    Filters
                </div>
                <Button className="hover:no-underline uppercase font-bold text-xs/4 text-darkmint" onClick={resetFilters} variant={"link"}>
                    reset
                </Button>

            </div>
            <form className="flex flex-col gap-8">
                <CheckboxGroup categories={categories} toggleFilter={toggleFilter} />
                <RadioGroupF level={level} setFilter={setFilter} />

                <div className="price_range">
                    <FieldLegend variant="label" className="text-graylighttext font-bold text-sm/5 uppercase mb-4">
                        Price Range
                    </FieldLegend>
                    <Slider
                        value={price}
                        onValueChange={(value:number[])=>{
                            setPrice(value)
                        }}

                        onValueCommit={(value:number[])=>{
                            setFilter("min_price", value[0].toString())
                            setFilter("max_price", value[1].toString())
                        }}
                        max={5000}
                        step={10}
                        className="mx-auto w-full max-w-xs"
                    />
                    <div className="flex items-center justify-between mt-3 text-darktext/70">
                        <span>{price[0]}$</span>
                        <span>{price[1]}$</span>
                    </div>
                </div>

                <div className="rate">
                    <FieldLegend variant="label" className="text-graylighttext font-bold text-sm/5 uppercase mb-4">
                        min. rating
                    </FieldLegend>
                    <div className="flex items-center gap-.5">
                        {[1,2,3,4,5].map((num)=>{

                            const active = num <= (hover || rating)

                            return (
                            <IoMdStarOutline
                                key={num}

                                onClick={()=>setFilter("rating",num.toString())}

                                onMouseOver={()=>setHover(num)}

                                onMouseLeave={()=>setHover(0)}

                                size={24}

                                className={`cursor-pointer me-1 ${
                                active
                                    ? "text-darkmint"
                                    : "text-graylighttext/50"
                                }`}
                            />
                            )

                        })}
                        <span className="text-darktext/70 font-bold text-xs ms-2">{rating}.0 & Up</span>
                    </div>
                </div>

                {/* <Button className="w-full h-12 font-bold text-base" type="submit" variant={"darkmint"}>
                    Apply Filters
                </Button> */}


            </form>
        </>

    )
}

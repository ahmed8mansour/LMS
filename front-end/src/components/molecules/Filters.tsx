"use client";
import { useState } from "react";
import { IoFilterSharp } from "react-icons/io5";
import { Button } from "@/components/atoms/button";
import { Checkbox } from "@/components/atoms/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet, } from "@/components/atoms/field";
import { Slider } from "@/components/atoms/slider"
import { Label } from "@/components/atoms/label";
import { RadioGroup, RadioGroupItem } from "@/components/molecules/radio-group";
import { FaStar } from "react-icons/fa";


export function RadioGroupDemo() {
    return (
        <RadioGroup defaultValue="Beginner" className="w-fit">
            <FieldLegend variant="label" className="text-graylighttext font-bold text-sm/5 uppercase mb-0">
                levels
            </FieldLegend>
            <div className="flex items-center gap-3">
                <RadioGroupItem value="Beginner" id="r1" />
                <Label htmlFor="r1" className="font-medium text-sm/5 text-darktext hover:text-darkmint">Beginner</Label>
            </div>
            <div className="flex items-center gap-3">
                <RadioGroupItem value="Intermediate" id="r2" />
                <Label htmlFor="r2" className="font-medium text-sm/5 text-darktext hover:text-darkmint">Intermediate</Label>
            </div>
            <div className="flex items-center gap-3">
                <RadioGroupItem value="Advanced" id="r3" />
                <Label htmlFor="r3" className="font-medium text-sm/5 text-darktext hover:text-darkmint">Advanced</Label>
            </div>

        </RadioGroup>
    )
}

export function CheckboxGroup() {
    return (
        <FieldSet>
            <FieldLegend variant="label" className="text-graylighttext font-bold text-sm/5 uppercase">
                Categories
            </FieldLegend>

            <FieldGroup className="gap-3">
                <Field orientation="horizontal">
                    <Checkbox
                        id="finder-pref-9k2-hard-disks-ljj-checkbox"
                        name="finder-pref-9k2-hard-disks-ljj-checkbox"
                        defaultChecked
                    />
                    <FieldLabel
                        htmlFor="finder-pref-9k2-hard-disks-ljj-checkbox"
                        className="font-medium text-sm/5 text-darktext hover:text-darkmint"
                    >
                        Development
                    </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                    <Checkbox
                        id="finder-pref-9k2-external-disks-1yg-checkbox"
                        name="finder-pref-9k2-external-disks-1yg-checkbox"
                        defaultChecked
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
                        name="finder-pref-9k2-cds-dvds-fzt-checkbox"
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
                        name="finder-pref-9k2-connected-servers-6l2-checkbox"
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
    return (
        <>
            <div className="filtering_head mb-6 flex items-center justify-between">
                <div className="flex items-center text-darktext font-bold text-lg/">
                    <IoFilterSharp className="text-darkmint me-2" />
                    Filters
                </div>
                <Button className="hover:no-underline uppercase font-bold text-xs/4 text-darkmint" variant={"link"}>
                    reset
                </Button>

            </div>
            <form className="flex flex-col gap-8">
                <CheckboxGroup />
                <RadioGroupDemo />

                <div className="price_range">
                    <FieldLegend variant="label" className="text-graylighttext font-bold text-sm/5 uppercase mb-4">
                        Price Range
                    </FieldLegend>
                    <Slider
                        defaultValue={[25, 50]}
                        max={100}
                        step={5}
                        className="mx-auto w-full max-w-xs"
                    />
                    <div className="flex items-center justify-between mt-3 text-darktext/70">
                        <span>0$</span>
                        <span>5000$</span>
                    </div>
                </div>

                <div className="rate">
                    <FieldLegend variant="label" className="text-graylighttext font-bold text-sm/5 uppercase mb-4">
                        min. rating
                    </FieldLegend>
                    <div className="flex items-center gap-.5">
                        {[1, 2, 3, 4, 5].map((num) => (
                            <FaStar
                                key={num}
                                onClick={() => setSelected(num)}
                                onMouseOver={() => setHover(num)}
                                onMouseLeave={() => setHover(selected)}
                                size={24}
                                className={`cursor-pointer me-1 ${num <= hover ? "text-darkmint" : "text-graylighttext/50"}`}
                            />
                        ))}
                        <span className="text-darktext/70 font-bold text-xs ms-2">{selected}.0 & Up</span>
                    </div>
                </div>

                <Button className="w-full h-12 font-bold text-base" variant={"darkmint"}>
                    Apply Filters
                </Button>


            </form>
        </>

    )
}

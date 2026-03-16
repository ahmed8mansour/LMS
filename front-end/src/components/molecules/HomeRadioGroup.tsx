"use client"
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
    FieldTitle,
} from "@/components/atoms/field"
import { RadioGroup, RadioGroupItem } from "@/components/molecules/radio-group"
import { useState } from "react";

type Props = {
    selected: string
    setSelected: (v: string) => void
}

export default function HomeRadioGroup({selected , setSelected}:Props) {

    return (
        <RadioGroup
            value={selected}
            onValueChange={setSelected }
            defaultChecked
            className="flex flex-wrap gap-2 sm:gap-x-4"
        >
            {[
                'All Categories',
                'Design & UI/UX',
                'Development',
                'Business',
                'Marketing',
            ].map((element, idx) => {
                return (
                    <FieldLabel
                        htmlFor={element}
                        className="h-10 rounded-4xl min-w-[130px] px-3 flex-1 sm:flex-none cursor-pointer flex items-center justify-center text-center bg-darkbg hover:bg-darkbg/45"
                        key={idx}
                    >
                        <Field orientation="horizontal">
                            <FieldContent className="flex items-center justify-center">
                                <FieldTitle className="text-xs sm:text-sm">{element}</FieldTitle>
                            </FieldContent>
                            <RadioGroupItem value={element[0].toLowerCase() + element.slice(1)} className="hidden" id={element} />
                        </Field>
                    </FieldLabel>
                );
            })}
        </RadioGroup>
    )
}

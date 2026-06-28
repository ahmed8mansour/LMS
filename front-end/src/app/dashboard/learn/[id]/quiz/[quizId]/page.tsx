'use client';

import { Info, Send } from "lucide-react";
import { useUIStore } from "@/store/ui.store";
import { Button } from "@/components/atoms/button";
const mockQuizData = {
  section: "Section 2: Layout Masterclass",
  title: "Section Quiz",
  questions: [
    {
      id: 1,
      question: "What is the primary purpose of a baseline grid in UI design?",
      options: [
        { id: "a", text: "A) To align icons" },
        { id: "b", text: "B) To maintain vertical rhythm" },
        { id: "c", text: "C) To define border-radius" },
        { id: "d", text: "D) To choose font families" },
      ],
    },
    {
      id: 2,
      question: "In a 12-column grid system, what is the standard gutter width often used for desktop layouts?",
      options: [
        { id: "a", text: "A) 8px" },
        { id: "b", text: "B) 16px" },
        { id: "c", text: "C) 24px" },
        { id: "d", text: "D) 32px" },
      ],
    },
    {
      id: 3,
      question: "What characterizes an asymmetric composition?",
      options: [
        { id: "a", text: "A) Equal weight on both sides" },
        { id: "b", text: "B) Use of a central axis" },
        { id: "c", text: "C) Balanced but unequal visual weight" },
        { id: "d", text: "D) Random placement of elements" },
      ],
    },
  ],
};

export default function QuizPage() {
  const isSidebarOpen = useUIStore((state) => state.isLearnSideBarOpen);

  return (
    <>
      <div className="max-w-5xl mx-auto p-4 md:p-8 lg:p-10 space-y-8 pb-24">
        <header className="mb-8">
          <p className="text-sm font-medium text-graytext mb-1">{mockQuizData.section}</p>
          <h1 className="text-3xl md:text-4xl font-headline font-bold text-foreground mb-3">
            {mockQuizData.title}
          </h1>
          <div className="flex items-center gap-2 p-3 bg-darkbg text-muted-foreground rounded-lg border border-border/30">
            <Info className="w-5 h-5 text-darkmint flex-shrink-0" />
            <p className="text-sm">Answer all questions below, then submit to record your score.</p>
          </div>
        </header>

        <form className="flex-1 flex flex-col gap-8 pb-24" id="quiz-form">
          <section className="bg-card rounded-xl p-6 shadow-sm border border-border/40">
            <h3 className="text-lg font-headline font-semibold text-foreground mb-4 flex items-center gap-3">
              <span className="bg-primary/10 text-primary h-7 w-7 rounded-full flex items-center justify-center text-sm shrink-0">1</span>
              What is the primary purpose of a baseline grid in UI design?
            </h3>
            <div className="flex flex-col gap-3 ml-10">
              {mockQuizData.questions[0].options.map((option) => (
                <label
                  key={option.id}
                  className="radio-card cursor-pointer flex items-center p-4 border border-border rounded-lg hover:bg-muted/20 transition-colors"
                >
                  <input className="sr-only" name="q1" type="radio" value={option.id} />
                  <div className="radio-indicator w-5 h-5 rounded-full border-2 border-border flex items-center justify-center mr-4 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-muted opacity-0 scale-50 transition-all duration-200" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{option.text}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="bg-card rounded-xl p-6 shadow-sm border border-border/40">
            <h3 className="text-lg font-headline font-semibold text-foreground mb-4 flex items-center gap-3">
              <span className="bg-primary/10 text-primary h-7 w-7 rounded-full flex items-center justify-center text-sm shrink-0">2</span>
              In a 12-column grid system, what is the standard gutter width often used for desktop layouts?
            </h3>
            <div className="flex flex-col gap-3 ml-10">
              {mockQuizData.questions[1].options.map((option) => (
                <label
                  key={option.id}
                  className="radio-card cursor-pointer flex items-center p-4 border border-border rounded-lg hover:bg-muted/20 transition-colors"
                >
                  <input className="sr-only" name="q2" type="radio" value={option.id} />
                  <div className="radio-indicator w-5 h-5 rounded-full border-2 border-border flex items-center justify-center mr-4 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-muted opacity-0 scale-50 transition-all duration-200" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{option.text}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="bg-card rounded-xl p-6 shadow-sm border border-border/40">
            <h3 className="text-lg font-headline font-semibold text-foreground mb-4 flex items-center gap-3">
              <span className="bg-primary/10 text-primary h-7 w-7 rounded-full flex items-center justify-center text-sm shrink-0">3</span>
              What characterizes an asymmetric composition?
            </h3>
            <div className="flex flex-col gap-3 ml-10">
              {mockQuizData.questions[2].options.map((option) => (
                <label
                  key={option.id}
                  className="radio-card cursor-pointer flex items-center p-4 border border-border rounded-lg hover:bg-muted/20 transition-colors"
                >
                  <input className="sr-only" name="q3" type="radio" value={option.id} />
                  <div className="radio-indicator w-5 h-5 rounded-full border-2 border-border flex items-center justify-center mr-4 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-muted opacity-0 scale-50 transition-all duration-200" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{option.text}</span>
                </label>
              ))}
            </div>
          </section>
        </form>

        <div className={`fixed bottom-0 left-0 w-full  border-t border-border bg-background/80 backdrop-blur-md p-4 z-20 transition-[left,width] duration-300 ease-in-out ${
            isSidebarOpen ? "md:left-80 md:w-[calc(100%-20rem)]" : "md:left-0 md:w-full"
          }`}>
          <div className="max-w-5xl px-8 w-full mx-auto flex justify-center">
            <Button variant={"darkmint"} className="w-full py-4 min-h-12 font-headline font-bold text-lg flex items-center justify-center gap-2  disabled:cursor-not-allowed active:scale-[0.98]">
                Submit Quiz
                <Send className="w-5 h-5" />
            </Button>

          </div>
        </div>
      </div>
    </>
  );
}

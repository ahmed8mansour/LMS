import Hero from "@/components/organisms/Hero";
import CoursesSection from "@/features/courses/components/HomePageCoursesSection";
import ServicesSection from "@/components/organisms/ServicesSection";
export default function Home() {
  return (
      <>
        <Hero />
        <CoursesSection />
        <ServicesSection />
      </>
  );
}

import { FaRegCheckCircle } from "react-icons/fa";

type porps = {goals : string[]}
export default function CourseGoals({goals} :porps ) {

    // const goals = [ "Design globally distributed database clusters", "Implement advanced caching strategies using Redis", "Master horizontal vs vertical scaling trade-offs", "Architect event-driven microservices with Kafka", "Ensure 99.99% availability in production", "Optimizing SQL queries for multi-tenant SaaS" ]
    return (
        <div className="goals_list flex flex-col p-6 sm:p-8 gap-6 bg-white rounded-2xl border border-graylighttext/40">
            <h2 className="text-lg sm:text-xl font-bold text-darktext">What you'll learn</h2>
            <ul className="text-body list-inside space-y-2">
                {goals.map((goal, index) => (
                    <li className="flex items-start gap-2 text-xs sm:text-sm/5 font-medium" key={goal}>
                        <FaRegCheckCircle className="w-4 h-4 text-darkmint shrink-0 mt-0.5" />
                        <span>{goal}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

export const courses = [
    {
        ImageUrl: "/images/home/image.png",
        Name: "React Mastery",
        About: "Learn React from scratch with hands-on projects and expert guidance.",
        Price: 49,
        AvaterUrl: "",
        Instructor: "Jane Doe",
        Rate: 4.8,
        Subscribers: 1520,
        Tag: "Best Seller",
        Goals: [
            "Design globally distributed database clusters",
            "Implement advanced caching strategies using Redis",
            "Master horizontal vs vertical scaling trade-offs",
            "Architect event-driven microservices with Kafka",
            "Ensure 99.99% availability in production",
            "Optimizing SQL queries for multi-tenant SaaS"
        ],
        Sections: [
            {
                name: "React Fundamentals",
                lectures: [
                    { name: "JSX and Rendering Elements", time: "15:20" },
                    { name: "Components and Props", time: "11:45" },
                ],
                quiz: {
                    name: "Fundamentals Quiz",
                    numofquestions: 8
                }
            },
            {
                name: "State Management in React",
                lectures: [
                    { name: "State and Lifecycle", time: "13:10" },
                    { name: "Using useState and useEffect", time: "17:42" },
                ],
                quiz: {
                    name: "State Management Quiz",
                    numofquestions: 10
                }
            },
            {
                name: "Advanced React Patterns",
                lectures: [
                    { name: "Custom Hooks", time: "14:22" },
                    { name: "Context API and Reducers", time: "12:33" },
                ],
                quiz: {
                    name: "Advanced Patterns",
                    numofquestions: 9
                }
            }
        ]
    },
    {
        ImageUrl: "/images/home/image.png",
        Name: "UI/UX Design Bootcamp",
        About: "Master UI/UX fundamentals, wireframing, and user research techniques.",
        Price: 59,
        AvaterUrl: "",
        Instructor: "John Smith",
        Rate: 4.7,
        Subscribers: 985,
        Tag: "Design",
        Goals: [
            "Understand the principles of user-centered design",
            "Create wireframes and mockups using industry tools",
            "Conduct effective user research and usability testing",
            "Develop intuitive navigation and information architectures",
            "Apply color theory and typography for improved UX",
            "Design responsive interfaces for web and mobile"
        ],
        Sections: [
            {
                name: "UI Design Essentials",
                lectures: [
                    { name: "Typography & Color Theory", time: "13:15" },
                    { name: "Design Grids and Layouts", time: "10:50" }
                ],
                quiz: {
                    name: "UI Basics",
                    numofquestions: 7
                }
            },
            {
                name: "UX Research & Testing",
                lectures: [
                    { name: "User Interview Techniques", time: "16:00" },
                    { name: "Usability Testing Methods", time: "12:34" }
                ],
                quiz: {
                    name: "Research Quiz",
                    numofquestions: 9
                }
            },
            {
                name: "Wireframing & Prototyping",
                lectures: [
                    { name: "Wireframing with Figma", time: "18:20" },
                    { name: "Interactive Prototyping", time: "14:05" }
                ],
                quiz: {
                    name: "Wireframes & Prototypes",
                    numofquestions: 8
                }
            }
        ]
    },
    {
        ImageUrl: "/images/home/image.png",
        Name: "Python for Data Science",
        About: "A comprehensive course covering Python basics, Pandas, and machine learning.",
        Price: 65,
        AvaterUrl: "",
        Instructor: "Emily Clark",
        Rate: 4.9,
        Subscribers: 2044,
        Tag: "Data Science",
        Goals: [
            "Write clean and efficient Python code",
            "Manipulate and analyze data with Pandas",
            "Work with NumPy for scientific computing",
            "Visualize data using Matplotlib and Seaborn",
            "Understand the basics of machine learning",
            "Deploy machine learning models in real applications"
        ],
        Sections: [
            {
                name: "Python Fundamentals",
                lectures: [
                    { name: "Variables, Data Types, and Loops", time: "13:00" },
                    { name: "Functions and Modules", time: "15:30" }
                ],
                quiz: {
                    name: "Python Basics",
                    numofquestions: 8
                }
            },
            {
                name: "Data Analysis with Pandas",
                lectures: [
                    { name: "Pandas DataFrames and Series", time: "14:20" },
                    { name: "Data Cleaning Techniques", time: "12:55" }
                ],
                quiz: {
                    name: "Pandas Quiz",
                    numofquestions: 10
                }
            },
            {
                name: "Machine Learning Intro",
                lectures: [
                    { name: "Linear Regression Concepts", time: "18:15" },
                    { name: "Classifying with scikit-learn", time: "16:05" }
                ],
                quiz: {
                    name: "ML Basics",
                    numofquestions: 9
                }
            }
        ]
    },
    {
        ImageUrl: "/images/home/image.png",
        Name: "Fullstack Web Development",
        About: "Build modern websites and APIs using JavaScript, Node.js, and more.",
        Price: 75,
        AvaterUrl: "",
        Instructor: "Michael Brown",
        Rate: 4.85,
        Subscribers: 1732,
        Tag: "Development",
        Goals: [
            "Build responsive web pages with HTML, CSS, and JavaScript",
            "Develop RESTful APIs with Node.js and Express",
            "Deploy web apps using modern cloud providers",
            "Understand authentication and data security best practices",
            "Work with databases like MongoDB and PostgreSQL",
            "Implement front-end frameworks like React or Vue"
        ],
        Sections: [
            {
                name: "Frontend Development",
                lectures: [
                    { name: "Building Pages with HTML & CSS", time: "16:06" },
                    { name: "Modern JavaScript Essentials", time: "14:39" }
                ],
                quiz: {
                    name: "Frontend Quiz",
                    numofquestions: 9
                }
            },
            {
                name: "Backend with Node.js",
                lectures: [
                    { name: "Express Router and Middleware", time: "18:04" },
                    { name: "RESTful API Design", time: "13:45" }
                ],
                quiz: {
                    name: "Backend Quiz",
                    numofquestions: 8
                }
            },
            {
                name: "Database Integration",
                lectures: [
                    { name: "NoSQL with MongoDB", time: "17:55" },
                    { name: "SQL with PostgreSQL", time: "16:18" }
                ],
                quiz: {
                    name: "Database Quiz",
                    numofquestions: 7
                }
            }
        ]
    },
    {
        ImageUrl: "/images/home/image.png",
        Name: "Digital Marketing Essentials",
        About: "Discover SEO, email marketing, and social media strategies for growth.",
        Price: 42,
        AvaterUrl: "",
        Instructor: "Sophia Lee",
        Rate: 4.6,
        Subscribers: 1190,
        Tag: "Marketing",
        Goals: [
            "Master search engine optimization (SEO) fundamentals",
            "Plan and execute successful email marketing campaigns",
            "Leverage social media platforms for brand growth",
            "Analyze marketing metrics to optimize campaigns",
            "Create compelling digital ads and content",
            "Develop a scalable marketing strategy"
        ],
        Sections: [
            {
                name: "SEO Fundamentals",
                lectures: [
                    { name: "On-Page and Off-Page SEO", time: "13:30" },
                    { name: "Keyword Research Techniques", time: "10:20" }
                ],
                quiz: {
                    name: "SEO Basics",
                    numofquestions: 8
                }
            },
            {
                name: "Email Marketing",
                lectures: [
                    { name: "Building Email Lists", time: "12:40" },
                    { name: "Crafting Effective Email Campaigns", time: "11:56" }
                ],
                quiz: {
                    name: "Email Campaigns Quiz",
                    numofquestions: 9
                }
            },
            {
                name: "Social Media Strategy",
                lectures: [
                    { name: "Choosing The Right Platforms", time: "15:45" },
                    { name: "Creating Viral Content", time: "14:12" }
                ],
                quiz: {
                    name: "Social Media Quiz",
                    numofquestions: 7
                }
            }
        ]
    },
    {
        ImageUrl: "/images/home/image.png",
        Name: "Business Analytics Crash Course",
        About: "Unlock insights with business analytics, dashboards, and data storytelling.",
        Price: 55,
        AvaterUrl: "",
        Instructor: "David Kim",
        Rate: 4.7,
        Subscribers: 950,
        Tag: "Business",
        Goals: [
            "Translate business problems into analytical solutions",
            "Design and build interactive dashboards",
            "Use Excel and business intelligence tools effectively",
            "Visualize data and tell impactful stories",
            "Conduct financial and market analysis",
            "Understand KPIs and business metrics"
        ],
        Sections: [
            {
                name: "Excel for Analytics",
                lectures: [
                    { name: "Business Formulas and Functions", time: "10:30" },
                    { name: "Pivot Tables and Data Visualization", time: "14:50" }
                ],
                quiz: {
                    name: "Excel Quiz",
                    numofquestions: 9
                }
            },
            {
                name: "Building Dashboards",
                lectures: [
                    { name: "Dashboard Design Principles", time: "13:18" },
                    { name: "Storytelling with Data", time: "12:23" }
                ],
                quiz: {
                    name: "Dashboards Quiz",
                    numofquestions: 8
                }
            },
            {
                name: "Business Metrics & KPIs",
                lectures: [
                    { name: "Defining Key Metrics", time: "11:26" },
                    { name: "Tracking and Reporting", time: "15:03" }
                ],
                quiz: {
                    name: "Metrics Quiz",
                    numofquestions: 7
                }
            }
        ]
    },
    {
        ImageUrl: "/images/home/image.png",
        Name: "Machine Learning Basics",
        About: "Get started with machine learning algorithms and model deployment.",
        Price: 69,
        AvaterUrl: "",
        Instructor: "Lisa Turner",
        Rate: 4.8,
        Subscribers: 1375,
        Tag: "Data Science",
        Goals: [
            "Understand supervised and unsupervised learning",
            "Build regression and classification models",
            "Evaluate the performance of ML models",
            "Preprocess data for better ML outcomes",
            "Deploy machine learning models to production",
            "Explore ethical concerns in AI and ML"
        ],
        Sections: [
            {
                name: "ML Foundations",
                lectures: [
                    { name: "Types of Machine Learning", time: "11:52" },
                    { name: "Data Preprocessing Techniques", time: "13:26" }
                ],
                quiz: {
                    name: "ML Foundations Quiz",
                    numofquestions: 8
                }
            },
            {
                name: "Model Training",
                lectures: [
                    { name: "Training Algorithms", time: "14:37" },
                    { name: "Cross-Validation and Evaluation", time: "16:20" }
                ],
                quiz: {
                    name: "Training Quiz",
                    numofquestions: 10
                }
            },
            {
                name: "Deployment and Ethics",
                lectures: [
                    { name: "Deploying ML Models", time: "13:10" },
                    { name: "Ethical AI & Bias", time: "10:44" }
                ],
                quiz: {
                    name: "Deployment Quiz",
                    numofquestions: 7
                }
            }
        ]
    },
    {
        ImageUrl: "/images/home/image.png",
        Name: "Creative Graphic Design",
        About: "Learn Adobe tools and create eye-catching graphics for any purpose.",
        Price: 60,
        AvaterUrl: "",
        Instructor: "Carlos Romero",
        Rate: 4.75,
        Subscribers: 1108,
        Tag: "Design",
        Goals: [
            "Master Adobe Photoshop and Illustrator basics",
            "Create professional-quality digital illustrations",
            "Apply design principles for visual impact",
            "Prepare artwork for print and web use",
            "Develop a personal graphic design portfolio",
            "Understand branding and marketing through design"
        ],
        Sections: [
            {
                name: "Adobe Photoshop Basics",
                lectures: [
                    { name: "Working With Layers", time: "14:10" },
                    { name: "Photo Retouching Skills", time: "13:52" }
                ],
                quiz: {
                    name: "Photoshop Quiz",
                    numofquestions: 7
                }
            },
            {
                name: "Illustrator Essentials",
                lectures: [
                    { name: "Vector Illustrations 101", time: "16:36" },
                    { name: "Logo and Identity Design", time: "12:45" }
                ],
                quiz: {
                    name: "Illustrator Quiz",
                    numofquestions: 8
                }
            },
            {
                name: "Design for Web & Print",
                lectures: [
                    { name: "Preparing Artwork for Print", time: "11:24" },
                    { name: "Exporting for Web", time: "10:48" }
                ],
                quiz: {
                    name: "Web & Print Quiz",
                    numofquestions: 7
                }
            }
        ]
    },
    {
        ImageUrl: "/images/home/image.png",
        Name: "Startup Fundamentals",
        About: "Everything you need to know to launch and grow your startup.",
        Price: 58,
        AvaterUrl: "",
        Instructor: "Angela White",
        Rate: 4.6,
        Subscribers: 890,
        Tag: "Business",
        Goals: [
            "Validate startup ideas and build MVPs",
            "Develop business models and pitch decks",
            "Understand funding rounds and investor relations",
            "Set up legal and financial structures",
            "Recruit and lead a founding team",
            "Market and scale your startup effectively"
        ],
        Sections: [
            {
                name: "Building a Startup",
                lectures: [
                    { name: "Ideation and MVP Creation", time: "13:33" },
                    { name: "Lean Startup Methodology", time: "15:25" }
                ],
                quiz: {
                    name: "Startup Basics",
                    numofquestions: 9
                }
            },
            {
                name: "Funding & Pitching",
                lectures: [
                    { name: "Preparing Pitch Decks", time: "12:12" },
                    { name: "Dealing with Investors", time: "10:39" }
                ],
                quiz: {
                    name: "Funding Quiz",
                    numofquestions: 8
                }
            },
            {
                name: "Scaling Your Business",
                lectures: [
                    { name: "Team Formation & Leadership", time: "14:47" },
                    { name: "Scaling Strategies", time: "13:19" }
                ],
                quiz: {
                    name: "Scaling Quiz",
                    numofquestions: 7
                }
            }
        ]
    }
];

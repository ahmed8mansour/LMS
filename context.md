## the project :

LMS (Learning Management System)
Stack: Django + Next.js + PostgreSQL + Stripe

## django existed apps :

- authentication: Custom User, StudentProfile, InstructorProfile , AdminProfile ,EmailOTP , PasswordResetToken
- courses: Course, Section, Lecture, Quiz, Question, Choice
- enrollment: Order, Transaction, Enrollment
- progress: LectureProgress, QuizAttempt, QuizAttemptAnswer

## what done :

- [x] Authentication (JWT + Social Login , OTP serivce for several feature)
- [x] Stripe Payment and enrollment handling (PaymentIntent + Webhook)
- [x] Courses view to show courses data for unauthenticated user
- [x] Student Dashboard Overview + my courses + section (only backend)
- [x] Section Progress View

* you can check my views in the different apps in django to check what is done 


## In Front end :
- I'm using 3-4 layers structure [business , ui , service , infrastucture]
- you can see that in src/featuers folder 
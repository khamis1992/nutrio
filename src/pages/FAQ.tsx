import { Link } from "react-router-dom";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

const FAQ = () => {
  const faqCategories = [
    {
      category: "Getting Started",
      questions: [
        {
          question: "How do I create an account?",
          answer: "Creating an account is easy! Click 'Get Started' on our homepage, complete the onboarding questionnaire about your health goals, body metrics, and dietary preferences, and you'll have your personalized nutrition plan ready in minutes."
        },
        {
          question: "How are my daily calorie and macro targets calculated?",
          answer: "We use scientifically-backed formulas including your age, gender, height, weight, activity level, and health goals (lose, gain, or maintain weight) to calculate your Basal Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE). Your targets are then customized based on your specific goals."
        },
        {
          question: "Can I update my health goals later?",
          answer: "Absolutely! You can update your profile and health goals anytime through your account settings. Your nutrition targets will automatically recalculate based on your new information."
        }
      ]
    },
    {
      category: "Subscriptions & Pricing",
      questions: [
        {
          question: "What subscription plans do you offer?",
          answer: "We offer two flexible plans: Weekly (QAR 29/week) for those who want to try our service, and Monthly (QAR 89/month) which offers better value with a 23% savings. Both plans include access to all partner restaurants and personalized meal planning."
        },
        {
          question: "Can I cancel my subscription anytime?",
          answer: "Yes, you can cancel your subscription at any time through your account settings. Your access will continue until the end of your current billing period. We don't offer refunds for partial periods."
        },
        {
          question: "What payment methods do you accept?",
          answer: "We accept all major credit cards (Visa, MasterCard, American Express), debit cards, and digital payment methods. All payments are processed securely through our payment partner."
        },
        {
          question: "Is there a free trial?",
          answer: "While we don't offer a traditional free trial, our weekly plan is a great low-commitment way to try the service. You can cancel anytime if it's not right for you."
        }
      ]
    },
    {
      category: "Meals & Ordering",
      questions: [
        {
          question: "How do I order meals?",
          answer: "Browse our partner restaurants, filter by dietary preferences, and select meals that fit your nutrition goals. Schedule your meals for breakfast, lunch, or dinner on your preferred dates, and we'll handle the rest!"
        },
        {
          question: "Can I filter meals by dietary restrictions?",
          answer: "Yes! We offer extensive dietary filters including Keto, Vegan, Vegetarian, Gluten-Free, Dairy-Free, Low-Carb, High-Protein, and more. You can set your preferences in your profile for personalized recommendations."
        },
        {
          question: "How far in advance can I schedule meals?",
          answer: "You can schedule meals up to 2 weeks in advance. We recommend scheduling at least 24 hours ahead to ensure restaurant availability and timely preparation."
        },
        {
          question: "What if I need to cancel or modify an order?",
          answer: "Orders can be modified or cancelled up to 24 hours before the scheduled delivery time. After that, the meal credit may be forfeited. Contact our support team for assistance with last-minute changes."
        },
        {
          question: "How many meals can I order per week?",
          answer: "The number of meals depends on your subscription plan. Check your subscription details in your account to see your weekly meal allowance. Unused meals don't roll over to the next week."
        }
      ]
    },
    {
      category: "Delivery",
      questions: [
        {
          question: "What are your delivery hours?",
          answer: "Delivery hours vary by restaurant partner, but typically we deliver between 7 AM and 9 PM. You'll see available delivery windows when scheduling your meals."
        },
        {
          question: "Can I track my delivery?",
          answer: "Yes! Once your order is confirmed and out for delivery, you can track its status in real-time through the Delivery Tracking page in your account."
        },
        {
          question: "What areas do you deliver to?",
          answer: "We currently deliver within a 10-mile radius of our partner restaurants. Enter your address during signup to see available restaurants in your area."
        },
        {
          question: "Is there a delivery fee?",
          answer: "No, delivery is completely FREE on all orders! We believe healthy eating should be accessible to everyone, so we cover all delivery costs. No minimum order value required."
        }
      ]
    },
    {
      category: "Nutrition & Health",
      questions: [
        {
          question: "How accurate is the nutritional information?",
          answer: "Nutritional information is provided by our partner restaurants and calculated based on standard serving sizes. While we strive for accuracy, actual values may vary slightly. Use the information as a guideline for your nutrition planning."
        },
        {
          question: "Can I track my progress over time?",
          answer: "Yes! Our Progress page shows detailed charts of your calorie intake, macronutrient breakdown, and weight changes over time. You can log your daily weight and see trends to stay motivated."
        },
        {
          question: "Is the nutrition advice from a professional?",
          answer: "Our calorie and macro calculations are based on established nutritional science and formulas. However, this is not medical advice. For specific health concerns or conditions, please consult a registered dietitian or healthcare provider."
        },
        {
          question: "Do you accommodate food allergies?",
          answer: "We provide allergen information for all meals when available. However, meals are prepared in commercial kitchens that may handle common allergens. If you have severe allergies, please contact the restaurant directly before ordering."
        }
      ]
    },
    {
      category: "Account & Support",
      questions: [
        {
          question: "How do I reset my password?",
          answer: "Click 'Forgot Password' on the login page and enter your email address. We'll send you a secure link to reset your password. The link expires after 24 hours for security."
        },
        {
          question: "How can I contact customer support?",
          answer: "You can reach our support team through the Support page in your account, by emailing support@nutribox.com, or by calling our helpline. We typically respond within 24 hours."
        },
        {
          question: "Can I have multiple delivery addresses?",
          answer: "Yes! You can save multiple addresses (home, work, etc.) in your account and select the appropriate one when scheduling each meal delivery."
        },
        {
          question: "How do I refer a friend?",
          answer: "Visit the Affiliate Program in your account to get your unique referral code. When friends sign up using your code and place orders, you earn commissions automatically!"
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="text-center mb-12">
          <Badge variant="soft" className="mb-4">
            <HelpCircle className="w-3 h-3 mr-1" />
            Help Center
          </Badge>
          <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Find answers to common questions about NUTRIO. Can't find what you're looking for? 
            <Link to="/contact" className="text-primary hover:underline ml-1">Contact us</Link>.
          </p>
        </div>

        <div className="space-y-8">
          {faqCategories.map((category, categoryIndex) => (
            <div key={categoryIndex}>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm text-primary font-bold">
                  {categoryIndex + 1}
                </span>
                {category.category}
              </h2>
              <Accordion type="single" collapsible className="space-y-2">
                {category.questions.map((item, questionIndex) => (
                  <AccordionItem
                    key={questionIndex}
                    value={`${categoryIndex}-${questionIndex}`}
                    className="border rounded-lg px-3 sm:px-4 py-2 bg-card"
                  >
                    <AccordionTrigger className="text-left hover:no-underline py-3">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>

        <div className="mt-12 p-8 bg-muted/50 rounded-2xl text-center">
          <h3 className="text-xl font-semibold mb-2">Still have questions?</h3>
          <p className="text-muted-foreground mb-4">
            Our support team is here to help you with any questions or concerns.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact">
              <Button variant="default">Contact Support</Button>
            </Link>
            <Link to="/support">
              <Button variant="outline">Submit a Ticket</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;

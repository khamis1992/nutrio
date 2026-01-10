import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl sm:max-w-4xl">
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 6, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using NutriBox ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our Service. We reserve the right to modify these Terms at any time, and your continued use of the Service constitutes acceptance of any modifications.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              NutriBox is a meal planning and delivery platform that connects users with restaurant partners to provide healthy, nutritionally-balanced meals. Our Service includes meal scheduling, nutritional tracking, subscription management, and delivery coordination.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Account Registration</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">To use our Service, you must:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Be at least 18 years of age</li>
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly update any changes to your information</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We reserve the right to suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Subscriptions and Payments</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong>4.1 Subscription Plans:</strong> We offer various subscription plans with different meal allowances and pricing. Plan details are available on our website.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong>4.2 Billing:</strong> Subscription fees are billed in advance on a weekly or monthly basis, depending on your selected plan. All fees are non-refundable except as expressly stated.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong>4.3 Auto-Renewal:</strong> Subscriptions automatically renew unless cancelled before the renewal date. You may cancel at any time through your account settings.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong>4.4 Price Changes:</strong> We reserve the right to modify pricing with reasonable notice. Existing subscribers will be notified of any price changes before their next billing cycle.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Orders and Delivery</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong>5.1 Order Placement:</strong> Orders must be placed within your subscription's meal allowance. Once an order is confirmed, modifications may be limited.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong>5.2 Delivery:</strong> We strive to deliver meals at the scheduled time. Delivery times are estimates and may vary due to circumstances beyond our control.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong>5.3 Cancellations:</strong> Order cancellations must be made at least 24 hours before the scheduled delivery time. Late cancellations may result in forfeiture of the meal credit.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Health and Dietary Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong>6.1 Not Medical Advice:</strong> Our nutritional information and recommendations are for informational purposes only and do not constitute medical advice. Consult a healthcare professional before making significant dietary changes.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong>6.2 Allergens:</strong> While we strive to accommodate dietary restrictions, we cannot guarantee that meals are free from allergens. If you have severe allergies, please contact us before ordering.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong>6.3 Nutritional Accuracy:</strong> Nutritional information is provided by our restaurant partners and may vary. Values are approximate and should be used as guidelines.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. User Conduct</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">You agree not to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Use the Service for any unlawful purpose</li>
              <li>Impersonate any person or entity</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Submit false or misleading information</li>
              <li>Harass or abuse restaurant partners or delivery personnel</li>
              <li>Resell or commercially exploit the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All content, trademarks, and intellectual property on our platform are owned by NutriBox or our licensors. You may not copy, modify, distribute, or create derivative works without our express written consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, NutriBox shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. Our total liability shall not exceed the amount you paid for the Service in the preceding 12 months.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that the Service will be uninterrupted, error-free, or secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold harmless NutriBox, its affiliates, officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Dispute Resolution</h2>
            <p className="text-muted-foreground leading-relaxed">
              Any disputes arising from these Terms or your use of the Service shall be resolved through binding arbitration in accordance with applicable arbitration rules. You waive any right to participate in class action lawsuits.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which NutriBox operates, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Severability</h2>
            <p className="text-muted-foreground leading-relaxed">
              If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">15. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms, please contact us at:
            </p>
            <div className="mt-4 text-muted-foreground">
              <p>Email: legal@nutribox.com</p>
              <p>Address: 123 Healthy Street, Wellness City, WC 12345</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;

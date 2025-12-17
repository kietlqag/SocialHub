import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "Perfect for small businesses and individuals",
    features: [
      "3 custom dashboards",
      "Basic data connectors",
      "Standard chart types",
      "Email support",
      "Mobile access"
    ],
    popular: false
  },
  {
    name: "Professional",
    price: "$79",
    period: "/month",
    description: "Ideal for growing businesses and teams",
    features: [
      "Unlimited dashboards",
      "Advanced data connectors",
      "All chart types & widgets",
      "Team collaboration (5 users)",
      "Priority support",
      "Automated alerts",
      "Custom branding"
    ],
    popular: true
  },
  {
    name: "Enterprise",
    price: "$199",
    period: "/month",
    description: "For large organizations with advanced needs",
    features: [
      "Unlimited dashboards",
      "Enterprise data connectors",
      "Advanced analytics & AI",
      "Unlimited team members",
      "24/7 phone support",
      "White-label solution",
      "Custom integrations",
      "API access",
      "Dedicated account manager"
    ],
    popular: false
  }
];

export function Pricing() {
  return (
    <section id="pricing" className="pricing-section py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="section-heading text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900">
            Choose the perfect plan for your needs
          </h2>
          <p className="section-subtitle mt-4 max-w-2xl mx-auto text-xl">
            Start with a 14-day free trial. No credit card required.
          </p>
        </div>
        
        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <Card key={index} className={`relative pricing-card ${plan.popular ? "popular" : ""}`}>
              {plan.popular && (
                <Badge className="plan-badge absolute -top-3 left-1/2 transform -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-semibold text-slate-900">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold plan-price">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                <CardDescription className="mt-3 text-base text-slate-600">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant={plan.popular ? "default" : "outline"}
                  className={`w-full mb-6 ${plan.popular ? "cta-primary" : "cta-ghost"}`}
                >
                  Start Free Trial
                </Button>
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start text-slate-700">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5 mr-3" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <p className="text-gray-600">
            Need a custom solution? <a href="/contact" className="text-primary hover:underline">Contact us</a> for enterprise pricing.
          </p>
        </div>
      </div>
    </section>
  );
}

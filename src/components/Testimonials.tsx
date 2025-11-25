import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Operations Manager",
    company: "RetailCorp",
    avatar: "SC",
    content: "SocialHub has transformed how we track our store performance. The custom dashboards give us real-time insights that have improved our efficiency by 40%.",
    rating: 5
  },
  {
    name: "Michael Rodriguez",
    role: "CEO",
    company: "Growth Ventures",
    avatar: "MR",
    content: "The drag-and-drop dashboard builder is incredible. We can now visualize all our business metrics in one place without needing a developer.",
    rating: 5
  },
  {
    name: "Emily Watson",
    role: "Finance Director",
    company: "TechStart Inc.",
    avatar: "EW",
    content: "SocialHub's data integration capabilities saved us weeks of manual reporting. Everything syncs automatically and the insights are invaluable.",
    rating: 5
  }
];

export function Testimonials() {
  return (
    <section id="testimonials" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl">
            Trusted by thousands of businesses
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-600">
            See what our customers are saying about SocialHub
          </p>
        </div>
        
        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="bg-white hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6">"{testimonial.content}"</p>
                <div className="flex items-center">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="" alt={testimonial.name} />
                    <AvatarFallback>{testimonial.avatar}</AvatarFallback>
                  </Avatar>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}, {testimonial.company}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

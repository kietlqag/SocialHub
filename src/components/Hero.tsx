import { Button } from "./ui/button";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { ArrowRight, Play } from "lucide-react";

type HeroProps = {
  onLoginOpen?: () => void;
  onSignUpOpen?: () => void;
  isAuthenticated?: boolean;
};

export function Hero({ onLoginOpen, onSignUpOpen, isAuthenticated }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-white to-gray-50 pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-center">
          <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
            <h1 className="text-4xl tracking-tight sm:text-5xl lg:text-6xl">
              <span className="block text-gray-900">Build powerful</span>
              <span className="block text-primary">dashboards</span>
              <span className="block text-gray-900">for your business</span>
            </h1>
            <p className="mt-3 text-base text-gray-500 sm:text-xl lg:text-lg xl:text-xl">
              Create custom dashboards to manage your company, store, inventory, and operations. 
              SocialHub makes business management visual and intuitive for teams of all sizes.
            </p>
            <div className="mt-8 sm:max-w-lg sm:mx-auto sm:text-center lg:text-left lg:mx-0">
              <div className="flex flex-col sm:flex-row gap-4">
                {!isAuthenticated && (
                  <Button size="lg" className="flex items-center justify-center" onClick={onSignUpOpen}>
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="flex items-center justify-center"
                >
                  <a href="https://youtu.be/D-HFZIXw930?si=sJ8AsolEGRUC8b54" target="_blank" rel="noopener noreferrer">
                    <span className="flex items-center">
                      <Play className="mr-2 h-4 w-4" />
                      Watch Demo
                    </span>
                  </a>
                </Button>
              </div>
              <div className="mt-6">
                <p className="text-sm text-gray-500">
                  ✓ 14-day free trial &nbsp;&nbsp; ✓ No credit card required &nbsp;&nbsp; ✓ Cancel anytime
                </p>
              </div>
            </div>
          </div>
          <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
            <div className="relative mx-auto w-full rounded-lg shadow-2xl lg:max-w-md">
              <ImageWithFallback
                className="w-full rounded-lg"
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMGRhc2hib2FyZCUyMGFuYWx5dGljcyUyMGludGVyZmFjZXxlbnwxfHx8fDE3NTk3NjQyMjl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Business Dashboard Interface"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

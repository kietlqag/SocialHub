import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";

export function Footer() {
  return (
    <footer className="footer-gradient text-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-bold text-white mb-4">SocialHub</h3>
            <p className="text-gray-300/80 mb-6 max-w-md">
              The intuitive dashboard builder that helps businesses visualize data, 
              track performance, and make informed decisions with beautiful, custom dashboards.
            </p>
            <div className="flex space-x-4">
              <Input 
                placeholder="Enter your email" 
                className="max-w-xs footer-input placeholder-gray-400"
              />
              <Button className="cta-primary glow-hover">Subscribe</Button>
            </div>
          </div>
          
          {/* Product Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2">
              <li><a href="#features" className="footer-link hover:text-white">Features</a></li>
              <li><a href="#pricing" className="footer-link hover:text-white">Pricing</a></li>
              <li><a href="#" className="footer-link hover:text-white">API</a></li>
              <li><a href="#" className="footer-link hover:text-white">Integrations</a></li>
            </ul>
          </div>
          
          {/* Company Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2">
              <li><a href="#" className="footer-link hover:text-white">About</a></li>
              <li><a href="#" className="footer-link hover:text-white">Blog</a></li>
              <li><a href="#" className="footer-link hover:text-white">Careers</a></li>
              <li><a href="#contact" className="footer-link hover:text-white">Contact</a></li>
            </ul>
          </div>
        </div>
        
        <Separator className="my-10 bg-white/10" />
        
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            Ac 2024 SocialHub. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0 text-sm">
            <a href="#" className="footer-link hover:text-white">Privacy Policy</a>
            <a href="#" className="footer-link hover:text-white">Terms of Service</a>
            <a href="#" className="footer-link hover:text-white">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";

export function Footer() {
  return (
    <footer className="footer-gradient text-gray-200">
      <div className="footer-inner max-w-6xl mx-auto space-y-12">
        <div className="footer-grid">
          {/* Company Info */}
          <div>
            <h3 className="text-2xl font-bold text-white mb-4">SocialHub</h3>
            <p className="footer-description mb-6 max-w-md">
              The intuitive dashboard builder that helps businesses visualize data, 
              track performance, and make informed decisions with beautiful, custom dashboards.
            </p>
            <div className="footer-newsletter">
              <Input 
                placeholder="Enter your email" 
                className="footer-input placeholder-gray-400"
              />
              <Button className="cta-primary glow-hover footer-subscribe">Subscribe</Button>
            </div>
          </div>
          
          <div className="footer-links-area">
            <div className="footer-links-grid">
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

              {/* Policy Links */}
              <div className="footer-policy-stack">
                <h4 className="font-semibold text-white mb-4">Policies</h4>
                <div className="footer-policy-links">
                  <a href="#" className="footer-link">Privacy Policy</a>
                  <a href="#" className="footer-link">Terms of Service</a>
                  <a href="#" className="footer-link">Cookie Policy</a>
                </div>
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
          </div>
        </div>
        
        <Separator className="my-10 bg-white/10" />
        
        <div className="footer-bottom flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <p className="footer-meta">
            Copyright 2024 SocialHub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

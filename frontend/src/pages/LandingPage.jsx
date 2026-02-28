import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import {
  ArrowRight,
  Check,
  Users,
  Zap,
  Brain,
  Play,
  ChevronDown,
  Menu,
  X,
  Facebook,
  Youtube,
  Linkedin
} from 'lucide-react';

const Page = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['hero', 'argo', 'features', 'agents', 'pricing'];
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "atsn ai",
    "description": "atsn ai | Autonomous AI Agents, Custom AI Agents and Chatbots ",
    "url": "https://atsnai.com",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "4999",
      "priceCurrency": "INR",
      "priceSpecification": {
        "@type": "PriceSpecification",
        "price": "4999",
        "priceCurrency": "INR",
        "billingDuration": "P1M"
      }
    },
    "creator": {
      "@type": "Organization",
      "name": "atsn ai",
      "url": "https://atsnai.com"
    },
    "featureList": [
      "Autonomous AI Agents",
      "Digital Marketing Automation",
      "Content Creation",
      "Social Media Management",
      "Campaign Optimization",
      "Analytics & Reporting"
    ]
  };

  return (
    <>
      <SEO
        title="atsn ai | Autonomous AI Agents, Custom AI Agents and Chatbots"
        description="atsn ai creates autonomous AI agents, chatbots, and consultancy solutions. Meet Emily, your AI marketing teammate for smarter business automation."
        keywords="AI agents, autonomous AI, digital marketing AI, Emily AI agent, AI content creation, social media automation, AI marketing, business automation, AI chatbot, AI consultancy, artificial intelligence"
        structuredData={structuredData}
      />

      <div className="min-h-screen bg-gray-900 text-white overflow-hidden">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-800/90 backdrop-blur-xl border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 sm:space-x-6 lg:space-x-8">
                <div className="text-xl sm:text-2xl md:text-3xl font-normal bg-gradient-to-r from-pink-500 via-white to-pink-500 bg-clip-text text-transparent animate-shiny">
                  atsn ai
                </div>
                <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
                  <button
                    onClick={() => scrollToSection('argo')}
                    className={`text-sm sm:text-base transition-colors font-normal ${activeSection === 'argo' ? 'text-pink-400' : 'text-gray-300 hover:text-white'}`}
                  >
                    Argo
                  </button>
                  <button
                    onClick={() => scrollToSection('features')}
                    className={`text-sm sm:text-base transition-colors font-normal ${activeSection === 'features' ? 'text-pink-400' : 'text-gray-300 hover:text-white'}`}
                  >
                    Features
                  </button>
                  
                  
                </div>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <a
                  href="/login"
                  className="hidden md:block text-sm sm:text-base text-gray-300 hover:text-white transition-colors font-normal"
                >
                  Sign In
                </a>
                <a
                  href="/signup"
                  className="bg-pink-600 text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm md:text-base font-normal hover:bg-pink-700 transition-all duration-300 transform hover:scale-105"
                >
                  Get Started
                </a>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="md:hidden text-white"
                >
                  {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden bg-gray-900/95 backdrop-blur-xl">
            <div className="flex flex-col items-center justify-center h-full space-y-6 sm:space-y-8">
              <button
                onClick={() => scrollToSection('argo')}
                className="text-lg sm:text-xl text-gray-300 hover:text-white transition-colors font-normal"
              >
                Argo
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="text-lg sm:text-xl text-gray-300 hover:text-white transition-colors font-normal"
              >
                Features
              </button>
              
              
              <a
                href="/login"
                className="text-lg sm:text-xl text-gray-300 hover:text-white transition-colors font-normal"
              >
                Sign In
              </a>
              <a
                href="/signup"
                className="bg-pink-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-base sm:text-lg font-normal hover:bg-pink-700 transition-all duration-300"
              >
                Get Started
              </a>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <section id="hero" className="relative min-h-[50vh] lg:min-h-screen flex items-center justify-center pt-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-900/40 via-purple-900/40 to-blue-900/40"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(236,72,153,0.15),transparent_60%)]"></div>

          {/* Robot Background Image */}
          <div className="absolute inset-0 z-0 flex items-center justify-center opacity-30 pointer-events-none lg:pt-12">
            <img
              src="/argo.png"
              alt=""
              className="w-full h-full object-contain object-center"
              onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=1200"; }}
            />
            <div className="absolute inset-0 bg-gray-900/40"></div>
          </div>

          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-center text-center">
            <h1 className="w-full text-center text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-4 sm:mb-6 leading-tight tracking-tight transition-all duration-300 bg-gradient-to-r from-white to-pink-400 bg-clip-text text-transparent pb-1">
              <span>
                Intelligent Motion <br /> Autonomous Future
              </span>
            </h1>

            <p className="w-full max-w-3xl mx-auto text-center text-base xs:text-lg sm:text-xl text-gray-300 mb-8 sm:mb-10 md:mb-12 leading-relaxed px-6 font-medium transition-all duration-300">
              Let's Build the Future Together
            </p>
          </div>

          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
            <button
              onClick={() => scrollToSection('argo')}
              className="text-gray-400 hover:text-white transition-colors animate-bounce"
            >
              <ChevronDown size={24} />
            </button>
          </div>
        </section>

        <section id="argo" className="relative py-12 sm:py-16 lg:py-20 bg-gray-900 border-t border-gray-800 overflow-hidden" >
          <div className="absolute inset-0 bg-gradient-to-br from-pink-900/30 via-purple-900/30 to-blue-900/30"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(236,72,153,0.15),transparent_70%)]"></div>

          <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
            <div className="text-center mb-10 sm:mb-12 lg:mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal mb-8 text-white text-center">
                Meet ARGO
              </h2>
            </div>

            <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-x-12 items-start">

              {/* Left column: Description + Features stacked together on desktop */}
              <div className="lg:col-start-1 flex flex-col items-center lg:items-start text-center lg:text-left w-full">
                {/* Description - always first */}
                <p className="text-xl lg:text-2xl xl:text-3xl text-gray-300 mb-6 lg:mb-4 leading-relaxed font-normal">
                  ARGO (Autonomous Robot for Goods and Operations) is our first in line robotic agent.
                  Designed to move from one point to another intelligently, it handles dynamic movements and perturbations with ease.
                </p>

                {/* Image - visible only on mobile between description and features */}
                <div className="lg:hidden w-full flex justify-center items-center my-6">
                  <img
                    src="/argo.png"
                    alt="ARGO Autonomous Robot"
                    className="w-full h-auto max-w-lg mx-auto object-contain drop-shadow-[0_20px_50px_rgba(236,72,153,0.3)]"
                    onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1546776310-eef45dd6d414?auto=format&fit=crop&q=80&w=800"; }}
                  />
                </div>

                {/* Features */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <span className="hidden lg:inline-block text-pink-500 text-2xl lg:text-3xl">•</span>
                    <p className="text-gray-300 text-lg lg:text-xl xl:text-2xl">Seamless integration with human environments</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="hidden lg:inline-block text-pink-500 text-2xl lg:text-3xl">•</span>
                    <p className="text-gray-300 text-lg lg:text-xl xl:text-2xl">Handles dynamic movements and perturbations</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="hidden lg:inline-block text-pink-500 text-2xl lg:text-3xl">•</span>
                    <p className="text-gray-300 text-lg lg:text-xl xl:text-2xl">The silent companion humans always needed</p>
                  </div>
                </div>
              </div>

              {/* Right column: Image - visible only on desktop */}
              <div className="hidden lg:flex lg:col-start-2 justify-center items-center">
                <img
                  src="/argo.png"
                  alt="ARGO Autonomous Robot"
                  className="w-full h-auto max-w-lg mx-auto object-contain drop-shadow-[0_20px_50px_rgba(236,72,153,0.3)]"
                  onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1546776310-eef45dd6d414?auto=format&fit=crop&q=80&w=800"; }}
                />
              </div>
            </div>

            <div className="mt-12 sm:mt-16 text-center">
              <div className="inline-flex items-center space-x-2 bg-pink-500/10 text-pink-400 px-6 py-3 rounded-full text-base font-medium border border-pink-500/20 shadow-lg shadow-pink-500/10 animate-pulse">
                <Zap className="w-5 h-5" />
                <span>Launching globally this May 16th</span>
              </div>
            </div>
          </div>
        </section >

        {/* Features Section */}
        <section id="features" className="py-12 sm:py-16 lg:py-20 bg-gray-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-6 sm:p-8 border border-gray-600 hover:border-pink-500/50 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto sm:mx-0">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-normal mb-2 sm:mb-3 md:mb-4 text-white text-center sm:text-left">Vision</h3>
                <p className="text-xs sm:text-sm md:text-base text-gray-300 leading-relaxed text-center sm:text-left font-normal">
                  To make machines move intelligently.
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-6 sm:p-8 border border-gray-600 hover:border-purple-500/50 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto sm:mx-0">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-normal mb-2 sm:mb-3 md:mb-4 text-white text-center sm:text-left">Mission</h3>
                <p className="text-xs sm:text-sm md:text-base text-gray-300 leading-relaxed text-center sm:text-left font-normal">
                  We build intelligent systems that help machines move safely, adapt quickly, and work naturally alongside people.
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-6 sm:p-8 border border-gray-600 hover:border-blue-500/50 transition-all duration-300 shadow-lg hover:shadow-xl sm:col-span-2 lg:col-span-1">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-pink-500 rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto sm:mx-0">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-normal mb-2 sm:mb-3 md:mb-4 text-white text-center sm:text-left">Why atsn ai?</h3>
                <p className="text-xs sm:text-sm md:text-base text-gray-300 leading-relaxed text-center sm:text-left font-normal">
                  Indoor movement of goods and repetitive operations are still dependent on humans. This leads to inefficiency, higher costs, and fatigue. We bridge this gap.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        < footer className="bg-gray-900 border-t border-gray-700 py-12" >
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div className="text-2xl font-normal bg-gradient-to-r from-pink-500 via-white to-pink-500 bg-clip-text text-transparent animate-shiny mb-4">
                  atsn ai
                </div>
                <p className="text-gray-300 mb-2 font-normal">
                  314, Gala Magnus, South Bopal, Ahmedabad
                </p>
                <p className="text-gray-300 mb-4 font-normal">
                  +91 9998198868
                </p>
                <div className="flex space-x-3 sm:space-x-4">
                  <a href="https://www.facebook.com/profile.php?id=61571044832864" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 border-2 border-white/50 rounded-full flex items-center justify-center hover:bg-[#1877F2] hover:border-[#1877F2] transition-all duration-300 cursor-pointer shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:shadow-[0_0_12px_rgba(24,119,242,0.6)]">
                    <Facebook className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </a>
                  <a
                    href="https://www.instagram.com/atsn.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 border-2 border-white/50 rounded-full flex items-center justify-center hover:bg-[#C2185B] hover:border-[#C2185B] transition-all duration-300 cursor-pointer shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:shadow-[0_0_12px_rgba(194,24,91,0.6)]"
                  >
                    <i className="fa-brands fa-instagram text-white text-lg sm:text-2xl"></i>
                  </a>
                  <a href="https://x.com/atsn_ai" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 border-2 border-white/50 rounded-full flex items-center justify-center hover:bg-black hover:border-black transition-all duration-300 cursor-pointer shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:shadow-[0_0_12px_rgba(0,0,0,0.6)]">
                    <i className="fa-brands fa-x-twitter text-white text-base sm:text-xl"></i>
                  </a>
                  <a href="https://www.youtube.com/@ATSNAI" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 border-2 border-white/50 rounded-full flex items-center justify-center hover:bg-[#FF0000] hover:border-[#FF0000] transition-all duration-300 cursor-pointer shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:shadow-[0_0_12px_rgba(255,0,0,0.6)]">
                    <Youtube className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </a>
                  <a href="https://www.linkedin.com/company/atsn-ai/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 border-2 border-white/50 rounded-full flex items-center justify-center hover:bg-[#0077B5] hover:border-[#0077B5] transition-all duration-300 cursor-pointer shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:shadow-[0_0_12px_rgba(0,119,181,0.6)]">
                    <Linkedin className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </a>
                </div>
              </div>

              <div>
                <h4 className="text-white font-normal mb-4">Product</h4>
                <ul className="space-y-2">
                  <li><a href="#features" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Features</a></li>
                  
                  <li><a href="/login" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Emily App</a></li>
                  <li><a href="#" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Documentation</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-normal mb-4">Company</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">About</a></li>
                  <li><Link to="/blog" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Blog</Link></li>
                  <li><a href="#" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Careers</a></li>
                  <li><Link to="/contact" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Contact</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-normal mb-4">Support</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Help Center</a></li>
                  <li><a href="#" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Community</a></li>
                  <li><a href="#" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Status</a></li>
                  <li><a href="#" className="text-gray-300 hover:text-pink-400 transition-colors font-normal">Security</a></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-gray-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm font-normal">
                © 2025 atsn ai. All rights reserved.
              </p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <Link to="/privacy" className="text-gray-400 hover:text-pink-400 text-sm transition-colors font-normal">Privacy</Link>
                <Link to="/terms" className="text-gray-400 hover:text-pink-400 text-sm transition-colors font-normal">Terms</Link>
                <Link to="/cancellation-refunds" className="text-gray-400 hover:text-pink-400 text-sm transition-colors font-normal">Cancellation & Refunds</Link>
                <Link to="/shipping" className="text-gray-400 hover:text-pink-400 text-sm transition-colors font-normal">Shipping</Link>
                <a href="#" className="text-gray-400 hover:text-pink-400 text-sm transition-colors font-normal">Cookies</a>
              </div>
            </div>
          </div>
        </footer >
      </div >
    </>
  );
};

export default Page;
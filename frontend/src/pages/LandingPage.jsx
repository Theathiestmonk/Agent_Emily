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

      <div className="min-h-screen text-white overflow-hidden relative">
        {/* Global Glass Background Layers */}
        <div className="fixed inset-0 bg-gray-950 z-[-2]"></div>
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(236,72,153,0.08),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(59,130,246,0.08),transparent_50%),radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.08),transparent_50%)] z-[-1]"></div>
        <div className="fixed inset-0 backdrop-blur-[100px] z-[-1]"></div>
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-800/90 backdrop-blur-xl border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 sm:space-x-6 lg:space-x-8">
                <div className="text-[26px] font-normal bg-gradient-to-r from-pink-500 via-white to-pink-500 bg-clip-text text-transparent animate-shiny">
                  atsn ai
                </div>
                <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
                  <button
                    onClick={() => scrollToSection('argo')}
                    className={`text-[16px] transition-colors font-normal ${activeSection === 'argo' ? 'text-pink-400' : 'text-gray-300 hover:text-white'}`}
                  >
                    Argo
                  </button>
                  <button
                    onClick={() => scrollToSection('features')}
                    className={`text-[16px] transition-colors font-normal ${activeSection === 'features' ? 'text-pink-400' : 'text-gray-300 hover:text-white'}`}
                  >
                    Features
                  </button>
                  <Link
                    to="/about"
                    className="text-[16px] transition-colors font-normal text-gray-300 hover:text-white"
                  >
                    About
                  </Link>

                </div>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <a
                  href="/login"
                  className="hidden md:block text-[16px] text-gray-300 hover:text-white transition-colors font-normal"
                >
                  Sign In
                </a>
                <a
                  href="/signup"
                  className="bg-pink-600 text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-[16px] font-normal hover:bg-pink-700 transition-all duration-300 transform hover:scale-105"
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
                className="text-[26px] text-gray-300 hover:text-white transition-colors font-normal"
              >
                Argo
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="text-[26px] text-gray-300 hover:text-white transition-colors font-normal"
              >
                Features
              </button>
              <Link
                to="/about"
                className="text-[26px] text-gray-300 hover:text-white transition-colors font-normal"
              >
                About
              </Link>

              <a
                href="/login"
                className="text-[26px] text-gray-300 hover:text-white transition-colors font-normal"
              >
                Sign In
              </a>
              <a
                href="/signup"
                className="bg-pink-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-[26px] font-normal hover:bg-pink-700 transition-all duration-300"
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
            <h1 className="w-full text-center text-[36px] md:text-[52px] lg:text-[80px] font-bold mb-4 sm:mb-6 leading-tight tracking-tight transition-all duration-300 bg-gradient-to-r from-white to-pink-400 bg-clip-text text-transparent pb-1">
              <span>
                Intelligent Motion <br /> Autonomous Future
              </span>
            </h1>

            <p className="w-full max-w-3xl mx-auto text-center text-[18px] md:text-[24px] lg:text-[32px] text-gray-300 mb-8 sm:mb-10 md:mb-12 leading-tight px-6 font-medium transition-all duration-300">
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



        {/* Section 2: Meet Argo */}
        <section id="argo" className="pt-8 pb-8 md:pt-12 md:pb-12 px-4 sm:px-6 relative z-20 border-t border-white/5 overflow-hidden backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-900/30 via-purple-900/30 to-blue-900/30 pointer-events-none"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(236,72,153,0.15),transparent_70%)] pointer-events-none"></div>

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-2 lg:mb-4">
              <h2 className="text-[42px] md:text-[68px] font-black text-white mb-4 sm:mb-6">Meet <span className="text-pink-500">Argo</span></h2>

              <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
                <div className="lg:w-1/2 flex flex-col items-start text-left text-[16px] md:text-[26px] font-medium text-gray-300 leading-relaxed md:leading-loose">
                  <div>
                    <span className="font-bold text-pink-500 mr-2">ARGO</span>
                    (Autonomous Robot for Goods and Operations) is designed to move intelligently from one point to another, handling dynamic environments and real-world perturbations with ease. It's built to operate safely and naturally within human spaces, seamlessly integrating with everyday tasks.
                  </div>

                </div>

                {/* Argo Image */}
                <div className="lg:w-1/2 flex justify-center items-center">
                  <img
                    src="/argo.png"
                    alt="ARGO Autonomous Robot"
                    className="w-full h-auto max-w-xl xl:max-w-2xl object-contain drop-shadow-[0_20px_50px_rgba(236,72,153,0.3)] hover:scale-105 transition-transform duration-500"
                    onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1546776310-eef45dd6d414?auto=format&fit=crop&q=80&w=800"; }}
                  />
                </div>
              </div>
            </div>

            {/* Launch Banner */}
            <div className="mt-4 sm:mt-6 mb-8 sm:mb-10 w-full flex justify-center">
              <div className="inline-flex items-center gap-2 px-5 py-2 sm:px-8 sm:py-3 rounded-full bg-[#1e1333] border border-pink-500/30 text-pink-400 font-medium text-[16px] md:text-[18px] shadow-[0_0_15px_rgba(236,72,153,0.1)] hover:shadow-[0_0_25px_rgba(236,72,153,0.2)] transition-shadow duration-300 cursor-default">
                <Zap className="w-5 h-5 md:w-6 md:h-6" />
                <span>Launching globally this May 16th</span>
              </div>
            </div>

            {/* Simple Professional Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Card 1 */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 lg:p-10 flex flex-col h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_30px_rgb(0,0,0,0.12)]">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-md shadow-pink-500/10 border border-pink-400/20">
                  <i className="fa-solid fa-compass text-[26px]"></i>
                </div>
                <h3 className="text-[26px] font-bold text-white mb-4 leading-tight">Autonomous Navigation</h3>
                <p className="text-[16px] text-gray-400 font-medium leading-relaxed">Independently plans and executes movement from origin to destination without manual intervention.</p>
              </div>

              {/* Card 2 */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 lg:p-10 flex flex-col h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_30px_rgb(0,0,0,0.12)]">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-md shadow-pink-500/10 border border-pink-400/20">
                  <i className="fa-solid fa-code-merge text-[26px]"></i>
                </div>
                <h3 className="text-[26px] font-bold text-white mb-4 leading-tight">Adaptive to Change</h3>
                <p className="text-[16px] text-gray-400 font-medium leading-relaxed">Responds to obstacles, shifts, and variations in real time.</p>
              </div>

              {/* Card 3 */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 lg:p-10 flex flex-col h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_30px_rgb(0,0,0,0.12)]">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-md shadow-pink-500/10 border border-pink-400/20">
                  <i className="fa-solid fa-users text-[26px]"></i>
                </div>
                <h3 className="text-[26px] font-bold text-white mb-4 leading-tight">Human Centric</h3>
                <p className="text-[16px] text-gray-400 font-medium leading-relaxed">Built to operate safely within human spaces naturally.</p>
              </div>

              {/* Card 4 */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 lg:p-10 flex flex-col h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_30px_rgb(0,0,0,0.12)]">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-md shadow-pink-500/10 border border-pink-400/20">
                  <i className="fa-solid fa-box-open text-[26px]"></i>
                </div>
                <h3 className="text-[26px] font-bold text-white mb-4 leading-tight">Purpose-Built for Goods</h3>
                <p className="text-[16px] text-gray-400 font-medium leading-relaxed">Designed to transport items efficiently, reducing repetitive manual effort in everyday operations.</p>
              </div>

            </div>
          </div>
        </section>

        {/* Section 3: Argo for Industries */}
        <section id="industries" className="pt-12 pb-24 border-t border-white/5 overflow-hidden relative backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-purple-900/30 to-pink-900/30 pointer-events-none"></div>

          <div className="w-full max-w-[1600px] px-4 sm:px-8 lg:px-12 xl:px-16 mx-auto relative z-10">
            <div className="text-center mb-16 px-4">
              <h2 className="text-[42px] md:text-[68px] font-black mb-6 text-white">Argo for <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">Industries</span></h2>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1 */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 lg:p-10 flex flex-col h-full hover:-translate-y-4 transition-all duration-300 group shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_30px_rgb(0,0,0,0.12)]">
                <div className="w-16 h-16 bg-pink-500/20 text-pink-400 rounded-2xl flex items-center justify-center text-[26px] mb-6 group-hover:scale-110 group-hover:bg-pink-500 group-hover:text-white transition-all duration-300 origin-left">
                  <span>🛎️</span>
                </div>
                <h3 className="text-[26px] font-bold mb-3 text-white leading-tight">Hotels</h3>
                <p className="text-[16px] text-gray-400 font-medium leading-relaxed">Elevating guest experiences with autonomous room deliveries and services.</p>
              </div>

              {/* Card 2 */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 lg:p-10 flex flex-col h-full hover:-translate-y-4 transition-all duration-300 group shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_30px_rgb(0,0,0,0.12)]" style={{ transitionDelay: '50ms' }}>
                <div className="w-16 h-16 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center text-[26px] mb-6 group-hover:scale-110 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300 origin-left">
                  <span>🏭</span>
                </div>
                <h3 className="text-[26px] font-bold mb-3 text-white leading-tight">Warehouses</h3>
                <p className="text-[16px] text-gray-400 font-medium leading-relaxed">Optimizing logistics and internal transport for peak warehouse efficiency.</p>
              </div>

              {/* Card 3 */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 lg:p-10 flex flex-col h-full hover:-translate-y-4 transition-all duration-300 group shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_30px_rgb(0,0,0,0.12)]" style={{ transitionDelay: '100ms' }}>
                <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center text-[26px] mb-6 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 origin-left">
                  <span>☕</span>
                </div>
                <h3 className="text-[26px] font-bold mb-3 text-white leading-tight">Restaurants</h3>
                <p className="text-[16px] text-gray-400 font-medium leading-relaxed">Supporting staff by handling repetitive transport tasks effortlessly.</p>
              </div>

              {/* Card 4 */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 lg:p-10 flex flex-col h-full hover:-translate-y-4 transition-all duration-300 group shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_30px_rgb(0,0,0,0.12)]" style={{ transitionDelay: '150ms' }}>
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center text-[26px] mb-6 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 origin-left">
                  <span>🏡</span>
                </div>
                <h3 className="text-[26px] font-bold mb-3 text-white leading-tight">Household</h3>
                <p className="text-[16px] text-gray-400 font-medium leading-relaxed">Your reliable companion for chores and moving items safely at home.</p>
              </div>
            </div>

            {/* Company Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
              {/* Vision Card */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 lg:p-10 flex flex-col h-full hover:-translate-y-4 transition-all duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_30px_rgb(0,0,0,0.12)]">
                <h3 className="text-[26px] font-bold mb-4 text-white leading-tight">Vision</h3>
                <p className="text-[16px] text-gray-400 font-medium leading-relaxed">To make machines move intelligently.</p>
              </div>

              {/* Mission Card */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 lg:p-10 flex flex-col h-full hover:-translate-y-4 transition-all duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_30px_rgb(0,0,0,0.12)]">
                <h3 className="text-[26px] font-bold mb-4 text-white leading-tight">Mission</h3>
                <p className="text-[16px] text-gray-400 font-medium leading-relaxed">We build intelligent systems that help machines move safely, adapt quickly, and work naturally alongside people.</p>
              </div>

              {/* Why atsn ai Card */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 lg:p-10 flex flex-col h-full hover:-translate-y-4 transition-all duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_30px_rgb(0,0,0,0.12)]">
                <h3 className="text-[26px] font-bold mb-4 text-white leading-tight">
                  Why atsn ai?
                </h3>
                <p className="text-[16px] text-gray-400 font-medium leading-relaxed">Indoor movement of goods and repetitive operations are still dependent on humans. This leads to inefficiency, higher costs, and fatigue. We bridge this gap.</p>
              </div>
            </div>

          </div>
        </section>

        {/* Footer */}
        <footer className="bg-white/5 backdrop-blur-3xl border-t border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] py-12 relative z-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div className="text-[26px] font-normal bg-gradient-to-r from-pink-500 via-white to-pink-500 bg-clip-text text-transparent animate-shiny mb-4">
                  atsn ai
                </div>
                <p className="text-[16px] text-gray-300 mb-2 font-normal">
                  314, Gala Magnus, South Bopal, Ahmedabad
                </p>
                <p className="text-[16px] text-gray-300 mb-4 font-normal">
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
                    <i className="fa-brands fa-instagram text-white text-[26px]"></i>
                  </a>
                  <a href="https://x.com/atsn_ai" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 border-2 border-white/50 rounded-full flex items-center justify-center hover:bg-black hover:border-black transition-all duration-300 cursor-pointer shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:shadow-[0_0_12px_rgba(0,0,0,0.6)]">
                    <i className="fa-brands fa-x-twitter text-white text-[26px]"></i>
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
                <h4 className="text-[26px] text-white font-normal mb-4 leading-tight">Product</h4>
                <ul className="space-y-2">
                  <li><a href="#features" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">Features</a></li>
                  <li><a href="/login" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">Emily App</a></li>
                  <li><a href="#" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">Documentation</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-[26px] text-white font-normal mb-4 leading-tight">Company</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">About</a></li>
                  <li><Link to="/blog" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">Blog</Link></li>
                  <li><a href="#" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">Careers</a></li>
                  <li><Link to="/contact" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">Contact</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="text-[26px] text-white font-normal mb-4 leading-tight">Support</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">Help Center</a></li>
                  <li><a href="#" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">Community</a></li>
                  <li><a href="#" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">Status</a></li>
                  <li><a href="#" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">Security</a></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-gray-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-[16px] font-normal">
                © 2025 atsn ai. All rights reserved.
              </p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <Link to="/privacy" className="text-gray-400 hover:text-pink-400 text-[16px] transition-colors font-normal">Privacy</Link>
                <Link to="/terms" className="text-gray-400 hover:text-pink-400 text-[16px] transition-colors font-normal">Terms</Link>
                <Link to="/cancellation-refunds" className="text-gray-400 hover:text-pink-400 text-[16px] transition-colors font-normal">Cancellation & Refunds</Link>
                <Link to="/shipping" className="text-gray-400 hover:text-pink-400 text-[16px] transition-colors font-normal">Shipping</Link>
                <a href="#" className="text-gray-400 hover:text-pink-400 text-[16px] transition-colors font-normal">Cookies</a>
              </div>
            </div>
          </div>
        </footer >
      </div >
    </>
  );
};

export default Page;
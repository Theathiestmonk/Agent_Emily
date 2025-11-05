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
  X
} from 'lucide-react';

const Page = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['hero', 'features', 'agents', 'pricing'];
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
      
      <div className="min-h-screen bg-[#F6F6F6] text-[#2E2E2E] overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-[#2E2E2E]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 sm:space-x-6 lg:space-x-8">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent">
                atsn ai
              </div>
              <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
                <button 
                  onClick={() => scrollToSection('features')}
                  className={`text-sm sm:text-base transition-colors ${activeSection === 'features' ? 'text-[#9E005C]' : 'text-[#2E2E2E]/70 hover:text-[#2E2E2E]'}`}
                >
                  Features
                </button>
                <button 
                  onClick={() => scrollToSection('agents')}
                  className={`text-sm sm:text-base transition-colors ${activeSection === 'agents' ? 'text-[#9E005C]' : 'text-[#2E2E2E]/70 hover:text-[#2E2E2E]'}`}
                >
                  Agents
                </button>
                <button 
                  onClick={() => scrollToSection('pricing')}
                  className={`text-sm sm:text-base transition-colors ${activeSection === 'pricing' ? 'text-[#9E005C]' : 'text-[#2E2E2E]/70 hover:text-[#2E2E2E]'}`}
                >
                  Pricing
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <a
                href="/login"
                className="hidden md:block text-sm sm:text-base text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors"
              >
                Sign In
              </a>
              <a
                href="/signup"
                className="bg-[#9E005C] text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm md:text-base font-medium hover:bg-[#FF4D94] transition-all duration-300 transform hover:scale-105"
              >
                Get Started
              </a>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden text-[#2E2E2E]"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-white/95 backdrop-blur-xl">
          <div className="flex flex-col items-center justify-center h-full space-y-6 sm:space-y-8">
            <button 
              onClick={() => scrollToSection('features')}
              className="text-lg sm:text-xl text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors"
            >
              Features
            </button>
            <button 
              onClick={() => scrollToSection('agents')}
              className="text-lg sm:text-xl text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors"
            >
              Agents
            </button>
            <button 
              onClick={() => scrollToSection('pricing')}
              className="text-lg sm:text-xl text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors"
            >
              Pricing
            </button>
            <a
              href="/login"
              className="text-lg sm:text-xl text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors"
            >
              Sign In
            </a>
            <a
              href="/signup"
              className="bg-[#9E005C] text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-base sm:text-lg font-medium hover:bg-[#FF4D94] transition-all duration-300"
            >
              Get Started
            </a>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section id="hero" className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#9E005C]/10 via-[#FF4D94]/10 to-[#3F2B96]/10"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(158,0,92,0.1),transparent_50%)]"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6 md:mb-8 leading-tight px-2">
            <div className="block">
              <span className="bg-gradient-to-r from-[#3F2B96] to-[#9E005C] bg-clip-text text-transparent whitespace-nowrap">
                Autonomous AI Agents
              </span>
            </div>
            <div className="block">
              <span className="bg-gradient-to-r from-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent whitespace-nowrap">
                Empowering Your Business
              </span>
            </div>
          </h1>
        
          <p className="text-sm xs:text-base sm:text-lg md:text-xl lg:text-2xl text-[#2E2E2E]/70 mb-6 sm:mb-8 md:mb-10 lg:mb-12 max-w-3xl mx-auto leading-relaxed px-4">
            Meet your AI teammates that work autonomously to automate tasks, 
            boost productivity, and transform how you work.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 px-4">
            <a
              href="/signup"
              className="group bg-[#9E005C] text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-medium hover:bg-[#FF4D94] transition-all duration-300 transform hover:scale-105 flex items-center space-x-2"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <button className="flex items-center space-x-2 text-sm sm:text-base text-[#2E2E2E]/70 hover:text-[#2E2E2E] transition-colors">
              <Play className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Watch Demo</span>
            </button>
          </div>
        </div>
        
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <button 
            onClick={() => scrollToSection('features')}
            className="text-[#2E2E2E]/50 hover:text-[#2E2E2E] transition-colors animate-bounce"
          >
            <ChevronDown size={24} />
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-16 lg:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 md:mb-6">
              <span className="bg-gradient-to-r from-[#2E2E2E] via-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent">
                Why Choose atsn ai Agents?
              </span>
            </h2>
            <p className="text-sm xs:text-base sm:text-lg md:text-xl text-[#2E2E2E]/70 max-w-2xl mx-auto px-4">
              Our AI agents are designed to work independently, learn from your preferences, 
              and continuously improve their performance.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-gradient-to-br from-white to-[#F6F6F6] rounded-2xl p-6 sm:p-8 border border-[#2E2E2E]/10 hover:border-[#9E005C]/20 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="w-12 h-12 bg-gradient-to-r from-[#9E005C] to-[#FF4D94] rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto sm:mx-0">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-2 sm:mb-3 md:mb-4 text-[#2E2E2E] text-center sm:text-left">Fully Autonomous</h3>
              <p className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/70 leading-relaxed text-center sm:text-left">
                Our agents work independently, making decisions and taking actions 
                without constant supervision.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-white to-[#F6F6F6] rounded-2xl p-6 sm:p-8 border border-[#2E2E2E]/10 hover:border-[#FF4D94]/20 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="w-12 h-12 bg-gradient-to-r from-[#FF4D94] to-[#3F2B96] rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto sm:mx-0">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-2 sm:mb-3 md:mb-4 text-[#2E2E2E] text-center sm:text-left">Lightning Fast</h3>
              <p className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/70 leading-relaxed text-center sm:text-left">
                Execute complex tasks in seconds, not hours. 
                Our agents are optimized for speed and efficiency.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-white to-[#F6F6F6] rounded-2xl p-6 sm:p-8 border border-[#2E2E2E]/10 hover:border-[#3F2B96]/20 transition-all duration-300 shadow-lg hover:shadow-xl sm:col-span-2 lg:col-span-1">
              <div className="w-12 h-12 bg-gradient-to-r from-[#3F2B96] to-[#9E005C] rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto sm:mx-0">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-2 sm:mb-3 md:mb-4 text-[#2E2E2E] text-center sm:text-left">Always Learning</h3>
              <p className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/70 leading-relaxed text-center sm:text-left">
                Continuously improve and adapt to your workflow, 
                becoming more effective over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Agents Section */}
      <section id="agents" className="py-12 sm:py-16 lg:py-20 bg-[#F6F6F6]">
        <div className="w-full mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 md:mb-6">
              <span className="bg-gradient-to-r from-[#2E2E2E] via-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent">
                Meet Your AI Agents
              </span>
            </h2>
            <p className="text-sm xs:text-base sm:text-lg md:text-xl text-[#2E2E2E]/70 max-w-2xl mx-auto px-4">
              Specialized AI agents designed to handle specific domains with expertise 
              and precision.
            </p>
          </div>
          
          {/* 90% width for mobile, 80% for larger screens */}
          <div className="w-[90%] md:w-4/5 mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 auto-rows-fr">
            {/* Emily - Digital Marketing Agent */}
            <div className="relative group flex">
              <div className="absolute inset-0 bg-[#9E005C]/10 rounded-2xl sm:rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative w-full bg-gradient-to-br from-white to-[#F6F6F6] rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-[#2E2E2E]/10 hover:border-[#9E005C]/20 transition-all duration-300 shadow-lg hover:shadow-xl flex flex-col">
                <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 sm:gap-4">
                  <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 flex-shrink-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-gradient-to-r from-[#9E005C] to-[#FF4D94] rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                      <span className="text-lg sm:text-xl md:text-2xl font-bold text-white">E</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-[#2E2E2E] truncate">Emily</h3>
                      <p className="text-xs sm:text-sm md:text-base bg-gradient-to-r from-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent hidden sm:block">Digital Marketing Agent</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="inline-flex items-center space-x-1 bg-green-500/20 text-green-600 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span>Now Live</span>
                    </div>
                    <p className="text-[#2E2E2E]/50 text-xs sm:text-sm mt-1 hidden sm:block">Available Now</p>
                  </div>
                </div>
                
                <p className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/70 mb-3 sm:mb-4 md:mb-6 leading-relaxed">
                  Emily is your dedicated digital marketing specialist. She handles content creation, 
                  social media management, campaign optimization, and analytics - all autonomously.
                </p>
                
                <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4 md:mb-6 flex-grow">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#9E005C] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Content Creation & Curation</span>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#9E005C] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Social Media Management</span>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#9E005C] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Campaign Optimization</span>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#9E005C] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Analytics & Reporting</span>
                  </div>
                </div>
                
                <a
                  href="/login"
                  className="w-full mt-auto bg-gradient-to-r from-[#9E005C] to-[#FF4D94] text-white py-2 sm:py-2.5 md:py-3 rounded-xl text-xs sm:text-sm md:text-base font-medium hover:from-[#FF4D94] hover:to-[#9E005C] transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                >
                  Login to Emily
                </a>
              </div>
            </div>
            
            {/* Miles - Personal Assistant */}
            <div className="relative group flex">
              <div className="absolute inset-0 bg-[#3F2B96]/10 rounded-2xl sm:rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative w-full bg-gradient-to-br from-white to-[#F6F6F6] rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-[#2E2E2E]/10 hover:border-[#3F2B96]/20 transition-all duration-300 shadow-lg hover:shadow-xl flex flex-col">
                <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 sm:gap-4">
                  <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 flex-shrink-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-gradient-to-r from-[#3F2B96] to-[#9E005C] rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                      <span className="text-lg sm:text-xl md:text-2xl font-bold text-white">M</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-[#2E2E2E] truncate">Miles</h3>
                      <p className="text-xs sm:text-sm md:text-base bg-gradient-to-r from-[#3F2B96] to-[#9E005C] bg-clip-text text-transparent hidden sm:block">Personal Assistant</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="inline-flex items-center space-x-1 bg-[#FF4D94]/20 text-[#FF4D94] px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm">
                      <div className="w-2 h-2 bg-[#FF4D94] rounded-full animate-pulse"></div>
                      <span>Coming Soon</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/70 mb-3 sm:mb-4 md:mb-6 leading-relaxed">
                  Miles is your intelligent personal assistant. He manages your schedule, 
                  handles communications, organizes tasks, and keeps you productive.
                </p>
                
                <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4 md:mb-6 flex-grow">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#3F2B96] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Schedule Management</span>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#3F2B96] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Email & Communication</span>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#3F2B96] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Task Organization</span>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#3F2B96] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Smart Reminders</span>
                  </div>
                </div>
                
                <button className="w-full mt-auto bg-gradient-to-r from-[#3F2B96] to-[#9E005C] text-white py-2 sm:py-2.5 md:py-3 rounded-xl text-xs sm:text-sm md:text-base font-medium hover:from-[#9E005C] hover:to-[#3F2B96] transition-all duration-300 transform hover:scale-105">
                  Join Waitlist
                </button>
              </div>
            </div>
            
            {/* Aayushi - Dietitian Agent */}
            <div className="relative group flex">
              <div className="absolute inset-0 bg-[#10B981]/10 rounded-2xl sm:rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative w-full bg-gradient-to-br from-white to-[#F6F6F6] rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-[#2E2E2E]/10 hover:border-[#10B981]/20 transition-all duration-300 shadow-lg hover:shadow-xl flex flex-col">
                <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 sm:gap-4">
                  <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 flex-shrink-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-gradient-to-r from-[#10B981] to-[#059669] rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                      <span className="text-lg sm:text-xl md:text-2xl font-bold text-white">A</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-[#2E2E2E] truncate">Aayushi</h3>
                      <p className="text-xs sm:text-sm md:text-base bg-gradient-to-r from-[#10B981] to-[#059669] bg-clip-text text-transparent hidden sm:block">Dietitian Agent</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="inline-flex items-center space-x-1 bg-[#FF4D94]/20 text-[#FF4D94] px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm">
                      <div className="w-2 h-2 bg-[#FF4D94] rounded-full animate-pulse"></div>
                      <span>Coming Soon</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/70 mb-3 sm:mb-4 md:mb-6 leading-relaxed">
                  Aayushi is your dedicated dietitian and fitness specialist. She creates personalized diet plans, 
                  exercise routines, and helps you achieve your health and fitness goals.
                </p>
                
                <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4 md:mb-6 flex-grow">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#10B981] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Personalized Diet Plans</span>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#10B981] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Custom Exercise Routines</span>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#10B981] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Health & Fitness Tracking</span>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#10B981] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Nutritional Guidance</span>
                  </div>
                </div>
                
                <button className="w-full mt-auto bg-gradient-to-r from-[#10B981] to-[#059669] text-white py-2 sm:py-2.5 md:py-3 rounded-xl text-xs sm:text-sm md:text-base font-medium hover:from-[#059669] hover:to-[#10B981] transition-all duration-300 transform hover:scale-105">
                  Join Waitlist
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-12 sm:py-16 lg:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 md:mb-6">
              <span className="bg-gradient-to-r from-[#2E2E2E] via-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent">
                Simple Pricing
              </span>
            </h2>
            <p className="text-sm xs:text-base sm:text-lg md:text-xl text-[#2E2E2E]/70 max-w-2xl mx-auto px-4">
              Choose the plan that fits your needs. All plans include access to our AI agents.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Starter Plan */}
            <div className="bg-gradient-to-br from-white to-[#F6F6F6] rounded-2xl p-6 sm:p-8 border border-[#2E2E2E]/10 hover:border-[#9E005C]/20 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 text-[#2E2E2E]">Starter</h3>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                  <span className="bg-gradient-to-r from-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent">₹4999</span>
                  <span className="text-[#2E2E2E]/50 text-sm sm:text-base md:text-lg">/month</span>
                </div>
                <p className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/70">Perfect for individuals and small teams</p>
              </div>
              
              <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#9E005C] flex-shrink-0" />
                  <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Access to 1 AI Agent</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#9E005C] flex-shrink-0" />
                  <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Basic Analytics</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#9E005C] flex-shrink-0" />
                  <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Email Support</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#9E005C] flex-shrink-0" />
                  <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Standard Features</span>
                </div>
              </div>
              
              <a
                href="/signup"
                className="w-full bg-gradient-to-r from-[#9E005C] to-[#FF4D94] text-white py-2 sm:py-2.5 md:py-3 rounded-xl text-xs sm:text-sm md:text-base font-medium hover:from-[#FF4D94] hover:to-[#9E005C] transition-all duration-300 flex items-center justify-center"
              >
                Get Started
              </a>
            </div>
            
            {/* Pro Plan */}
            <div className="relative">
              <div className="absolute inset-0 bg-[#FF4D94]/10 rounded-2xl blur-xl"></div>
              <div className="relative bg-gradient-to-br from-white to-[#F6F6F6] rounded-2xl p-6 sm:p-8 border border-[#FF4D94]/30 shadow-lg hover:shadow-xl">
                <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-[#FF4D94] to-[#9E005C] text-white px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-medium">
                    Most Popular
                  </div>
                </div>
                
                <div className="text-center mb-6 sm:mb-8">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 text-[#2E2E2E]">Pro</h3>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                    <span className="bg-gradient-to-r from-[#FF4D94] to-[#3F2B96] bg-clip-text text-transparent">₹9999</span>
                    <span className="text-[#2E2E2E]/50 text-sm sm:text-base md:text-lg">/month</span>
                  </div>
                  <p className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/70">For growing businesses and teams</p>
                </div>
                
                <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF4D94] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Access to All AI Agents</span>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF4D94] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Advanced Analytics</span>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF4D94] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Priority Support</span>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF4D94] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Custom Integrations</span>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF4D94] flex-shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Team Collaboration</span>
                  </div>
                </div>
                
                <a
                  href="/signup"
                  className="w-full bg-gradient-to-r from-[#FF4D94] to-[#3F2B96] text-white py-2 sm:py-2.5 md:py-3 rounded-xl text-xs sm:text-sm md:text-base font-medium hover:from-[#3F2B96] hover:to-[#FF4D94] transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                >
                  Get Started
                </a>
              </div>
            </div>
            
            {/* Enterprise Plan */}
            <div className="bg-gradient-to-br from-white to-[#F6F6F6] rounded-2xl p-6 sm:p-8 border border-[#2E2E2E]/10 hover:border-[#3F2B96]/20 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 text-[#2E2E2E]">Enterprise</h3>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                  <span className="bg-gradient-to-r from-[#3F2B96] to-[#9E005C] bg-clip-text text-transparent">Custom</span>
                </div>
                <p className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/70">For large organizations</p>
              </div>
              
              <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#3F2B96] flex-shrink-0" />
                  <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Unlimited AI Agents</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#3F2B96] flex-shrink-0" />
                  <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Custom AI Training</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#3F2B96] flex-shrink-0" />
                  <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">Dedicated Support</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#3F2B96] flex-shrink-0" />
                  <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">SLA Guarantee</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#3F2B96] flex-shrink-0" />
                  <span className="text-xs sm:text-sm md:text-base text-[#2E2E2E]/80">On-Premise Option</span>
                </div>
              </div>
              
              <button className="w-full bg-gradient-to-r from-[#3F2B96] to-[#9E005C] text-white py-2 sm:py-2.5 md:py-3 rounded-xl text-xs sm:text-sm md:text-base font-medium hover:from-[#9E005C] hover:to-[#3F2B96] transition-all duration-300">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#2E2E2E] border-t border-[#2E2E2E]/10 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="text-2xl font-bold text-white mb-4">
                atsn ai
              </div>
              <p className="text-white/70 mb-4">
                The future of autonomous AI agents that work for you.
              </p>
              <div className="flex space-x-4">
                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-[#FF4D94] transition-colors">
                  <span className="text-white text-sm">T</span>
                </div>
                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-[#FF4D94] transition-colors">
                  <span className="text-white text-sm">L</span>
                </div>
                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-[#FF4D94] transition-colors">
                  <span className="text-white text-sm">G</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-white/70 hover:text-[#FF4D94] transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-white/70 hover:text-[#FF4D94] transition-colors">Pricing</a></li>
                <li><a href="/login" className="text-white/70 hover:text-[#FF4D94] transition-colors">Emily App</a></li>
                <li><a href="#" className="text-white/70 hover:text-[#FF4D94] transition-colors">Documentation</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-white/70 hover:text-[#FF4D94] transition-colors">About</a></li>
                <li><a href="#" className="text-white/70 hover:text-[#FF4D94] transition-colors">Blog</a></li>
                <li><a href="#" className="text-white/70 hover:text-[#FF4D94] transition-colors">Careers</a></li>
                <li><Link to="/contact" className="text-white/70 hover:text-[#FF4D94] transition-colors">Contact</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-white/70 hover:text-[#FF4D94] transition-colors">Help Center</a></li>
                <li><a href="#" className="text-white/70 hover:text-[#FF4D94] transition-colors">Community</a></li>
                <li><a href="#" className="text-white/70 hover:text-[#FF4D94] transition-colors">Status</a></li>
                <li><a href="#" className="text-white/70 hover:text-[#FF4D94] transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-white/50 text-sm">
              © 2025 atsn ai. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link to="/privacy" className="text-white/50 hover:text-[#FF4D94] text-sm transition-colors">Privacy</Link>
              <Link to="/terms" className="text-white/50 hover:text-[#FF4D94] text-sm transition-colors">Terms</Link>
              <Link to="/cancellation-refunds" className="text-white/50 hover:text-[#FF4D94] text-sm transition-colors">Cancellation & Refunds</Link>
              <Link to="/shipping" className="text-white/50 hover:text-[#FF4D94] text-sm transition-colors">Shipping</Link>
              <a href="#" className="text-white/50 hover:text-[#FF4D94] text-sm transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
};

export default Page;
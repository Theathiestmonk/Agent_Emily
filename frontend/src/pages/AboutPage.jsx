import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, Target, Brain, ArrowLeft, Facebook, Youtube, Linkedin, Menu, X } from 'lucide-react';
import SEO from '../components/SEO';

const AboutPage = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const scrollToSection = (sectionId) => {
        if (location.pathname !== '/') {
            navigate('/', { state: { targetId: sectionId } });
        } else {
            const element = document.getElementById(sectionId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }
        setIsMenuOpen(false);
    };
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen text-white overflow-x-hidden relative font-sans selection:bg-pink-500/30">
            <SEO title="About Us | atsn ai" description="Learn about atsn ai's vision and mission to create intelligent machines." />

            {/* Global Glass Background Layers */}
            <div className="fixed inset-0 bg-gray-950 z-[-2]"></div>
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(236,72,153,0.08),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(59,130,246,0.08),transparent_50%),radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.08),transparent_50%)] z-[-1]"></div>
            <div className="fixed inset-0 backdrop-blur-[100px] z-[-1]"></div>

            {/* Navigation Header */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-800/90 backdrop-blur-xl border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 sm:space-x-6 lg:space-x-8">
                            <Link to="/" className="text-[26px] font-normal bg-gradient-to-r from-pink-500 via-white to-pink-500 bg-clip-text text-transparent animate-shiny">
                                atsn ai
                            </Link>
                            <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
                                <button
                                    onClick={() => scrollToSection('argo')}
                                    className="text-[16px] transition-colors font-normal text-gray-300 hover:text-white"
                                >
                                    Argo
                                </button>
                                <button
                                    onClick={() => scrollToSection('features')}
                                    className="text-[16px] transition-colors font-normal text-gray-300 hover:text-white"
                                >
                                    Features
                                </button>
                                <Link
                                    to="/about"
                                    className="text-[16px] transition-colors font-normal text-pink-400"
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
                            className="text-[26px] text-pink-400 transition-colors font-normal"
                            onClick={() => setIsMenuOpen(false)}
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
            <section className="relative min-h-screen flex items-center justify-center pt-24 pb-16 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-900/40 via-purple-900/40 to-blue-900/40 pointer-events-none"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(236,72,153,0.15),transparent_60%)] pointer-events-none"></div>
                <div className="relative z-10 w-full flex justify-center px-4 sm:px-6 text-center">
                    <h1 className="max-w-5xl text-[42px] md:text-[68px] lg:text-[110px] font-bold leading-tight tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent pb-2">
                        Building True <br className="hidden md:block" /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">Intelligence</span>
                    </h1>
                </div>
            </section>

            {/* Main Content with Hero Gradient */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-900/40 via-purple-900/40 to-blue-900/40 pointer-events-none"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(236,72,153,0.15),transparent_60%)] pointer-events-none"></div>
                <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-20 pb-32">

                    {/* Section 1: Company Vision (Text Left, Image Right) */}
                    <section className="mb-32">
                        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                            <div className="lg:w-1/2 flex flex-col justify-center">
                                <h2 className="text-[42px] md:text-[68px] font-bold text-white mb-8 leading-tight">Company <span className="text-pink-500">Vision</span></h2>
                                <h3 className="text-[26px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-200 mb-6">To make machines move intelligently.</h3>
                                <p className="text-[16px] md:text-[26px] text-gray-300 font-medium leading-relaxed">
                                    Machines should not just function, they should understand, adapt, and move with purpose. Our vision is to create intelligence that brings natural, safe, and efficient motion to machines across industries.
                                </p>
                            </div>
                            <div className="lg:w-1/2 w-full flex items-center justify-end relative group">
                                <img
                                    src="/argo.png"
                                    alt="Argo representation"
                                    className="w-full h-auto max-h-[500px] object-contain transform group-hover:scale-105 transition-transform duration-700 drop-shadow-2xl"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Our Mission (Custom AI Image Left, Text Right) */}
                    <section className="mb-32">
                        <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
                            <div className="lg:w-1/2 flex flex-col justify-center">
                                <h2 className="text-[42px] md:text-[68px] font-bold text-white mb-8 leading-tight">Our <span className="text-purple-400">Mission</span></h2>
                                <p className="text-[16px] md:text-[26px] text-gray-300 font-medium leading-relaxed mb-6">
                                    We build intelligent systems that help machines move safely, adapt quickly, and work naturally alongside people.
                                </p>
                                <p className="text-[16px] md:text-[26px] text-gray-400 font-medium leading-relaxed">
                                    We focus on developing core intelligence that enables machines to perceive, decide, and act reliably in real-world environments.
                                </p>
                            </div>
                            <div className="lg:w-1/2 w-full aspect-square md:aspect-video lg:aspect-square relative rounded-[2rem] overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm group flex items-center justify-center">
                                <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/20 to-purple-500/20 group-hover:opacity-75 transition-opacity duration-500 z-10 mix-blend-overlay"></div>
                                <img
                                    src="/mission-atsn-ai.png"
                                    alt="ATSN AI mission — intelligent machines in real-world environments"
                                    className="max-w-full max-h-full object-contain transform group-hover:scale-105 transition-transform duration-700"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 3: Why ATSN AI (Text Left, Image Right) */}
                    <section>
                        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                            <div className="lg:w-1/2 flex flex-col justify-center">
                                <h2 className="text-[42px] md:text-[68px] font-bold text-white mb-8 leading-tight">
                                    Why <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-pink-400">atsn ai</span>
                                </h2>

                                <div className="space-y-6 mb-10">
                                    <p className="text-[16px] md:text-[26px] text-gray-300 font-bold leading-relaxed">
                                        We exist to solve the hardest problem in robotics: <span className="text-pink-400">intelligence.</span>
                                    </p>
                                    <p className="text-[16px] text-gray-400 font-medium leading-relaxed">
                                        Most machines can move. Very few can move intelligently. ATSN AI builds the intelligence layer that enables machines to:
                                    </p>
                                </div>

                                {/* Four Value Pillars Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                                    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors">
                                        <span className="text-[16px] text-gray-200 font-medium flex items-center gap-3">
                                            <span className="w-2 h-2 rounded-full bg-pink-500 block"></span> Understand their environment
                                        </span>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors">
                                        <span className="text-[16px] text-gray-200 font-medium flex items-center gap-3">
                                            <span className="w-2 h-2 rounded-full bg-purple-500 block"></span> Make real-time decisions
                                        </span>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors">
                                        <span className="text-[16px] text-gray-200 font-medium flex items-center gap-3">
                                            <span className="w-2 h-2 rounded-full bg-blue-500 block"></span> Adapt to dynamic situations
                                        </span>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors">
                                        <span className="text-[16px] text-gray-200 font-medium flex items-center gap-3">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 block"></span> Work safely with humans
                                        </span>
                                    </div>
                                </div>

                                <div className="inline-block p-1 rounded-full bg-gradient-to-r from-pink-500/50 to-purple-500/50">
                                    <div className="px-6 py-4 rounded-full backdrop-blur-sm">
                                        <p className="text-[16px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-200">
                                            We are building the foundation for the next generation of intelligent machines.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:w-1/2 w-full aspect-square md:aspect-video lg:aspect-square relative rounded-[2rem] overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm group">
                                <div className="absolute inset-0 bg-gradient-to-tr from-pink-600/20 to-blue-600/20 group-hover:opacity-75 transition-opacity duration-500 z-10 mix-blend-overlay"></div>
                                <img
                                    src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1200"
                                    alt="AI motherboard processing"
                                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                                />
                            </div>
                        </div>
                    </section>

                </main>
            </div>

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
                                <li><a href="/#features" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">Features</a></li>
                                <li><a href="/login" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">Emily App</a></li>
                                <li><a href="#" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">Documentation</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-[26px] text-white font-normal mb-4 leading-tight">Company</h4>
                            <ul className="space-y-2">
                                <li><a href="/about" className="text-[16px] text-gray-300 hover:text-pink-400 transition-colors font-normal">About</a></li>
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
            </footer>
        </div>
    );
};

export default AboutPage;

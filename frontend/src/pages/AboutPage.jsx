import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Target, Brain, ArrowLeft } from 'lucide-react';
import SEO from '../components/SEO';

const AboutPage = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-[#0A0A14] text-gray-100 font-sans selection:bg-pink-500/30 overflow-x-hidden pt-20">
            <SEO title="About Us | atsn ai" description="Learn about atsn ai's vision and mission to create intelligent machines." />

            {/* Global Background (Matching Landing Page) */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse-slow"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
                <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-blue-600/10 rounded-full mix-blend-screen filter blur-[100px] animate-pulse-slow" style={{ animationDelay: '4s' }}></div>
                <div className="absolute inset-0 bg-[#0A0A14]/80 backdrop-blur-[100px]"></div>
            </div>

            {/* Navigation Header */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-800/90 backdrop-blur-xl border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors">
                            <ArrowLeft size={20} />
                            <span className="text-[16px] font-medium">Back to Home</span>
                        </Link>
                        <div className="text-[26px] font-normal bg-gradient-to-r from-pink-500 via-white to-pink-500 bg-clip-text text-transparent animate-shiny">
                            atsn ai
                        </div>
                        <div className="w-24"></div> {/* Spacer for centering */}
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-24 pb-32">

                {/* Page Header */}
                <div className="text-center mb-24 relative">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 sm:px-6 sm:py-2 mb-8 rounded-full bg-white/5 border border-white/10 text-gray-300 font-medium text-[14px] md:text-[16px] backdrop-blur-xl">
                        <Brain className="w-4 h-4 md:w-5 md:h-5 text-pink-400" />
                        <span>The story of atsn ai</span>
                    </div>
                    <h1 className="text-[42px] md:text-[68px] lg:text-[110px] font-bold leading-tight tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent pb-2">
                        Building True <br className="hidden md:block" /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">Intelligence</span>
                    </h1>
                </div>

                {/* Section 1: Company Vision (Text Left, Image Right) */}
                <section className="mb-32">
                    <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                        <div className="lg:w-1/2 flex flex-col justify-center">
                            <div className="w-16 h-16 bg-pink-500/20 text-pink-400 rounded-2xl flex items-center justify-center mb-8">
                                <Target size={32} />
                            </div>
                            <h2 className="text-[42px] md:text-[68px] font-bold text-white mb-8 leading-tight">Company <span className="text-pink-500">Vision</span></h2>
                            <h3 className="text-[26px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-200 mb-6">To make machines move intelligently.</h3>
                            <p className="text-[16px] md:text-[26px] text-gray-300 font-medium leading-relaxed">
                                Machines should not just function, they should understand, adapt, and move with purpose. Our vision is to create intelligence that brings natural, safe, and efficient motion to machines across industries.
                            </p>
                        </div>
                        <div className="lg:w-1/2 w-full aspect-square md:aspect-video lg:aspect-square relative rounded-[2rem] overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm group">
                            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-purple-500/20 group-hover:opacity-75 transition-opacity duration-500 z-10 mix-blend-overlay"></div>
                            <img
                                src="https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=1200"
                                alt="Cybernetic vision representation"
                                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                            />
                        </div>
                    </div>
                </section>

                {/* Section 2: Our Mission (Image Left, Text Right) */}
                <section className="mb-32">
                    <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
                        <div className="lg:w-1/2 flex flex-col justify-center">
                            <div className="w-16 h-16 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-8">
                                <Zap size={32} />
                            </div>
                            <h2 className="text-[42px] md:text-[68px] font-bold text-white mb-8 leading-tight">Our <span className="text-purple-400">Mission</span></h2>
                            <p className="text-[16px] md:text-[26px] text-gray-300 font-medium leading-relaxed mb-6">
                                We build intelligent systems that help machines move safely, adapt quickly, and work naturally alongside people.
                            </p>
                            <p className="text-[16px] md:text-[26px] text-gray-400 font-medium leading-relaxed">
                                We focus on developing core intelligence that enables machines to perceive, decide, and act reliably in real-world environments.
                            </p>
                        </div>
                        <div className="lg:w-1/2 w-full aspect-square md:aspect-video lg:aspect-square relative rounded-[2rem] overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm group">
                            <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/20 to-purple-500/20 group-hover:opacity-75 transition-opacity duration-500 z-10 mix-blend-overlay"></div>
                            <img
                                src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1200"
                                alt="Robotics and human interaction"
                                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                            />
                        </div>
                    </div>
                </section>

                {/* Section 3: Why ATSN AI (Text Left, Image Right) */}
                <section>
                    <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                        <div className="lg:w-1/2 flex flex-col justify-center">
                            <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-8">
                                <Brain size={32} />
                            </div>
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
                                <div className="bg-[#0A0A14] px-6 py-4 rounded-full">
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

            {/* Footer */}
            <footer className="bg-white/5 backdrop-blur-3xl border-t border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] py-12 relative z-20">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8">
                        {/* Brand */}
                        <div className="text-center md:text-left mb-8 md:mb-0">
                            <div className="text-[26px] font-normal bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent mb-4">atsn ai</div>
                        </div>
                    </div>
                    <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-[16px] text-gray-500">
                        <p>&copy; 2024 atsn ai. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default AboutPage;

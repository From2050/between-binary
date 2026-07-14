import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

type Star = {
    id: string;
    name: string;
    role: string;
    desc: string;
    year: string;
    angle: number;
    radius: number;
    eccentricity: number; // 0 = circle, 0.5 = elongated ellipse
    speed: number;
    inclination: number;
    nodeAngle: number;
    size: number;
    color: string;
    imageUrl?: string;
};

// ─── 45 Civilization Nodes ───
const fixedStarsData = [
    // ━━━ ERA I: Foundations (1800s) ━━━
    { id: 'babbage', name: 'Charles Babbage', role: 'Analytical Engine', desc: 'Designed the first general-purpose mechanical computer, a century ahead of its time.', year: '1837', color: '#94A3B8', imageUrl: '' },
    { id: 'lovelace', name: 'Ada Lovelace', role: 'The First Programmer', desc: 'Visionary who recognized that computers could do more than just calculate numbers.', year: '1843', color: '#F472B6', imageUrl: '' },
    { id: 'bell', name: 'Alexander G. Bell', role: 'Telephone', desc: 'Bridged the gap between voice and wire, birthing the age of telecommunication.', year: '1876', color: '#FCA5A5', imageUrl: '' },
    { id: 'tesla', name: 'Nikola Tesla', role: 'AC Power & Radio', desc: 'Electrified the world with alternating current and laid groundwork for wireless communication.', year: '1891', color: '#67E8F9', imageUrl: '' },
    { id: 'marconi', name: 'Guglielmo Marconi', role: 'Wireless Telegraphy', desc: 'Proved electromagnetic waves could carry messages across the Atlantic Ocean.', year: '1901', color: '#A5B4FC', imageUrl: '' },

    // ━━━ ERA II: Theory & Warfare Computing (1930s–1940s) ━━━
    { id: 'turing', name: 'Alan Turing', role: 'Father of Comp. Sci.', desc: 'Formalized concepts of algorithm and computation with the Turing Machine.', year: '1936', color: '#60A5FA', imageUrl: '' },
    { id: 'shannon', name: 'Claude Shannon', role: 'Information Theory', desc: 'Defined the mathematical foundations of digital communication and data encoding.', year: '1948', color: '#38BDF8', imageUrl: '' },
    { id: 'zuse', name: 'Konrad Zuse', role: 'Z3 Computer', desc: 'Built the world\'s first programmable, fully automatic digital computer.', year: '1941', color: '#D4D4D8', imageUrl: '' },
    { id: 'lamarr', name: 'Hedy Lamarr', role: 'Frequency Hopping', desc: 'Co-invented spread-spectrum technology that underpins modern Wi-Fi and Bluetooth.', year: '1942', color: '#F9A8D4', imageUrl: '' },
    { id: 'vonneumann', name: 'John von Neumann', role: 'Computer Architecture', desc: 'Defined the stored-program architecture that nearly every modern computer follows.', year: '1945', color: '#818CF8', imageUrl: '' },
    { id: 'bush', name: 'Vannevar Bush', role: 'As We May Think', desc: 'Envisioned the Memex — a hyperlinked knowledge machine that inspired the web.', year: '1945', color: '#FDE68A', imageUrl: '' },

    // ━━━ ERA III: Languages & Operating Systems (1950s–1970s) ━━━
    { id: 'hopper', name: 'Grace Hopper', role: 'Compiler Pioneer', desc: 'Created the first compiler and championed machine-independent programming languages.', year: '1952', color: '#34D399', imageUrl: '' },
    { id: 'backus', name: 'John Backus', role: 'FORTRAN', desc: 'Led the design of FORTRAN, the first widely used high-level programming language.', year: '1957', color: '#6EE7B7', imageUrl: '' },
    { id: 'mccarthy', name: 'John McCarthy', role: 'AI & Lisp', desc: 'Coined "Artificial Intelligence" and created Lisp, the language of symbolic reasoning.', year: '1958', color: '#A78BFA', imageUrl: '' },
    { id: 'sutherland', name: 'Ivan Sutherland', role: 'Father of Graphics', desc: 'Created Sketchpad, the forerunner of modern CAD and GUI.', year: '1963', color: '#C4B5FD', imageUrl: '' },
    { id: 'engelbart', name: 'Douglas Engelbart', role: 'The Mother of All Demos', desc: 'Pioneered the mouse, GUI, and collaborative computing in a legendary 1968 demo.', year: '1968', color: '#86EFAC', imageUrl: '' },
    { id: 'dijkstra', name: 'Edsger Dijkstra', role: 'Structured Programming', desc: 'Championed formal methods and shortest-path algorithms that power every GPS.', year: '1968', color: '#93C5FD', imageUrl: '' },
    { id: 'knuth', name: 'Donald Knuth', role: 'Art of Programming', desc: 'Authored the definitive reference on algorithms and invented TeX typesetting.', year: '1968', color: '#FCA5A5', imageUrl: '' },
    { id: 'thompson', name: 'Ken Thompson', role: 'Unix', desc: 'Co-created Unix and the B language — the bedrock of modern operating systems.', year: '1969', color: '#D1D5DB', imageUrl: '' },
    { id: 'hamilton', name: 'Margaret Hamilton', role: 'Apollo Software', desc: 'Led the software engineering for Apollo 11 — coined the term "software engineering".', year: '1969', color: '#FDE68A', imageUrl: '' },
    { id: 'kay', name: 'Alan Kay', role: 'OOP & Dynabook', desc: 'Pioneered object-oriented programming and envisioned the personal computer as a medium.', year: '1972', color: '#FBBF24', imageUrl: '' },
    { id: 'ritchie', name: 'Dennis Ritchie', role: 'C Language', desc: 'Created the C programming language and co-developed Unix — foundations of modern software.', year: '1972', color: '#E5E7EB', imageUrl: '' },

    // ━━━ ERA IV: Networks & Personal Computing (1970s–1990s) ━━━
    { id: 'cerf', name: 'Vint Cerf', role: 'TCP/IP', desc: 'Co-designed TCP/IP, the protocol suite that makes the internet possible.', year: '1974', color: '#38BDF8', imageUrl: '' },
    { id: 'wozniak', name: 'Steve Wozniak', role: 'Apple I', desc: 'Single-handedly designed the Apple I & II, sparking the personal computer revolution.', year: '1976', color: '#4ADE80', imageUrl: '' },
    { id: 'stallman', name: 'Richard Stallman', role: 'Free Software', desc: 'Founded the GNU project and the FSF, championing software freedom for all.', year: '1983', color: '#F87171', imageUrl: '' },
    { id: 'stroustrup', name: 'Bjarne Stroustrup', role: 'C++', desc: 'Extended C with object-oriented features, creating the language that powers games and systems.', year: '1985', color: '#7DD3FC', imageUrl: '' },
    { id: 'berners-lee', name: 'Tim Berners-Lee', role: 'Inventor of WWW', desc: 'Created the World Wide Web, giving humanity a shared knowledge space.', year: '1989', color: '#FBBF24', imageUrl: '' },
    { id: 'lecun', name: 'Yann LeCun', role: 'Convolutional Nets', desc: 'Pioneered convolutional neural networks that now power image recognition worldwide.', year: '1989', color: '#A78BFA', imageUrl: '' },

    // ━━━ ERA V: The Web & Open Source (1990s–2000s) ━━━
    { id: 'torvalds', name: 'Linus Torvalds', role: 'Linux & Git', desc: 'Created Linux and Git — the operating system and version control behind modern dev.', year: '1991', color: '#FACC15', imageUrl: '' },
    { id: 'vanrossum', name: 'Guido van Rossum', role: 'Python', desc: 'Designed Python for readability and simplicity, now the world\'s most popular language.', year: '1991', color: '#34D399', imageUrl: '' },
    { id: 'andreessen', name: 'Marc Andreessen', role: 'Mosaic Browser', desc: 'Built Mosaic, the first graphical web browser that brought the internet to the masses.', year: '1993', color: '#60A5FA', imageUrl: '' },
    { id: 'huang', name: 'Jensen Huang', role: 'GPU Computing', desc: 'Founded NVIDIA and transformed graphics processors into the engines of AI.', year: '1993', color: '#4ADE80', imageUrl: '' },
    { id: 'gosling', name: 'James Gosling', role: 'Java', desc: 'Created Java — "write once, run anywhere" — powering billions of devices.', year: '1995', color: '#F97316', imageUrl: '' },
    { id: 'eich', name: 'Brendan Eich', role: 'JavaScript', desc: 'Created JavaScript in 10 days — now the language of the web, running in every browser.', year: '1995', color: '#FDE047', imageUrl: '' },
    { id: 'page', name: 'Larry Page', role: 'Google & PageRank', desc: 'Co-founded Google and invented PageRank, organizing the world\'s information.', year: '1998', color: '#F472B6', imageUrl: '' },
    { id: 'wales', name: 'Jimmy Wales', role: 'Wikipedia', desc: 'Created Wikipedia — the largest free encyclopedia, written collaboratively by humanity.', year: '2001', color: '#D1D5DB', imageUrl: '' },

    // ━━━ ERA VI: AI & The Future (2000s–Present) ━━━
    { id: 'hinton', name: 'Geoffrey Hinton', role: 'Deep Learning', desc: 'Godfather of deep learning — his backpropagation breakthroughs ignited the AI revolution.', year: '2006', color: '#C084FC', imageUrl: '' },
    { id: 'bengio', name: 'Yoshua Bengio', role: 'Neural Networks', desc: 'Advanced deep learning theory and generative models, sharing the Turing Award.', year: '2003', color: '#A78BFA', imageUrl: '' },
    { id: 'nakamoto', name: 'Satoshi Nakamoto', role: 'Bitcoin & Blockchain', desc: 'Published the Bitcoin whitepaper — decentralized trust without central authority.', year: '2008', color: '#F59E0B', imageUrl: '' },
    { id: 'feifei', name: 'Fei-Fei Li', role: 'ImageNet', desc: 'Created ImageNet, the dataset that benchmarked and accelerated computer vision breakthroughs.', year: '2009', color: '#EC4899', imageUrl: '' },
    { id: 'hassabis', name: 'Demis Hassabis', role: 'DeepMind & AlphaGo', desc: 'Founded DeepMind, whose AlphaGo defeated the world champion — a watershed moment for AI.', year: '2010', color: '#2DD4BF', imageUrl: '' },
    { id: 'karpathy', name: 'Andrej Karpathy', role: 'Neural Net Educator', desc: 'Democratized deep learning through legendary lectures and open-source implementations.', year: '2015', color: '#FB923C', imageUrl: '' },
    { id: 'amodei', name: 'Dario Amodei', role: 'AI Safety', desc: 'Founded Anthropic to pursue safe, interpretable AI systems that align with human values.', year: '2021', color: '#D4A574', imageUrl: '' },
    { id: 'altman', name: 'Sam Altman', role: 'ChatGPT & OpenAI', desc: 'Led OpenAI through the release of ChatGPT, bringing large language models to the world.', year: '2022', color: '#86EFAC', imageUrl: '' },
    { id: 'su', name: 'Lisa Su', role: 'AMD Renaissance', desc: 'Transformed AMD from near-bankruptcy into a computing powerhouse rivaling Intel and NVIDIA.', year: '2014', color: '#F87171', imageUrl: '' },
];

// Portal for Tooltips
const TooltipPortal = ({ children }: { children: React.ReactNode }) => {
    if (typeof document === 'undefined') return null;
    return createPortal(children, document.body);
};

// ─── Seeded random for deterministic orbits ───
function seededRandom(seed: number) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return s / 2147483647;
    };
}

export default function StarMap() {
    const [activeStar, setActiveStar] = useState<string | null>(null);
    const isPausedRef = useRef(false);
    const rotationRef = useRef(0);
    const requestRef = useRef<number>();
    const containerRef = useRef<HTMLDivElement>(null);
    const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const starRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

    const stars = useMemo(() => {
        // Deterministic RNG so orbits don't jump on re-render
        const rng = seededRandom(42);

        // Distribute 45 stars across 4 orbit bands
        const bands = [
            { min: 12, max: 22, count: 10 },  // Inner ring — tight, fast
            { min: 24, max: 32, count: 12 },  // Mid-inner
            { min: 34, max: 42, count: 13 },  // Mid-outer
            { min: 44, max: 55, count: 10 },  // Outer ring — wide, slow
        ];

        let starIndex = 0;
        const majorStars: Star[] = [];

        bands.forEach((band, bandIdx) => {
            const starsInBand = fixedStarsData.slice(starIndex, starIndex + band.count);
            starsInBand.forEach((data, i) => {
                const t = i / band.count; // 0..1 distribution within band
                majorStars.push({
                    ...data,
                    angle: t * Math.PI * 2 + bandIdx * 0.7, // Offset each band's start
                    radius: band.min + rng() * (band.max - band.min),
                    eccentricity: rng() * 0.35, // 0–0.35 ellipse stretch
                    speed: 0.6 + rng() * 0.8 + (bandIdx === 0 ? 0.4 : 0) // Inner = faster
                        * (rng() > 0.15 ? 1 : -1), // ~15% retrograde orbits
                    inclination: (rng() - 0.5) * (1.2 + bandIdx * 0.3), // Outer = more tilted
                    nodeAngle: rng() * Math.PI * 2,
                    size: 2.5 + rng() * 1.5, // 2.5–4px
                });
            });
            starIndex += band.count;
        });

        // Background decoration stars
        const bgStars: Star[] = Array.from({ length: 80 }).map((_, i) => ({
            id: `bg-${i}`, name: '', role: '', desc: '', year: '',
            angle: rng() * Math.PI * 2,
            radius: rng() * 55 + 8,
            eccentricity: rng() * 0.4,
            speed: (rng() * 0.6 + 0.3) * (rng() > 0.3 ? 1 : -1),
            inclination: (rng() - 0.5) * 2.5,
            nodeAngle: rng() * Math.PI * 2,
            size: rng() * 1.5 + 0.3,
            color: rng() > 0.85 ? '#ffffff' : '#ffffff60'
        }));

        return [...bgStars, ...majorStars];
    }, []);

    // ─── Cache container dimensions (ResizeObserver, not per-frame reads) ───
    const containerSizeRef = useRef({ w: 1200, h: 600 });
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            containerSizeRef.current = {
                w: entry.contentRect.width,
                h: entry.contentRect.height,
            };
        });
        ro.observe(el);
        containerSizeRef.current = { w: el.clientWidth, h: el.clientHeight };
        return () => ro.disconnect();
    }, []);

    // ─── Animation loop: GPU-only transform, no layout reflow ───
    const animate = useCallback(() => {
        if (!isPausedRef.current) {
            rotationRef.current += 0.0005;
        }
        const rot = rotationRef.current;
        const cw = containerSizeRef.current.w;

        stars.forEach((star) => {
            const el = starRefsMap.current.get(star.id);
            if (!el) return;

            const isInteractive = !star.id.startsWith('bg-');
            const theta = star.angle + rot * star.speed;

            // ─── Elliptical orbit with eccentricity ───
            const e = star.eccentricity;
            const r = star.radius * (1 - e * e) / (1 + e * Math.cos(theta));

            const rawX = Math.cos(theta) * r;
            const rawZ = Math.sin(theta) * r;

            // 25% of container width as spread (matches original calc(50% + X%))
            const tx = rawX * cw * 0.25;
            const ty = rawZ * 20 * Math.sin(star.inclination)
                + Math.sin(theta * 1.3 + star.nodeAngle) * 12
                + Math.cos(theta * 0.7 + star.nodeAngle * 2) * 5;
            const z = rawZ * 10 * Math.cos(star.inclination);

            const opacity = Math.max(0.08, (z + 50) / 70);
            const zIndex = Math.max(0, Math.min(5, Math.floor((z + 20) / 10)));
            const isForeground = z > -15;

            // GPU compositing only — no layout reflow
            el.style.transform = `translate(${tx}px, ${ty}px)`;
            el.style.opacity = String(opacity);
            el.style.zIndex = String(zIndex);

            if (isInteractive) {
                el.style.cursor = isForeground ? 'pointer' : 'default';
                el.style.pointerEvents = isForeground ? 'auto' : 'none';
            }
        });

        requestRef.current = requestAnimationFrame(animate);
    }, [stars]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [animate]);

    // ─── Hover handlers ───
    const handleZoneEnter = useCallback((id: string) => {
        if (leaveTimerRef.current) {
            clearTimeout(leaveTimerRef.current);
            leaveTimerRef.current = null;
        }
        setActiveStar(id);
        isPausedRef.current = true;
    }, []);

    const handleZoneLeave = useCallback(() => {
        leaveTimerRef.current = setTimeout(() => {
            setActiveStar(null);
            isPausedRef.current = false;
            leaveTimerRef.current = null;
        }, 120);
    }, []);

    const handleStarClick = useCallback(() => {
        console.log("Navigating to Civilization Map...");
        // window.location.href = '/civilization-map';
    }, []);

    const getTooltipPosition = useCallback((starId: string) => {
        const element = document.getElementById(`star-${starId}`);
        if (element) {
            const rect = element.getBoundingClientRect();
            const isRightSide = rect.left > window.innerWidth * 0.7;
            // Use viewport coords only — card is position:fixed
            return {
                top: rect.top + rect.height / 2,
                left: rect.left + rect.width / 2,
                align: isRightSide ? 'right' : 'left'
            };
        }
        return { top: 0, left: 0, align: 'left' };
    }, []);

    const activeStarData = activeStar ? stars.find(s => s.id === activeStar) : null;
    const tooltipPos = activeStar ? getTooltipPosition(activeStar) : null;
    const HIT_PADDING = 14;

    return (
        <div
            ref={containerRef}
            className="absolute inset-0"
            style={{ zIndex: 0 }}
        >
            <div className="absolute w-1 h-1 bg-white/5 rounded-full blur-sm" />

            {stars.map((star) => {
                const isInteractive = !star.id.startsWith('bg-');
                return (
                    <div
                        key={star.id}
                        id={`star-${star.id}`}
                        ref={(el) => { if (el) starRefsMap.current.set(star.id, el); }}
                        className="absolute rounded-full pointer-events-none"
                        style={{
                            left: '50%',
                            top: '50%',
                            width: star.size,
                            height: star.size,
                            backgroundColor: star.color,
                            boxShadow: isInteractive ? `0 0 8px ${star.color}` : 'none',
                            willChange: 'transform, opacity',
                        }}
                    >
                        {isInteractive && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: -HIT_PADDING, left: -HIT_PADDING,
                                    right: -HIT_PADDING, bottom: -HIT_PADDING,
                                    borderRadius: '50%',
                                    pointerEvents: 'auto',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={() => handleZoneEnter(star.id)}
                                onMouseLeave={handleZoneLeave}
                                onClick={handleStarClick}
                            />
                        )}
                        {isInteractive && activeStar !== star.id && (
                            <div
                                className="absolute -inset-1 rounded-full"
                                style={{
                                    backgroundColor: star.color,
                                    opacity: 0.25,
                                    pointerEvents: 'none',
                                    animation: `pulse-glow 3s ease-in-out infinite`,
                                    animationDelay: `${(star.angle * 1000) % 3000}ms`,
                                }}
                            />
                        )}
                    </div>
                );
            })}

            <AnimatePresence>
                {activeStarData && tooltipPos && (
                    <TooltipPortal>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 5 }}
                            className="fixed z-[9999] w-72 bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl"
                            style={{
                                top: tooltipPos.top,
                                left: tooltipPos.left,
                                borderLeft: `3px solid ${activeStarData.color}`,
                                transform: tooltipPos.align === 'right'
                                    ? 'translate(calc(-100% - 15px), -50%)'
                                    : 'translate(15px, -50%)',
                                pointerEvents: 'auto',
                            }}
                            onMouseEnter={() => handleZoneEnter(activeStarData.id)}
                            onMouseLeave={handleZoneLeave}
                        >
                            {activeStarData.imageUrl && (
                                <div className="h-32 w-full bg-cover bg-center" style={{ backgroundImage: `url(${activeStarData.imageUrl})` }} />
                            )}
                            <div className="p-4">
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3 className="text-white font-bold text-lg">{activeStarData.name}</h3>
                                    <span className="text-xs font-mono opacity-80" style={{ color: activeStarData.color }}>{activeStarData.year}</span>
                                </div>
                                <div className="text-xs font-medium mb-2 uppercase tracking-wider opacity-70" style={{ color: activeStarData.color }}>{activeStarData.role}</div>
                                <p className="text-xs text-slate-300 leading-relaxed font-light">{activeStarData.desc}</p>
                                <div className="mt-3 pt-2 border-t border-white/5 flex items-center text-[10px] text-white/40 uppercase tracking-widest">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/40 mr-2 animate-pulse" />
                                    Click to Explore
                                </div>
                            </div>
                        </motion.div>
                    </TooltipPortal>
                )}
            </AnimatePresence>

            <style>{`
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
        </div>
    );
}

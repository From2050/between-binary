import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { civilizationStars, type CivilizationStar } from '../data/civilizationStars';

// The shared civilization record, mapped into this display's orbital form.
// The same data drives the 3D walk at /world/, which maps it onto a sky dome
// instead — one source of truth, two independent presentations.
type Star = CivilizationStar & {
    angle: number;
    radius: number;
    eccentricity: number; // 0 = circle, 0.5 = elongated ellipse
    speed: number;
    inclination: number;
    nodeAngle: number;
    size: number;
};


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
            const starsInBand = civilizationStars.slice(starIndex, starIndex + band.count);
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

    // ─── Respect prefers-reduced-motion: freeze orbit rotation, keep layout ───
    const prefersReducedMotionRef = useRef(false);
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        prefersReducedMotionRef.current = mq.matches;
        const handler = (e: MediaQueryListEvent) => { prefersReducedMotionRef.current = e.matches; };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // ─── Animation loop: GPU-only transform, no layout reflow ───
    const animate = useCallback(() => {
        if (!isPausedRef.current && !prefersReducedMotionRef.current) {
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
        window.location.href = '/lab/civilization-star-map/';
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
        @media (prefers-reduced-motion: reduce) {
          [style*="pulse-glow"] { animation: none !important; }
        }
      `}</style>
        </div>
    );
}

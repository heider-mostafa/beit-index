import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface Zone {
  id: string;
  nameEn: string;
  nameAr: string;
  x: number;
  y: number;
  pricePerSqm: number;
  change: number;
  activity: 'high' | 'medium' | 'low';
}

const CAIRO_ZONES: Zone[] = [
  { id: 'new-cairo', nameEn: 'New Cairo', nameAr: 'القاهرة الجديدة', x: 75, y: 45, pricePerSqm: 41820, change: 8.3, activity: 'high' },
  { id: 'sheikh-zayed', nameEn: 'Sheikh Zayed', nameAr: 'الشيخ زايد', x: 20, y: 35, pricePerSqm: 34200, change: 4.1, activity: 'high' },
  { id: '6th-october', nameEn: '6th October', nameAr: '6 أكتوبر', x: 15, y: 50, pricePerSqm: 28500, change: 5.2, activity: 'medium' },
  { id: 'new-capital', nameEn: 'New Capital', nameAr: 'العاصمة الإدارية', x: 88, y: 55, pricePerSqm: 28500, change: 12.4, activity: 'high' },
  { id: 'maadi', nameEn: 'Maadi', nameAr: 'المعادي', x: 55, y: 70, pricePerSqm: 38900, change: 3.8, activity: 'medium' },
  { id: 'heliopolis', nameEn: 'Heliopolis', nameAr: 'مصر الجديدة', x: 60, y: 30, pricePerSqm: 42500, change: 2.9, activity: 'medium' },
  { id: 'nasr-city', nameEn: 'Nasr City', nameAr: 'مدينة نصر', x: 65, y: 40, pricePerSqm: 35600, change: 4.5, activity: 'low' },
  { id: 'zamalek', nameEn: 'Zamalek', nameAr: 'الزمالك', x: 45, y: 45, pricePerSqm: 85000, change: 1.2, activity: 'low' },
  { id: 'mohandessin', nameEn: 'Mohandessin', nameAr: 'المهندسين', x: 40, y: 38, pricePerSqm: 52000, change: 2.1, activity: 'medium' },
  { id: 'dokki', nameEn: 'Dokki', nameAr: 'الدقي', x: 42, y: 50, pricePerSqm: 48000, change: 3.2, activity: 'low' },
];

const formatPrice = (price: number) => {
  if (price >= 1000) {
    return `${(price / 1000).toFixed(1)}k`;
  }
  return price.toString();
};

export const CairoZoneMap: React.FC = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [hoveredZone, setHoveredZone] = React.useState<Zone | null>(null);
  const [activeZone, setActiveZone] = React.useState<Zone>(CAIRO_ZONES[0]);

  // Rotate through zones for the active highlight
  React.useEffect(() => {
    const interval = setInterval(() => {
      setActiveZone(prev => {
        const currentIndex = CAIRO_ZONES.findIndex(z => z.id === prev.id);
        return CAIRO_ZONES[(currentIndex + 1) % CAIRO_ZONES.length];
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full aspect-square bg-gradient-to-br from-cream-100 to-cream-200 rounded-lg overflow-hidden border border-ink-100">
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #1a1a1a 1px, transparent 1px),
            linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      />

      {/* Nile River representation */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M 48 0 Q 50 25, 45 50 Q 40 75, 50 100"
          fill="none"
          stroke="#0B5D3B"
          strokeWidth="0.8"
          strokeOpacity="0.15"
          strokeDasharray="2,2"
        />
      </svg>

      {/* Zone dots */}
      {CAIRO_ZONES.map((zone, index) => {
        const isActive = activeZone.id === zone.id;
        const isHovered = hoveredZone?.id === zone.id;
        const showTooltip = isActive || isHovered;

        return (
          <div
            key={zone.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
            style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
            onMouseEnter={() => setHoveredZone(zone)}
            onMouseLeave={() => setHoveredZone(null)}
          >
            {/* Pulse rings for high activity zones */}
            {zone.activity === 'high' && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full bg-emerald-500"
                  initial={{ scale: 1, opacity: 0.4 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                  style={{ width: 12, height: 12, marginLeft: -6, marginTop: -6 }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full bg-emerald-500"
                  initial={{ scale: 1, opacity: 0.3 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 + 0.5 }}
                  style={{ width: 12, height: 12, marginLeft: -6, marginTop: -6 }}
                />
              </>
            )}

            {/* Zone dot */}
            <motion.div
              className={`relative rounded-full border-2 ${
                zone.activity === 'high'
                  ? 'bg-emerald-500 border-emerald-400'
                  : zone.activity === 'medium'
                  ? 'bg-emerald-400 border-emerald-300'
                  : 'bg-emerald-300 border-emerald-200'
              }`}
              style={{ width: 12, height: 12 }}
              animate={{
                scale: isActive ? 1.3 : isHovered ? 1.2 : 1,
                boxShadow: isActive
                  ? '0 0 20px rgba(11, 93, 59, 0.4)'
                  : '0 0 0px rgba(11, 93, 59, 0)'
              }}
              transition={{ duration: 0.2 }}
            />

            {/* Tooltip */}
            <AnimatePresence>
              {showTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute z-10 bg-white rounded-md shadow-lg border border-ink-100 p-3 whitespace-nowrap ${
                    zone.x > 50 ? 'right-full mr-3' : 'left-full ml-3'
                  }`}
                  style={{ top: '50%', transform: 'translateY(-50%)' }}
                >
                  <div className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider mb-1">
                    {isAr ? zone.nameAr : zone.nameEn}
                  </div>
                  <div className="font-serif text-lg text-ink-600">
                    EGP {formatPrice(zone.pricePerSqm)}
                    <span className="text-xs text-ink-300 font-sans">/m²</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-xs font-medium ${zone.change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {zone.change > 0 ? '+' : ''}{zone.change}%
                    </span>
                    <span className="text-[10px] text-ink-300">vs last quarter</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4 text-[10px] text-ink-400">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>High Activity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-300" />
          <span>Low</span>
        </div>
      </div>

      {/* Live indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-2.5 py-1.5 rounded-full border border-ink-100">
        <motion.div
          className="w-2 h-2 rounded-full bg-emerald-500"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider">Live Data</span>
      </div>
    </div>
  );
};

export default CairoZoneMap;

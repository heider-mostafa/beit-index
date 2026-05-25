import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Home, Building2, Building, MapPin } from 'lucide-react';

interface TickerItem {
  id: string;
  propertyType: 'apartment' | 'villa' | 'duplex' | 'commercial';
  locationEn: string;
  locationAr: string;
  price: number;
  timeAgo: string;
  timeAgoAr: string;
}

const TICKER_ITEMS: TickerItem[] = [
  { id: '1', propertyType: 'apartment', locationEn: 'New Cairo, 5th Settlement', locationAr: 'القاهرة الجديدة، التجمع الخامس', price: 2400000, timeAgo: '2 min ago', timeAgoAr: 'منذ دقيقتين' },
  { id: '2', propertyType: 'villa', locationEn: 'Sheikh Zayed, Beverly Hills', locationAr: 'الشيخ زايد، بيفرلي هيلز', price: 8500000, timeAgo: '5 min ago', timeAgoAr: 'منذ 5 دقائق' },
  { id: '3', propertyType: 'duplex', locationEn: 'Maadi, Sarayat', locationAr: 'المعادي، السرايات', price: 4200000, timeAgo: '8 min ago', timeAgoAr: 'منذ 8 دقائق' },
  { id: '4', propertyType: 'apartment', locationEn: 'Heliopolis, Korba', locationAr: 'مصر الجديدة، كوربة', price: 3100000, timeAgo: '12 min ago', timeAgoAr: 'منذ 12 دقيقة' },
  { id: '5', propertyType: 'commercial', locationEn: 'New Capital, MU23', locationAr: 'العاصمة الإدارية', price: 15000000, timeAgo: '15 min ago', timeAgoAr: 'منذ 15 دقيقة' },
  { id: '6', propertyType: 'apartment', locationEn: '6th October, Dreamland', locationAr: '6 أكتوبر، دريم لاند', price: 1850000, timeAgo: '18 min ago', timeAgoAr: 'منذ 18 دقيقة' },
  { id: '7', propertyType: 'villa', locationEn: 'New Cairo, Katameya', locationAr: 'القاهرة الجديدة، قطامية', price: 12000000, timeAgo: '22 min ago', timeAgoAr: 'منذ 22 دقيقة' },
  { id: '8', propertyType: 'duplex', locationEn: 'Zamalek', locationAr: 'الزمالك', price: 9500000, timeAgo: '25 min ago', timeAgoAr: 'منذ 25 دقيقة' },
];

const PropertyIcon: React.FC<{ type: TickerItem['propertyType']; className?: string }> = ({ type, className }) => {
  switch (type) {
    case 'villa':
      return <Home className={className} />;
    case 'commercial':
      return <Building2 className={className} />;
    case 'duplex':
      return <Building className={className} />;
    default:
      return <Building className={className} />;
  }
};

const formatPrice = (price: number): string => {
  if (price >= 1000000) {
    return `${(price / 1000000).toFixed(1)}M`;
  }
  if (price >= 1000) {
    return `${(price / 1000).toFixed(0)}K`;
  }
  return price.toString();
};

export const LiveTicker: React.FC = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % TICKER_ITEMS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const currentItem = TICKER_ITEMS[currentIndex];

  return (
    <div className="bg-ink-600 text-cream-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="flex items-center h-10 gap-4">
          {/* Live indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <motion.div
              className="w-2 h-2 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-cream-200">
              {isAr ? 'مباشر' : 'Live'}
            </span>
          </div>

          <div className="h-4 w-px bg-ink-400" />

          {/* Ticker content */}
          <div className="flex-1 overflow-hidden relative h-full flex items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentItem.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 text-sm"
              >
                <PropertyIcon type={currentItem.propertyType} className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-cream-100 truncate">
                  {isAr ? currentItem.locationAr : currentItem.locationEn}
                </span>
                <span className="text-cream-50 font-semibold shrink-0">
                  EGP {formatPrice(currentItem.price)}
                </span>
                <span className="text-cream-300 text-xs shrink-0">
                  {isAr ? currentItem.timeAgoAr : currentItem.timeAgo}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          <div className="flex gap-1 shrink-0">
            {TICKER_ITEMS.slice(0, 5).map((_, index) => (
              <div
                key={index}
                className={`w-1 h-1 rounded-full transition-colors duration-300 ${
                  index === currentIndex % 5 ? 'bg-emerald-400' : 'bg-ink-400'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTicker;

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'motion/react';
import { TrendingUp, ArrowUp } from 'lucide-react';
import { Card } from './ui';

const data = [
  { month: 'Jun', value: 31000 },
  { month: 'Jul', value: 31500 },
  { month: 'Aug', value: 32200 },
  { month: 'Sep', value: 32600 },
  { month: 'Oct', value: 33100 },
  { month: 'Nov', value: 33800 },
  { month: 'Dec', value: 34500 },
  { month: 'Jan', value: 35800 },
  { month: 'Feb', value: 37200 },
  { month: 'Mar', value: 38900 },
  { month: 'Apr', value: 40100 },
  { month: 'May', value: 41820 },
];

export const HeroChart = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return (
    <Card className="w-full bg-white p-0 overflow-hidden shadow-none border-ink-100">
      <div className="p-6 pb-2 border-b border-ink-50">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="eyebrow !text-ink-300">
                {t('hero.chart.eyebrow')}
               </span>
               <div className="flex items-center gap-1.5 bg-emerald-50 px-1.5 py-0.5 rounded-[2px]">
                  <motion.div 
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                  />
                  <span className="text-[9px] font-bold text-emerald-600 tracking-wider">
                    {t('hero.chart.live')}
                  </span>
               </div>
            </div>
            <div className="flex items-baseline gap-2">
               <h3 className="text-[32px] font-serif font-medium text-ink-600">
                 EGP 41,820
               </h3>
               <span className="text-body-s text-ink-300">
                 {t('hero.chart.perSqM')}
               </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-emerald-600 font-medium text-sm">
            <ArrowUp className="h-4 w-4" />
            <span>8.3%</span>
            <span className="text-[11px] text-ink-200 font-normal ms-1">
              {t('hero.chart.vsQ1')}
            </span>
          </div>
        </div>
      </div>

      <div className="h-[240px] w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0B5D3B" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#0B5D3B" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="month" 
              hide 
              reversed={isRtl}
            />
            <YAxis hide domain={['dataMin - 5000', 'dataMax + 2000']} reversed={false} />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '4px', 
                border: '0.5px solid #D9D6CC', 
                fontSize: '11px',
                fontFamily: 'Inter',
                backgroundColor: 'rgba(253, 252, 248, 0.95)'
              }} 
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#0B5D3B" 
              strokeWidth={1.5}
              fillOpacity={1} 
              fill="url(#colorValue)" 
              animationDuration={1200}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-0 divide-x divide-ink-50 border-t border-ink-50 rtl:divide-x-reverse">
        {[
          { label: 'Sheikh Zayed', val: 'EGP 34.2k', chg: '+4.1%' },
          { label: 'New Capital', val: 'EGP 28.5k', chg: '+12.4%' },
          { label: 'North Coast', val: 'EGP 62.1k', chg: '+15.2%' },
        ].map((stat) => (
          <div key={stat.label} className="p-4">
             <div className="eyebrow !text-[9px] mb-1">{stat.label}</div>
             <div className="font-serif text-base text-ink-500 mb-0.5">{stat.val}</div>
             <div className="text-[10px] text-emerald-600 font-medium">{stat.chg}</div>
          </div>
        ))}
      </div>
    </Card>
  );
};

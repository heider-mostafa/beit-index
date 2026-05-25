import * as React from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTranslation } from 'react-i18next';

// Real Cairo zone data with accurate coordinates and Dec 2025 prices
// Sources: Global Property Guide, Sands of Wealth, Aqarmap (Dec 2025)
interface ZoneData {
  id: string;
  nameEn: string;
  nameAr: string;
  coordinates: [number, number]; // [lng, lat]
  pricePerSqm: number; // EGP per sqm (apartments)
  villaPrice?: number; // EGP per sqm (villas)
  yoyChange: number; // Year-over-year % change
  rentalYield?: number; // Annual rental yield %
}

const CAIRO_ZONES: ZoneData[] = [
  {
    id: 'zamalek',
    nameEn: 'Zamalek',
    nameAr: 'الزمالك',
    coordinates: [31.2194, 30.0609],
    pricePerSqm: 64400,
    yoyChange: 210,
    rentalYield: 4.8,
  },
  {
    id: 'sheikh-zayed',
    nameEn: 'Sheikh Zayed',
    nameAr: 'الشيخ زايد',
    coordinates: [30.9425, 30.0176],
    pricePerSqm: 64050,
    villaPrice: 72300,
    yoyChange: 185.3,
    rentalYield: 6.87,
  },
  {
    id: 'new-cairo',
    nameEn: 'New Cairo',
    nameAr: 'القاهرة الجديدة',
    coordinates: [31.4779, 30.0055],
    pricePerSqm: 61550,
    villaPrice: 97000,
    yoyChange: 157.3,
    rentalYield: 7.75,
  },
  {
    id: 'mohandessin',
    nameEn: 'Mohandessin',
    nameAr: 'المهندسين',
    coordinates: [31.2013, 30.0561],
    pricePerSqm: 52000,
    yoyChange: 95,
    rentalYield: 5.1,
  },
  {
    id: 'dokki',
    nameEn: 'Dokki',
    nameAr: 'الدقي',
    coordinates: [31.2120, 30.0380],
    pricePerSqm: 48000,
    yoyChange: 88,
    rentalYield: 5.3,
  },
  {
    id: '6th-october',
    nameEn: '6th of October',
    nameAr: '6 أكتوبر',
    coordinates: [30.9167, 29.9500],
    pricePerSqm: 47000,
    villaPrice: 74550,
    yoyChange: 153.7,
    rentalYield: 6.2,
  },
  {
    id: 'heliopolis',
    nameEn: 'Heliopolis',
    nameAr: 'مصر الجديدة',
    coordinates: [31.3225, 30.0911],
    pricePerSqm: 42000,
    yoyChange: 78,
    rentalYield: 5.32,
  },
  {
    id: 'nasr-city',
    nameEn: 'Nasr City',
    nameAr: 'مدينة نصر',
    coordinates: [31.3450, 30.0511],
    pricePerSqm: 38000,
    yoyChange: 65,
    rentalYield: 5.8,
  },
  {
    id: 'maadi',
    nameEn: 'Maadi',
    nameAr: 'المعادي',
    coordinates: [31.2500, 29.9600],
    pricePerSqm: 26950,
    villaPrice: 43700,
    yoyChange: 39.4,
    rentalYield: 6.1,
  },
  {
    id: 'new-capital',
    nameEn: 'New Capital',
    nameAr: 'العاصمة الإدارية',
    coordinates: [31.7650, 30.0275],
    pricePerSqm: 27600,
    yoyChange: 25,
    rentalYield: 8.2,
  },
];

const formatPrice = (price: number): string => {
  if (price >= 1000) {
    return `${(price / 1000).toFixed(1)}K`;
  }
  return price.toLocaleString();
};

const getPriceColor = (price: number): string => {
  // Color gradient based on price tiers
  if (price >= 60000) return '#059669'; // emerald-600 - Premium
  if (price >= 45000) return '#10b981'; // emerald-500 - High
  if (price >= 35000) return '#34d399'; // emerald-400 - Medium-High
  if (price >= 25000) return '#6ee7b7'; // emerald-300 - Medium
  return '#a7f3d0'; // emerald-200 - Entry
};

export const CairoWebGLMap: React.FC = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const mapContainer = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<maplibregl.Map | null>(null);
  const markersRef = React.useRef<maplibregl.Marker[]>([]);
  const [selectedZone, setSelectedZone] = React.useState<ZoneData | null>(null);
  const [mapLoaded, setMapLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Small delay to ensure container has dimensions
    const initMap = () => {
      if (!mapContainer.current) return;

      // Initialize map with OpenStreetMap tiles (free, no API key)
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: [
                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm-tiles-layer',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19,
              paint: {
                'raster-saturation': -0.6,
                'raster-brightness-min': 0.1,
                'raster-brightness-max': 0.85,
                'raster-contrast': 0.1,
              },
            },
          ],
        },
        center: [31.15, 30.02], // Greater Cairo center
        zoom: 9.2,
        minZoom: 8,
        maxZoom: 14,
        attributionControl: false,
      });

      map.current.on('load', () => {
        setMapLoaded(true);
        // Force resize after load to fix partial rendering
        map.current?.resize();

        // Add markers for each zone
        CAIRO_ZONES.forEach((zone) => {
          const el = document.createElement('div');
          el.className = 'cairo-zone-marker';
          el.innerHTML = `
            <div class="marker-pulse"></div>
            <div class="marker-dot" style="background-color: ${getPriceColor(zone.pricePerSqm)}"></div>
            <div class="marker-label">${formatPrice(zone.pricePerSqm)}</div>
          `;

          el.addEventListener('click', () => {
            setSelectedZone(zone);
          });

          el.addEventListener('mouseenter', () => {
            el.classList.add('hovered');
          });

          el.addEventListener('mouseleave', () => {
            el.classList.remove('hovered');
          });

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(zone.coordinates)
            .addTo(map.current!);

          markersRef.current.push(marker);
        });
      });

      // Disable scroll zoom for better UX
      map.current.scrollZoom.disable();

      // Handle resize events
      const handleResize = () => {
        map.current?.resize();
      };
      window.addEventListener('resize', handleResize);

      // Use ResizeObserver for container size changes
      const resizeObserver = new ResizeObserver(() => {
        map.current?.resize();
      });
      resizeObserver.observe(mapContainer.current);

      return () => {
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
      };
    };

    // Delay initialization to ensure container is rendered
    const timeoutId = setTimeout(initMap, 100);

    return () => {
      clearTimeout(timeoutId);
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update marker labels when language changes
  React.useEffect(() => {
    if (!mapLoaded) return;

    markersRef.current.forEach((marker, index) => {
      const zone = CAIRO_ZONES[index];
      const el = marker.getElement();
      const labelEl = el.querySelector('.marker-label');
      if (labelEl) {
        labelEl.textContent = formatPrice(zone.pricePerSqm);
      }
    });
  }, [isAr, mapLoaded]);

  return (
    <div className="relative w-full aspect-[4/3] md:aspect-square min-h-[400px] rounded-lg overflow-hidden border border-ink-100 shadow-lg">
      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* Custom CSS for markers and map */}
      <style>{`
        .maplibregl-map {
          width: 100% !important;
          height: 100% !important;
        }
        .maplibregl-canvas {
          width: 100% !important;
          height: 100% !important;
        }
        .cairo-zone-marker {
          cursor: pointer;
          position: relative;
          transition: transform 0.2s ease;
        }

        .cairo-zone-marker:hover,
        .cairo-zone-marker.hovered {
          transform: scale(1.15);
          z-index: 10;
        }

        .marker-pulse {
          position: absolute;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.3);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 2s ease-out infinite;
        }

        .marker-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          position: relative;
          z-index: 1;
        }

        .marker-label {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 4px;
          background: rgba(255,255,255,0.95);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          color: #1a1a1a;
          white-space: nowrap;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        }

        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
        }
      `}</style>

      {/* Overlay gradient for branding */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-white/20 via-transparent to-white/10" />

      {/* Selected zone info panel */}
      {selectedZone && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-72 bg-white rounded-lg shadow-xl border border-ink-100 p-4 z-20">
          <button
            onClick={() => setSelectedZone(null)}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-ink-400 hover:text-ink-600 transition-colors"
          >
            ×
          </button>

          <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">
            {isAr ? selectedZone.nameAr : selectedZone.nameEn}
          </div>

          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-serif text-ink-600">
              EGP {selectedZone.pricePerSqm.toLocaleString()}
            </span>
            <span className="text-xs text-ink-400">/m²</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[10px] text-ink-400 uppercase tracking-wide">YoY Change</div>
              <div className={`font-medium ${selectedZone.yoyChange > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {selectedZone.yoyChange > 0 ? '+' : ''}{selectedZone.yoyChange}%
              </div>
            </div>
            {selectedZone.rentalYield && (
              <div>
                <div className="text-[10px] text-ink-400 uppercase tracking-wide">Rental Yield</div>
                <div className="font-medium text-ink-600">{selectedZone.rentalYield}%</div>
              </div>
            )}
            {selectedZone.villaPrice && (
              <div className="col-span-2">
                <div className="text-[10px] text-ink-400 uppercase tracking-wide">Villa Price</div>
                <div className="font-medium text-ink-600">
                  EGP {selectedZone.villaPrice.toLocaleString()}/m²
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-ink-100">
            <div className="text-[9px] text-ink-300">
              Data: Dec 2025 • Source: Global Property Guide, Aqarmap
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-md border border-ink-100">
        <div className="text-[9px] font-semibold text-ink-500 uppercase tracking-wider mb-2">
          {isAr ? 'سعر المتر المربع' : 'Price per m²'}
        </div>
        <div className="space-y-1.5">
          {[
            { label: '60K+', color: '#059669' },
            { label: '45-60K', color: '#10b981' },
            { label: '35-45K', color: '#34d399' },
            { label: '25-35K', color: '#6ee7b7' },
          ].map((tier) => (
            <div key={tier.label} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: tier.color }}
              />
              <span className="text-[10px] text-ink-500">{tier.label} EGP</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full border border-ink-100 shadow-sm">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider">
          {isAr ? 'ديسمبر 2025' : 'Dec 2025'}
        </span>
      </div>

      {/* Attribution */}
      <div className="absolute bottom-2 right-2 text-[8px] text-ink-400/60">
        © OpenStreetMap
      </div>
    </div>
  );
};

export default CairoWebGLMap;

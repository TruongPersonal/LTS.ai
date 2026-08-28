import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface ShowcaseItem {
  id: string;
  categoryKey: string;
  defaultCategory: string;
  imageSrc: string;
  fallbackGradient: string;
  aspectClass: string;
  widthClass: string;
}

const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    id: 'documentary',
    categoryKey: 'landing.showcase.documentary',
    defaultCategory: 'Phim tài liệu',
    imageSrc: '/showcase/documentary.jpg',
    fallbackGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    aspectClass: 'aspect-[3/4]',
    widthClass: 'w-[250px] sm:w-[280px]',
  },
  {
    id: 'masterclass',
    categoryKey: 'landing.showcase.masterclass',
    defaultCategory: 'Khóa học & Tech',
    imageSrc: '/showcase/masterclass.jpg',
    fallbackGradient: 'linear-gradient(135deg, #1e1b4b 0%, #09090b 100%)',
    aspectClass: 'aspect-[16/11]',
    widthClass: 'w-[310px] sm:w-[350px]',
  },
  {
    id: 'shorts',
    categoryKey: 'landing.showcase.shorts',
    defaultCategory: 'Shorts & Reels',
    imageSrc: '/showcase/shorts.jpg',
    fallbackGradient: 'linear-gradient(135deg, #3b0764 0%, #180828 100%)',
    aspectClass: 'aspect-[9/16]',
    widthClass: 'w-[200px] sm:w-[230px]',
  },
  {
    id: 'travel',
    categoryKey: 'landing.showcase.travel',
    defaultCategory: 'Vlogs Du lịch',
    imageSrc: '/showcase/travel.jpg',
    fallbackGradient: 'linear-gradient(135deg, #422006 0%, #1c0d02 100%)',
    aspectClass: 'aspect-[4/5]',
    widthClass: 'w-[260px] sm:w-[290px]',
  },
  {
    id: 'podcast',
    categoryKey: 'landing.showcase.podcast',
    defaultCategory: 'Podcasts',
    imageSrc: '/showcase/podcast.jpg',
    fallbackGradient: 'linear-gradient(135deg, #042f2e 0%, #021a19 100%)',
    aspectClass: 'aspect-[3/4]',
    widthClass: 'w-[240px] sm:w-[270px]',
  },
  {
    id: 'music',
    categoryKey: 'landing.showcase.music',
    defaultCategory: 'Âm nhạc & Nghệ thuật',
    imageSrc: '/showcase/music.jpg',
    fallbackGradient: 'linear-gradient(135deg, #311042 0%, #160321 100%)',
    aspectClass: 'aspect-[16/11]',
    widthClass: 'w-[300px] sm:w-[340px]',
  },
  {
    id: 'cinema',
    categoryKey: 'landing.showcase.cinema',
    defaultCategory: 'Điện ảnh & Phim',
    imageSrc: '/showcase/cinema.jpg',
    fallbackGradient: 'linear-gradient(135deg, #450a0a 0%, #1f0404 100%)',
    aspectClass: 'aspect-[3/4]',
    widthClass: 'w-[260px] sm:w-[290px]',
  },
];

export const LandingShowcaseGallery: React.FC = () => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const displayItems = [...SHOWCASE_ITEMS, ...SHOWCASE_ITEMS, ...SHOWCASE_ITEMS];

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const singleSetWidth = el.scrollWidth / 3;
    el.scrollLeft = singleSetWidth;
  }, []);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const singleSetWidth = el.scrollWidth / 3;
    if (singleSetWidth <= 0) return;

    if (el.scrollLeft >= singleSetWidth * 2) {
      el.scrollLeft -= singleSetWidth;
    } else if (el.scrollLeft <= 5) {
      el.scrollLeft += singleSetWidth;
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const onMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <section className="landing-showcase-section py-8 overflow-hidden" aria-label="Aesthetic Showcase Gallery">
      {}
      <div className="relative w-full">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onMouseDown={onMouseDown}
          onMouseLeave={onMouseLeaveOrUp}
          onMouseUp={onMouseLeaveOrUp}
          onMouseMove={onMouseMove}
          className={`flex items-end gap-6 overflow-x-auto no-scrollbar py-4 px-6 sm:px-12 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {displayItems.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className={`showcase-card flex-shrink-0 ${item.widthClass} transition-transform duration-300`}
            >
              {}
              <div
                className={`relative ${item.aspectClass} w-full rounded-2xl overflow-hidden border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-xs group`}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: item.fallbackGradient }}
                >
                  <img
                    src={item.imageSrc}
                    alt={item.defaultCategory}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>

                {}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

                {}
                <div className="absolute top-3.5 left-3.5 z-10 pointer-events-none">
                  <span className="px-3 py-1.5 rounded-xl bg-black/60 border border-white/20 text-xs sm:text-[13px] font-bold text-white tracking-wide backdrop-blur-md shadow-md inline-block">
                    {t(item.categoryKey, item.defaultCategory)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

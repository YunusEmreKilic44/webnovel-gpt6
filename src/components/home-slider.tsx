"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { ArrowLeft, ArrowRight, ChevronRight, Flame, Star } from "./icons";
import { useHydrated } from "@/lib/use-hydrated";
import { imageSource } from "@/lib/cloudinary-loader";

export type HomeSlide = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  linkPath: string;
  linkLabel: string;
  book?: {
    genres: string[];
    completed: boolean;
    rating: number;
    chapterCount: number;
    author: string;
    detailsPath: string;
  };
};

const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (callback: () => void) => {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
const getMotion = () => window.matchMedia(motionQuery).matches;
const getServerMotion = () => true;

export function HomeSlider({ slides }: { slides: HomeSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState<boolean | null>(null);
  const [focused, setFocused] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const hydrated = useHydrated();
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    getMotion,
    getServerMotion,
  );
  const count = slides.length;
  const active = count ? index % count : 0;
  const rotating = count > 1 && !(paused ?? reducedMotion);

  useEffect(() => {
    if (!rotating || focused) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const restart = () => {
      clearInterval(timer);
      if (!document.hidden) {
        timer = setInterval(
          () => setIndex((current) => (current + 1) % count),
          6000,
        );
      }
    };
    restart();
    document.addEventListener("visibilitychange", restart);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", restart);
    };
  }, [count, rotating, focused, index]);

  if (!count) return null;
  const select = (next: number) => {
    setIndex((next + count) % count);
  };

  return (
    <section
      className="home-hero managed-slider"
      aria-label="Öne çıkanlar"
      aria-roledescription="slayt gösterisi"
      tabIndex={count > 1 ? 0 : undefined}
      onFocusCapture={(event) => {
        // Keep a keyboard reader's link in place; clicking slider controls
        // must not silently disable autoplay.
        setFocused(
          Boolean(event.target.closest(".slider-track")) &&
            event.target.matches(":focus-visible"),
        );
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
      onKeyDown={(event) => {
        if (count < 2 || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          select(active + (event.key === "ArrowLeft" ? -1 : 1));
        }
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStart.current =
          event.touches.length === 1
            ? { x: touch.clientX, y: touch.clientY }
            : null;
      }}
      onTouchCancel={() => {
        touchStart.current = null;
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start || count < 2) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
          select(active + (dx < 0 ? 1 : -1));
        }
      }}
    >
      <div className="slider-track" aria-live={rotating ? "off" : "polite"}>
        {slides.map((slide, position) => (
          <div
            key={slide.id}
            className={`slider-slide${position === active ? " is-active" : ""}`}
            role="group"
            aria-roledescription="slayt"
            aria-label={`${position + 1} / ${count}: ${slide.title}`}
            aria-hidden={position !== active}
            inert={position !== active}
          >
            <Image
              className="hero-image"
              src={slide.imageUrl}
              alt={slide.imageAlt}
              fill
              {...(slide.imageUrl.startsWith("/art/")
                ? {}
                : imageSource(slide.imageUrl))}
              loading={
                position === active || position === (active + 1) % count
                  ? "eager"
                  : "lazy"
              }
              fetchPriority={position === 0 ? "high" : "auto"}
              quality={60}
              sizes="100vw"
            />
            <div className="hero-shade" />
            <div className="hero-inner">
              <div className="hero-copy">
                <span className="feature-tag">
                  {slide.book && <Flame size={15} fill="currentColor" />} ÖNE
                  ÇIKANLAR
                </span>
                {slide.book && (
                  <div className="hero-genres">
                    {slide.book.genres.map((genre) => (
                      <span key={genre}>{genre}</span>
                    ))}
                    <span>ORİJİNAL SERİ</span>
                    <span>
                      {slide.book.completed ? "Tamamlandı" : "Devam ediyor"}
                    </span>
                  </div>
                )}
                <h1>{slide.title}</h1>
                {slide.description && <p>{slide.description}</p>}
                {slide.book && (
                  <div className="hero-meta">
                    <span className="rating">
                      <Star size={15} fill="currentColor" />
                      {slide.book.rating > 0
                        ? slide.book.rating.toLocaleString("tr-TR")
                        : "Yeni"}
                    </span>
                    <span>{slide.book.chapterCount} bölüm</span>
                    <span>{slide.book.author}</span>
                  </div>
                )}
                {slide.linkPath && (
                  <div className="hero-actions">
                    <Link
                      className="button button-dark"
                      href={slide.linkPath}
                      tabIndex={position === active ? undefined : -1}
                    >
                      {slide.linkLabel} <ArrowRight size={17} />
                    </Link>
                    {slide.book &&
                      slide.book.detailsPath !== slide.linkPath && (
                        <Link
                          className="button button-glass"
                          href={slide.book.detailsPath}
                          tabIndex={position === active ? undefined : -1}
                        >
                          Seriyi incele <ChevronRight size={17} />
                        </Link>
                      )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="slider-controls" aria-label="Slayt seçimi">
          <button
            type="button"
            className="icon-button"
            onClick={() => setPaused(rotating)}
            disabled={!hydrated}
            aria-label={
              rotating ? "Otomatik geçişi durdur" : "Otomatik geçişi başlat"
            }
          >
            {rotating ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => select(active - 1)}
            disabled={!hydrated}
            aria-label="Önceki slayt"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="slider-dots">
            {slides.map((slide, position) => (
              <button
                key={slide.id}
                type="button"
                className="slider-dot"
                aria-label={`${position + 1}. slayta git: ${slide.title}`}
                aria-current={position === active ? "true" : undefined}
                onClick={() => select(position)}
                disabled={!hydrated}
              />
            ))}
          </div>
          <span className="slider-count">
            {active + 1} / {count}
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={() => select(active + 1)}
            disabled={!hydrated}
            aria-label="Sonraki slayt"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </section>
  );
}

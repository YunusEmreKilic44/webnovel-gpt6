"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "./icons";
import { useHydrated } from "@/lib/use-hydrated";
import { imageSource } from "@/lib/cloudinary-loader";

type Slide = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  linkPath: string;
  linkLabel: string;
};
export function HomeSlider({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const hydrated = useHydrated();
  const active = index % slides.length;
  const slide = slides[active];
  if (!slide) return null;
  const move = (step: number) =>
    setIndex((current) => (current + step + slides.length) % slides.length);
  return (
    <section
      className="home-hero managed-slider"
      aria-label="Öne çıkanlar"
      aria-roledescription="slayt gösterisi"
    >
      <Image
        key={slide.imageUrl}
        className="hero-image"
        src={slide.imageUrl}
        alt={slide.imageAlt}
        fill
        {...imageSource(slide.imageUrl)}
        loading="eager"
        fetchPriority={active === 0 ? "high" : "auto"}
        sizes="100vw"
      />
      <div className="hero-shade" />
      <div className="hero-inner">
        <div className="hero-copy" aria-live="polite" aria-atomic="true">
          <span className="feature-tag">ÖNE ÇIKANLAR</span>
          <h1>{slide.title}</h1>
          {slide.description && <p>{slide.description}</p>}
          {slide.linkPath && (
            <div className="hero-actions">
              <Link className="button button-dark" href={slide.linkPath}>
                {slide.linkLabel} <ArrowRight size={17} />
              </Link>
            </div>
          )}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="slider-controls" aria-label="Slayt seçimi">
          <button
            type="button"
            className="icon-button"
            onClick={() => move(-1)}
            disabled={!hydrated}
            aria-label="Önceki slayt"
          >
            <ArrowLeft size={18} />
          </button>
          <span aria-live="polite">
            {active + 1} / {slides.length}
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={() => move(1)}
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

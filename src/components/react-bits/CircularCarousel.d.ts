import type { CSSProperties, JSX } from "react";

export interface CircularCarouselItem {
  src: string;
  alt?: string;
  title?: string;
  subtitle?: string;
  href?: string;
}

export interface CircularCarouselProps {
  items?: CircularCarouselItem[];
  preset?: "cylinder" | "orbit" | "wheel" | "panorama";
  intro?: "assemble" | "rise" | "spin" | "none";
  cardWidth?: number;
  aspectRatio?: number;
  gap?: number;
  curve?: number;
  tilt?: number;
  perspective?: number;
  autoplay?: "off" | "drift" | "spin";
  speed?: number;
  interval?: number;
  direction?: "left" | "right";
  draggable?: boolean;
  momentum?: number;
  snap?: boolean;
  pauseOnHover?: boolean;
  focusOnClick?: boolean;
  parallax?: number;
  stretch?: number;
  depthFade?: number;
  fadeColor?: string;
  innerShade?: number;
  cornerRadius?: number;
  captions?: boolean;
  ariaLabel?: string;
  onChange?: (activeIndex: number) => void;
  onItemClick?: (item: CircularCarouselItem, index: number) => void;
  className?: string;
  style?: CSSProperties;
}

export default function CircularCarousel(props: CircularCarouselProps): JSX.Element;

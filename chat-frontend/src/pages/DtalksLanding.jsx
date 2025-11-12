import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export default function DTalksLanding() {
  const blob1 = useRef(null);
  const blob2 = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    // Floating animation for gradient blobs
    gsap.to([blob1.current, blob2.current], {
      xPercent: () => gsap.utils.random(-20, 20),
      yPercent: () => gsap.utils.random(-20, 20),
      duration: 6,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      stagger: 1.5,
    });

    // Fade in text
    gsap.from(textRef.current, {
      opacity: 0,
      y: 40,
      duration: 1,
      ease: "power2.out",
    });
  }, []);

  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-white">
      {/* Background blobs */}
      <div
        ref={blob1}
        className="absolute w-[400px] h-[400px] bg-blue-100 rounded-full blur-3xl opacity-70"
        style={{ top: "10%", left: "15%" }}
      />
      <div
        ref={blob2}
        className="absolute w-[450px] h-[450px] bg-pink-100 rounded-full blur-3xl opacity-70"
        style={{ bottom: "15%", right: "10%" }}
      />

      {/* Center text */}
      <div ref={textRef} className="text-center z-10">
        <h3 className="text-5xl font-bold text-gray-800">D-Talks</h3>
        <p className="text-gray-500 mt-2">Where Every Chat Begins with D.</p>
      </div>
    </div>
  );
}

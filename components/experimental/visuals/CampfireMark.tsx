import React from "react";
import { motion } from "motion/react";
import { clamp, TOKENS } from "../utils";

export function CampfireMark(props: { flicker: number }) {
  const f = clamp(props.flicker, 0.78, 1.25);

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: 118, height: 118 }}
    >
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl"
        animate={{
          opacity: [0.14 * f, 0.34 * f, 0.16 * f],
          scale: [0.98, 1.03, 0.99],
        }}
        transition={{
          duration: 2.6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          background:
            "radial-gradient(circle at 50% 64%, rgba(246,206,132,.20), rgba(255,90,106,.14) 48%, rgba(0,0,0,0) 72%)",
        }}
      />

      <div
        className="absolute bottom-[18px] left-1/2 -translate-x-1/2 rounded-full"
        style={{
          width: 104,
          height: 26,
          background: "rgba(0,0,0,.52)",
          filter: "blur(7px)",
        }}
      />

      <div
        className="absolute bottom-[26px] left-1/2 -translate-x-1/2"
        style={{ width: 92, height: 22 }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-[10px] w-[86px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: TOKENS.logA }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-[10px] w-[86px] -translate-x-1/2 -translate-y-1/2 rotate-[18deg] rounded-full"
          style={{ background: TOKENS.logB }}
        />
      </div>

      <div
        className="pointer-events-none absolute"
        style={{
          left: "50%",
          top: -34,
          width: 110,
          height: 150,
          transform: "translateX(-50%)",
          opacity: clamp(1.05 * f, 0.75, 1.15),
          zIndex: 80,
        }}
      >
        <motion.div
          className="absolute left-1/2 top-[52px] -translate-x-1/2 rounded-full"
          animate={{
            opacity: [0.18, 0.24, 0.18],
            scale: [1, 1.06, 1],
          }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            width: 46,
            height: 34,
            filter: "blur(12px)",
            background:
              "radial-gradient(circle at 50% 60%, rgba(255,255,255,.18), rgba(255,255,255,.08) 45%, rgba(0,0,0,0) 75%)",
          }}
        />
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 rounded-full"
            style={{
              top: 58,
              width: 26 + i * 9,
              height: 36 + i * 12,
              transform: "translateX(-50%)",
              filter: `blur(${12 + i * 4}px)`,
              background:
                "radial-gradient(circle at 50% 60%, rgba(255,255,255,.16), rgba(255,255,255,.07) 48%, rgba(0,0,0,0) 78%)",
            }}
            initial={{ opacity: 0 }}
            animate={{
              y: [-6, -104],
              x: [0, i % 2 ? 14 : -14, 0],
              opacity: [0, 0.22 - i * 0.03, 0],
              scale: [0.9, 1.25, 1.55],
              rotate: [-3, 6, -2],
            }}
            transition={{
              duration: 3.4 + i * 0.35,
              repeat: Infinity,
              ease: "easeOut",
              delay: i * 0.55,
            }}
          />
        ))}
      </div>

      <motion.div
        className="absolute"
        animate={{ y: [0, -1.2, 0], rotate: [-0.8, 0.8, -0.4] }}
        transition={{
          duration: 1.25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          width: 52,
          height: 70,
          top: 14,
          opacity: clamp(0.9 * f, 0.78, 1),
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 38%, rgba(255,90,106,.92), rgba(255,90,106,.18) 64%, rgba(0,0,0,0) 100%)",
            borderRadius: "999px",
            clipPath:
              "polygon(50% 0%, 64% 14%, 77% 33%, 79% 54%, 70% 72%, 56% 87%, 50% 100%, 44% 87%, 30% 72%, 21% 54%, 23% 33%, 36% 14%)",
          }}
        />
        <div
          className="absolute left-1/2 top-[13px] -translate-x-1/2"
          style={{
            width: 22,
            height: 32,
            borderRadius: "999px",
            background:
              "radial-gradient(circle at 50% 35%, rgba(246,206,132,.72), rgba(246,206,132,.18) 62%, rgba(0,0,0,0) 100%)",
            clipPath:
              "polygon(50% 0%, 66% 18%, 78% 40%, 70% 64%, 54% 84%, 50% 100%, 46% 84%, 30% 64%, 22% 40%, 34% 18%)",
            opacity: 0.92,
          }}
        />
      </motion.div>

      <div
        className="absolute bottom-[42px] left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
        style={{
          background: TOKENS.ember,
          boxShadow: "0 0 22px rgba(255,90,106,.28)",
        }}
      />
    </div>
  );
}

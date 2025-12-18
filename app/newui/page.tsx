'use client'
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { motion } from "motion/react";
import { Share2, Settings } from "lucide-react";
import {
  TOKENS,
  clamp,
  LiveBadge,
  AdsToggle,
  SegTab,
  BottomSheet,
  StarRings,
  FirelightField,
  CampfireCircle,
  AroundTheFireRow,
  ListenerDot,
  ListGroup,
  CircleRow,
  AdDock,
  ControlCenterDrawer,
  HandRaiseSparks,
  Avatar,
} from "@/components/experimental";

const sample = {
  room: {
    title: "Fireside",
    tagline: "late-night founders & builders",
    live: true,
  },
  stage: [
    {
      id: "h1",
      name: "Smoll Vikin",
      role: "Host",
      speaking: true,
    },
    {
      id: "h2",
      name: "Main Architect",
      role: "Co-host",
      speaking: false,
    },
    {
      id: "s1",
      name: "herealkayr",
      role: "Speaker",
      speaking: false,
    },
    {
      id: "s2",
      name: "BaseJunkie",
      role: "Speaker",
      speaking: false,
    },
    {
      id: "s3",
      name: "Alyx",
      role: "Speaker",
      speaking: false,
    },
    {
      id: "s4",
      name: "Raven",
      role: "Speaker",
      speaking: false,
    },
    {
      id: "s5",
      name: "Moss",
      role: "Speaker",
      speaking: false,
    },
    { id: "s6", name: "Jun", role: "Speaker", speaking: false },
    { id: "s7", name: "Koi", role: "Speaker", speaking: false },
    {
      id: "s8",
      name: "Naka",
      role: "Speaker",
      speaking: false,
    },
    {
      id: "s9",
      name: "Luka",
      role: "Speaker",
      speaking: false,
    },
    {
      id: "s10",
      name: "Sage",
      role: "Speaker",
      speaking: false,
    },
    {
      id: "s11",
      name: "Pine",
      role: "Speaker",
      speaking: false,
    },
    {
      id: "s12",
      name: "Arc",
      role: "Speaker",
      speaking: false,
    },
  ],
  listeners: [
    "ladia",
    "lemonsc",
    "kalthom",
    "SwatMC?",
    "jabsan",
    "sifu7",
    "oogbey",
    "goldenja",
    "mak594",
    "Aidan",
    "jimmycry",
    "web3farc",
    "nakamoto",
    "gentle-jack",
    "accessbes",
    "BaseSer",
    "c0zy",
    "archer",
    "hollow",
    "fern",
    "brook",
    "ember",
    "owl",
    "ridge",
    "shade",
    "trail",
  ].map((n, i) => ({
    id: "l" + i,
    name: n,
    speaking: Math.random() < 0.03,
  })),
};

export default function FiresideCallMock() {
  const [tab, setTab] = useState<"circle" | "campers">(
    "circle",
  );
  const [muted, setMuted] = useState(true);
  const [handUp, setHandUp] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [adsOn, setAdsOn] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [drawerVisibleH, setDrawerVisibleH] = useState(118);

  const [raisedHands, setRaisedHands] = useState<any[]>(() =>
    sample.listeners.slice(0, 3),
  );
  const [reactions, setReactions] = useState<
    { id: string; emoji: string; left: number }[]
  >([]);
  const [fireFlicker, setFireFlicker] = useState(1);

  const focusRef = useRef<null | "audience">(null);

  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(0);

  const campersScrollRef = useRef<HTMLDivElement | null>(null);
  const audienceAnchorRef = useRef<HTMLDivElement | null>(null);

  const room = sample.room;
  const stage = sample.stage;
  const listeners = sample.listeners;

  const hosts = stage.filter((p) => p.role === "Host");
  const cohosts = stage.filter((p) => p.role === "Co-host");
  const speakers = stage.filter((p) => p.role === "Speaker");

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const measure = () =>
      setHeaderH(Math.round(el.getBoundingClientRect().height));
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    let current = 1;

    const tick = (t: number) => {
      const s = (t - t0) / 1000;

      const base =
        1 +
        0.05 * Math.sin(s * 1.15) +
        0.035 * Math.sin(s * 2.05 + 1.7) +
        0.02 * Math.sin(s * 3.6 + 0.4);

      const micro =
        0.012 * Math.sin(s * 11.5 + 0.9) +
        0.008 * Math.sin(s * 16.8 + 2.3);
      const target = base + micro;

      current = current + (target - current) * 0.035;
      setFireFlicker(current);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function openAudience() {
    focusRef.current = "audience";
    setTab("campers");
  }

  useEffect(() => {
    if (tab !== "campers") return;
    if (focusRef.current !== "audience") return;

    const container = campersScrollRef.current;
    const anchor = audienceAnchorRef.current;
    if (container && anchor) {
      const top = anchor.offsetTop - 8;
      container.scrollTo({ top, behavior: "smooth" });
    }
    focusRef.current = null;
  }, [tab]);

  function pushReaction() {
    const emojis = ["🔥", "👏", "✨", "😂", "❤️"];
    const emoji =
      emojis[Math.floor(Math.random() * emojis.length)];
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const left = 50 + Math.floor(Math.random() * 240);
    setReactions((prev) => [...prev, { id, emoji, left }]);
    setTimeout(
      () =>
        setReactions((prev) => prev.filter((r) => r.id !== id)),
      2300,
    );
  }

  useEffect(() => {
    if (!handUp) {
      setRaisedHands((prev) =>
        prev.filter((p) => p.id !== "me"),
      );
      return;
    }
    const me = { id: "me", name: "You", speaking: false };
    setRaisedHands((prev) => {
      const exists = prev.some((p) => p.id === "me");
      if (exists) return prev;
      return [me, ...prev].slice(0, 6);
    });
  }, [handUp]);

  const drawerCollapsedH = 118;
  const drawerExpandedH = 292;
  const currentDrawerH = clamp(
    drawerVisibleH,
    drawerCollapsedH,
    drawerExpandedH,
  );

  const reservedBottom = drawerCollapsedH + 18;

  const contentH = Math.max(
    0,
    Math.round(window.innerHeight) - headerH - reservedBottom,
  );

  const adCardSpace = adsOn ? 110 : 0;

  return (
    <div
      className="h-[100dvh] w-full overflow-hidden"
      style={{ background: TOKENS.bg0, color: TOKENS.text }}
    >
      <div className="mx-auto h-[100dvh] w-[390px] max-w-full overflow-hidden">
        <div
          className="relative h-[100dvh] overflow-hidden"
          style={{
            background:
              "radial-gradient(120% 75% at 50% -10%, rgba(255,90,106,.05), rgba(0,0,0,0) 55%), " +
              `linear-gradient(180deg, ${TOKENS.bg0} 0%, ${TOKENS.bg1} 55%, ${TOKENS.bg0} 100%)`,
          }}
        >
          <FirelightField flicker={fireFlicker} />

          <div
            ref={headerRef}
            className="relative z-10 px-4 pt-7"
          >
            <StarRings />

            <div className="flex items-start justify-between">
              <div className="relative flex items-center gap-2">
                {room.live ? <LiveBadge /> : null}
                <div>
                  <div
                    className="text-base font-semibold"
                    style={{ color: TOKENS.text }}
                  >
                    {room.title}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: TOKENS.muted }}
                  >
                    {room.tagline}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <AdsToggle
                  on={adsOn}
                  onToggle={() => setAdsOn((v) => !v)}
                />
                <button
                  className="grid h-9 w-9 place-items-center transition hover:opacity-70"
                  aria-label="Share"
                  title="Share"
                >
                  <Share2
                    className="h-[18px] w-[18px]"
                    style={{ color: "rgba(255,255,255,.65)" }}
                  />
                </button>
                <button
                  className="grid h-9 w-9 place-items-center transition hover:opacity-70"
                  aria-label="Settings"
                  title="Settings"
                >
                  <Settings
                    className="h-[18px] w-[18px]"
                    style={{ color: "rgba(255,255,255,.65)" }}
                  />
                </button>
              </div>
            </div>

            <div
              className="mt-4 flex gap-2 rounded-full p-1 backdrop-blur-md"
              style={{
                border: `1px solid ${TOKENS.line}`,
                background: "rgba(0,0,0,.14)",
              }}
            >
              <SegTab
                active={tab === "circle"}
                onClick={() => setTab("circle")}
              >
                Circle
              </SegTab>
              <SegTab
                active={tab === "campers"}
                onClick={() => setTab("campers")}
              >
                Campers{" "}
                <span
                  style={{ color: "rgba(255,255,255,.55)" }}
                >
                  ({stage.length + listeners.length})
                </span>
              </SegTab>
            </div>
          </div>

          <div
            className="relative z-10 px-4 pt-5"
            style={{ height: contentH, overflow: "hidden" }}
          >
            {tab === "circle" ? (
              <div className="h-full flex flex-col items-center justify-start">
                <div className="w-full grid place-items-center">
                  <motion.div
                    className="grid place-items-center"
                    animate={{
                      scale: adsOn ? 1 : 1.075,
                      y: adsOn ? 0 : 14,
                    }}
                    transition={{
                      duration: 0.35,
                      ease: "easeOut",
                    }}
                  >
                    <CampfireCircle
                      people={stage}
                      maxVisible={9}
                      onMore={() => setSheetOpen(true)}
                      reactions={reactions}
                      flicker={fireFlicker}
                    />
                  </motion.div>
                </div>

                <div className="mt-4 w-full">
                  <motion.div
                    animate={{ y: adsOn ? -14 : 10 }}
                    transition={{
                      duration: 0.35,
                      ease: "easeOut",
                    }}
                    className="mt-4"
                    style={{ marginBottom: adCardSpace }}
                  >
                    <AroundTheFireRow
                      count={listeners.length}
                      people={listeners}
                      onOpen={openAudience}
                      hands={raisedHands}
                      adsOn={adsOn}
                    />
                  </motion.div>
                </div>
              </div>
            ) : (
              <div
                ref={campersScrollRef}
                className="h-full overflow-y-auto rounded-3xl p-4 backdrop-blur-md"
                style={{
                  border: `1px solid ${TOKENS.line}`,
                  background: "rgba(0,0,0,.20)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      className="text-xs"
                      style={{ color: TOKENS.muted }}
                    >
                      Everyone here
                    </div>
                    <div
                      className="mt-1 text-sm font-semibold"
                      style={{ color: TOKENS.text }}
                    >
                      {stage.length + listeners.length} campers
                    </div>
                  </div>
                  <button
                    onClick={() => setSheetOpen(true)}
                    className="rounded-full px-3 py-1 text-xs backdrop-blur-sm"
                    style={{
                      border: `1px solid ${TOKENS.line}`,
                      background: "rgba(0,0,0,.18)",
                      color: "rgba(255,255,255,.74)",
                    }}
                  >
                    Circle view
                  </button>
                </div>

                <ListGroup title="In the circle">
                  {[
                    ...hosts,
                    ...cohosts,
                    ...speakers.slice(0, 6),
                  ].map((p) => (
                    <CircleRow key={p.id} p={p} />
                  ))}
                  {speakers.length > 6 ? (
                    <button
                      onClick={() => setSheetOpen(true)}
                      className="w-full rounded-2xl px-3 py-2 text-left text-xs font-semibold backdrop-blur-sm"
                      style={{
                        border: `1px solid ${TOKENS.line}`,
                        background: "rgba(0,0,0,.14)",
                        color: "rgba(255,255,255,.82)",
                      }}
                    >
                      View all (+{speakers.length - 6})
                    </button>
                  ) : null}
                </ListGroup>

                <ListGroup title="Spark requests">
                  {raisedHands.length === 0 ? (
                    <div
                      className="rounded-2xl px-3 py-3 text-xs backdrop-blur-sm"
                      style={{
                        border: `1px solid ${TOKENS.line}`,
                        color: TOKENS.muted,
                        background: "rgba(0,0,0,.10)",
                      }}
                    >
                      No hands raised
                    </div>
                  ) : (
                    raisedHands.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-2xl px-3 py-2 backdrop-blur-sm relative"
                        style={{
                          border: `1px solid ${TOKENS.line}`,
                          background: "rgba(0,0,0,.14)",
                        }}
                      >
                        <HandRaiseSparks id={`hand-${p.id}`} />
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            name={p.name}
                            size={36}
                            speaking={false}
                            fireDistance={0.72}
                            depth={0.6}
                          />
                          <div className="min-w-0">
                            <div
                              className="truncate text-sm"
                              style={{ color: TOKENS.text }}
                            >
                              {p.name}
                            </div>
                            <div
                              className="text-xs"
                              style={{ color: TOKENS.muted }}
                            >
                              raised hand
                            </div>
                          </div>
                        </div>
                        <button
                          className="rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm"
                          style={{
                            border: `1px solid ${TOKENS.line}`,
                            background: "rgba(246,206,132,.07)",
                            color: "rgba(255,255,255,.86)",
                          }}
                        >
                          Invite
                        </button>
                      </div>
                    ))
                  )}
                </ListGroup>

                <div ref={audienceAnchorRef} />

                {listeners.length > 0 && <ListGroup title="Around the fire">
                  <div
                    className="rounded-2xl p-3 backdrop-blur-sm"
                    style={{
                      border: `1px solid ${TOKENS.line}`,
                      background: "rgba(0,0,0,.10)",
                    }}
                  >
                    <div className="grid grid-cols-4 gap-4">
                      {listeners.map((p) => (
                        <ListenerDot key={p.id} p={p} />
                      ))}
                    </div>
                  </div>
                </ListGroup>}
              </div>
            )}
          </div>

          <AdDock on={adsOn} above={currentDrawerH} />

          <ControlCenterDrawer
            open={controlsOpen}
            setOpen={setControlsOpen}
            muted={muted}
            setMuted={setMuted}
            handUp={handUp}
            setHandUp={setHandUp}
            onReact={pushReaction}
            onChat={() => console.log('Chat clicked')}
            onTip={() => console.log('Tip clicked')}
            onVisibleHeightChange={(h) => setDrawerVisibleH(h)}
          />

          <BottomSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
          >
            <div
              className="text-sm font-semibold"
              style={{ color: TOKENS.text }}
            >
              The Circle
            </div>
            <div
              className="mt-1 text-[11px]"
              style={{ color: TOKENS.muted }}
            >
              Hosts, co-hosts, and speakers
            </div>

            <ListGroup title="Hosts">
              {hosts.map((p) => (
                <CircleRow key={p.id} p={p} />
              ))}
            </ListGroup>

            <ListGroup title="Co-hosts">
              {cohosts.length ? (
                cohosts.map((p) => (
                  <CircleRow key={p.id} p={p} />
                ))
              ) : (
                <div
                  className="rounded-2xl px-3 py-3 text-xs backdrop-blur-sm"
                  style={{
                    border: `1px solid ${TOKENS.line}`,
                    color: TOKENS.muted,
                    background: "rgba(0,0,0,.10)",
                  }}
                >
                  None
                </div>
              )}
            </ListGroup>

            <ListGroup title="Speakers">
              {speakers.map((p) => (
                <CircleRow key={p.id} p={p} />
              ))}
            </ListGroup>
          </BottomSheet>
        </div>
      </div>
    </div>
  );
}

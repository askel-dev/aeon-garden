# Mobile QoL — how they do it, how we score

Pattern notes from the screenshots, checked against what Nobody's Meadow already does
(status: ✅ built, 🟡 partial or unverified, 🔲 not started). Pointers are real files in the
folders next to this one.

## 1. Thumb reach — controls live in the bottom corners

- **Hello Kitty** (`hello-kitty-island-adventure/phone-04.jpg`): joystick bottom-left, the one
  big action button bottom-right, nothing else below the middle third.
- **Don't Starve** (`dont-starve-pocket/phone-04.jpg`): hotbar across the bottom, pause in the
  bottom-right corner — on a phone even *pause* moved down from its desktop spot.
- **Animal Crossing** (`animal-crossing-pocket-camp/phone-03.jpg`): 4-slot tray along the
  bottom, everything else top chips you never need mid-action.

**Us:** satchel bottom-center, fire/make buttons beside it ✅. The pause pill sits top-right 🟡
— fine because it's rare, but on a tall phone that's a two-hand reach; if play tests show
anyone fumbling it, DS's answer is to put it bottom-right.

## 2. Targets you can actually hit

- Store screenshots show slots around 44–56 px; Wylde's card ✕ (`wylde-flowers/phone-03.jpg`)
  is a full-size seal, not a hairline cross.

**Us:** 44 px minimum and the round brass ✕ already follow the platform HIG ✅ — keep it as a
hard rule for any new chip or button.

## 3. Movement: tap the world, hold to run

- Every game here is tap/drag-to-move or a corner joystick — nobody needs a stick to walk.
  Stardew on phone is tap-anywhere with an optional floating pad; Don't Starve is tap plus drag.

**Us:** tap to walk, hold/drag to sprint ✅ — already the same language. An optional drag
joystick is *not* worth building; HKIA-style thumb pads exist because their action button
fights for the corner, and ours doesn't.

## 4. "You can't yet" must say why, and where

- **Wylde Flowers** (`wylde-flowers/phone-03.jpg`): the card doesn't just deny —
  "You'll need to build a Tools Table first," with a **Show me** button that takes you there.
- **Don't Starve** puts the label on the thing itself (`phone-04.jpg`: "Tier 2 Target" floats
  over the structure), never a system dialog.

**Us:** "Needs tinder and sticks" over the fire ✅ — exactly the right voice 🟡 — but it's
dead text. One step up: make the line tappable, walk the forager to the nearest stick
(the edge marker already finds it: `drawPickArrow`).

## 5. A quiet sense of what's next

- **Cozy Grove** (`cozy-grove-camp-spirit/phone-05.jpg`): onboarding shown as hearts *over the
  NPC's head* — the task lives on the character, not in a panel.
- **Hello Kitty**: a location chip beside the minimap ("Icy Peak") so you always know where
  you are without opening anything.
- **Stardew** (`stardew-valley/phone-05.jpg`): date/weather/season chips top-right — the
  answer to "what day is it, what season" in one glance.

**Us:** the edge marker ✅ and forager hints (`hintTick`) ✅ — better than most. Missing:
- 🟡 **What day/season is it?** — only announced in headlines. A tiny chip (day, season icon)
  in the top-left cluster with the portrait would answer the survival question at a glance.
- 🔲 **One current goal chip** ("make a fire before dark", "cook something") that fades when
  done — the stage-3 opening line already says it once; a small persistent chip carries it.

## 6. The HUD shrinks when nothing's wrong

- **Tsuki** (`tsukis-odyssey/phone-03.jpg`) ships *zero* UI while exploring — the extreme end.
- **Cozy Grove** keeps only small corner buttons plus what an NPC needs.
- Don't Starve keeps gauges always on — because you're always about to die; that's the genre,
  not the lesson.

**Us:** bars show only when not full ✅, cards close on walking away ✅ — keep this as the
default for every new gauge: *appears when it matters, leaves when it's fine*.

## 7. Cards behave like sheets, and Back always works

- Wylde's card has its ✕ in the corner of the card itself; Animal Crossing's dialogue is a
  bubble near the speaker, never a full-screen interrupt.

**Us:** bottom sheet on portrait, panel on landscape, folded to one line first, ✕ at the foot,
Back/`stepOut` closes ✅ — matches the best here.

## 8. Sessions, saving, and coming back

- Animal Crossing's whole design assumes 3-minute sessions: everything auto-saves, you close
  the app mid-thought.
- Don't Starve pauses instantly when you open its menu; switching apps shouldn't cost you the
  night.

**Us / to verify 🟡:**
- [ ] The sim **pauses (or slows) on `visibilitychange`** — coming back from a notification
      after 10 minutes shouldn't be a cold winter night you didn't see.
- [ ] The meadow is **written before suspension** — we keep it in the browser already
      (localStorage/`packWorld`), but confirm the save happens on hide, not only on unload
      (iOS kills tabs without `beforeunload`).
- [ ] Offline open (sw.js cache-first ✅) still lands you exactly where you were — already the
      design; worth one test per release.

## 9. Performance and battery on a phone

- Games with sense ship a **battery/quality toggle** rather than guessing for you
  (Minecraft's battery saver, Don't Starve's frame cap on phones).

**Us:** the `plans/mobile-heat/` work is exactly this — FPS cap, DPR cap, quality governor,
battery API, wake lock, calm mode ✅ (finished/partial per those notes). Suggested QoL on top:
one visible **"Calm mode"** line in ••• so the player can choose lower drain themselves, the
way Minecraft does.

## 10. Safe areas, notches, and the Dynamic Island

- Every screenshot set here lays chrome *inside* the safe area — no icon touches a notch.

**Us:** 🟡 verify `viewport-fit=cover` + `env(safe-area-inset-*)` on the toast, announce
headlines, portrait and the pause pill; our own phone screenshots show the island sitting
right where the toast lives. Check on a notched iPhone and a tall Android.

## 11. Sound on a phone

- All of these stay silent until the first tap (browser/OS rule) and respect the mute switch.

**Us:** sound off until 🔊/M ✅ — which conveniently *is* the audio-unlock rule. Keep it.

## 12. Small stuff

- **Text:** Cozy Grove uses one friendly sans at generous size; we use Nunito for UI and
  Fraunces italics for thoughts ✅. Verify the smallest label (satchel counts) stays ≥ 12–13 px
  at 390 pt width.
- **Haptics:** a light tick on gather/cook/fire — Android `navigator.vibrate` only (iPhone web
  can't; PLAN stage 5 already notes this) 🟡.
- **Never a modal over gameplay:** if something must interrupt, it's a toast line or a chip.
  The promo banner in `stardew-valley/phone-05.jpg` and the card pile in
  `forager/phone-03.jpg` are what that looks like when overdone.

## If we only do five things

1. **Verify safe areas + save-on-hide** on a real notched iPhone (items 8, 10) — invisible
   until they bite a player.
2. **Make "Needs tinder and sticks" tappable** → walks you to the nearest stick (item 4;
   Wylde's Show me). Smallest change, biggest daily-use win.
3. **A tiny day/season chip** by the portrait (item 5) — one glance answers "how long until
   night/winter".
4. **One current-goal chip** that disappears when the goal is met (item 5; Cozy Grove's
   hearts-over-the-NPC).
5. **Keep the rule already written** — HUD only appears when it matters, center stays empty
   (items 6, and `visuals.md` §7). The screenshots show how quickly a game stops looking
   cozy once this breaks.

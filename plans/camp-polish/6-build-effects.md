# 6. Camp builds change what the forager does

Wait for prompts 4 and 5. Read `.claude/docs/fire-camp.md`, `cooking.md`, `tasks-stone-friends.md`, PLAN.md stage 8.

Today the builds are scenery plus a rule (rack = store, lean = shelter). Make cooking and living at camp feel
different with each, as small, readable bonuses (Axel retunes the numbers, so keep them data in recipes.js):

1. **Seat log:** sitting on it to eat recovers more tummy comfort / warmth (already gives the "ate sitting" deed); the
   forager walks to it and sits when it eats at camp (a tap on the dish menu offers "Sit and eat").
2. **Rack:** a dish cooked at a fire with a rack nearby stays hot / fresher longer when set on it ("Put on the rack"
   in the held-dish menu), or lets you hang herbs and mushrooms there while you cook (decide the simplest fun one).
3. **Lean-to:** cooking under it in the rain is allowed (the fire's rain penalty and "the pot waits" messages
   don't apply within its shelter), and fire-blowing in rain gets easier by the covered amount.
4. **Cosy and level gates** (stage 8's DEEDS/CAMP_LEVELS) count each use once, with an honest hover line of what
   each build is doing right now ("Keeps your soup warm").
5. Do not duplicate the effects across the sim and the UI: the sim decides, the UI shows.

Done = each effect shown in a headless sim test (a number moves as expected) and in screenshots of the UI text, and
the sim round-trip and a few seeds of years still pass.

# Getting players back, and getting seen

2026-10-12. Research only, nothing built. It follows on from `retention-and-reach.md`, which covered
Rusty's Retirement, Neko Atsume, Sandspiel and Orb.farm. This one checks three ideas:

1. Make the away card the reward of each visit.
2. Post to Hacker News as Show HN more than once ("Orb.farm got 17 points first, 783 three years later").
3. Pitch `?keep` as "keep this ecosystem alive".

Facts carry a source. Lines marked *(inference)* are my reading of them.

---

## 0. The three ideas, checked

- **Orb.farm, corrected.** The numbers are right; the story isn't quite. Orb.farm was posted 10 times, never by
  Bittker and never as a Show HN. In May 2020 four posts got 2 to 17 points (best: 17, by todsacerdoti, [item
  23218186](https://news.ycombinator.com/item?id=23218186)). Three more in late 2020 got 1 to 3. In May 2022 it got
  17 again. Then on 2023-05-19 a prolific submitter posted it as plain "Orb Farm": **783 points, 101 comments**
  ([item 35999835](https://news.ycombinator.com/item?id=35999835)). So it was nine flops over three years, then a
  hit, all posted by strangers. It shows that HN is a lottery. It isn't a recipe for an author's own reposts.
  Better evidence for those is in section 2.
- **The away card** is already the game's Neko Atsume moment. It gives the same small reward for 5 minutes away as
  for 3 weeks, it is all text, and at `?keep` the Dry Year can be lost while you're away (section 1).
- **"Keep this ecosystem alive"** is a good second line. It shouldn't be the headline (section 3).

---

## 1. The away card as the reward of each visit

### What it does today (game.js `startAway` … `awayDone`)

- It comes after 5 minutes away (`AWAY_MIN`), if the meadow wasn't paused.
- **The meadow always runs on exactly one season** (`AWAY_TICKS`), however long you were gone. That is 100 s at 1×.
- The card is text: "🌸 Spring turned to summer.", the born and gone counts, and then 3 to 5 news lines, yours first
  and then the `AWAY_BIG` list.
- At `?keep` the Dry Year comes in the summer of year 2 (`DRY_YEAR`), about 8 minutes in at 1×, and lasts one
  season. `dryloss` is on the `AWAY_BIG` list. Close the tab in late spring of year 2, come back after 5 minutes,
  and the whole Dry Year has been played without you. The away card is where you learn you lost.
- Nothing measures returns. GoatCounter counts every load as `/meadow`.
- The game never calls `navigator.storage.persist()`.

### What other games do

- **Make the return a celebration, and let a longer absence pay more.** Pecorella (Kongregate, AdVenture
  Capitalist) says a check-in "creates a celebratory moment every time that you return", and that the longer you're
  away, the more reason to come back
  ([Game Developer](https://www.gamedeveloper.com/design/the-rise-of-games-you-mostly-don-t-play)). Idle games cap
  offline time, Melvor at 18 to 24 h.
- **Open on what happened, before any menu or prompt.** One idle-design guide says a pop-up first "turns a routine
  check-in into pressure" ([mergeciv](https://mergeciv.io/idle-progression)).
- **Neko Atsume:** you come back to find who visited, what they played with and the gifts they left. The Catbook
  keeps every visitor and counts visits. Each cat leaves a memento, rarely; some come after a few visits, some after
  dozens ([Wikipedia](https://en.wikipedia.org/wiki/Neko_Atsume),
  [nippon.com](https://www.nippon.com/en/nipponblog/m00083/)).
- **Pokémon Sleep** gives one morning result and fills a dex of sleep styles. It deliberately rewards a rhythm, not
  a schedule ([Pokémon Co.](https://corporate.pokemon.co.jp/en/topics/detail/t-9/)).
- **Pokémon GO's buddy souvenirs** do nothing in play. They are keepsakes of time spent with one animal.
- **Peak-end rule:** people remember an experience by its strongest moment and its ending, not by how long it lasted.
  **Picture superiority:** pictures are remembered far better than words (Standing 1973,
  [CMU](https://www.cmu.edu/dietrich/psychology/memorylab/publications/10.1.1.646.3474.pdf)).
- **Surprise fades when it's expected.** Dopamine responds to a reward better than expected, and less as it becomes
  predictable ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC3866681)). A card that is always big stops feeling big.
- **Don't punish absence.** Duolingo, the strongest streak app there is, raised retention by adding slack (Streak
  Freezes) ([Duolingo](https://blog.duolingo.com/improving-the-streak)). Bandai reportedly added a pause button to
  the Tamagotchi after complaints. Cozy players come for a safe place; 57% say cozy games ease stress
  ([Sago](https://sago.com/en/insights/the-rise-of-cozy-gaming-across-borders/)).
- **Wordle** was once a day and leaves you "wanting more", with no notifications. It grew only once the spoiler-free
  share grid arrived ([Boston.com](https://www.boston.com/news/national-news/2022/01/04/he-made-wordle-for-his-partner-now-its-an-online-hit/)).
- **Benchmarks:** mobile median D1 retention is about 22% and D7 about 4%; the top 10% reach about 40% and 12%
  ([GameAnalytics via gamedevreports](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks)).
  I found no published Poki or CrazyGames figures.

### The web's own problem: the save can vanish

- Safari deletes a site's IndexedDB and localStorage after **7 days of Safari use without a visit to that site**.
  Home Screen web apps keep their own count
  ([The Register](https://www.theregister.com/2020/03/26/apple_relax_were_not_totally/)).
- WebKit spares origins in persistent mode. `navigator.storage.persist()` asks for it, and WebKit grants it by
  heuristics, such as being opened as a Home Screen app
  ([WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/)). One report says it returned false in Safari 17.
- *(inference)* So an iPhone player who stays away more than a week may come back to a new meadow and no away card.
  That's the very player the card is for. It needs testing on a real phone.
- On iOS, web push works only for Home Screen web apps, and only after a tap
  ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). Vendors report opt-in at 2 to
  8%. Not worth it here.

### What I'd change, best first *(inference)*

1. **Never play the Dry Year offscreen.** **Built 2026-10-12** (game.js `awayTicks`). Catching up stops at the
   start of the Dry Year's spring, when the flood fails, and the card ends "Then it stopped to wait for you: the Dry
   Year is coming." Back during the Dry Year (its spring, its summer, or the `DRY_AFTER` days after), the meadow
   doesn't run on at all, and the news says "⏸️ The meadow waited for you". Tested on seed 123.
2. **Lead with one headline, then the rest.** The biggest or rarest thing first, ideally about one of yours ("Bramble
   raised four kits under the hawthorn"). Fold the counts below it, and end on something alive with a link to follow
   it. Most visits get a small headline, a few a big one.
3. **Give it a picture.** When the headline event happens, keep a small still of that spot, a few hundred pixels,
   captured once and not per frame. That's the Neko Atsume moment: you see it happened.
4. **Let a long absence give a richer card, never a worse meadow.** For example, 5 min to an hour runs a season and
   a day or more runs up to a year, still stopping before the Dry Year. Catching up a year is 4× the work, so time it.
   (Melvor caps; so should this.)
5. **Protect the save.** Call `navigator.storage.persist()` after the first away card, then offer Add to Home Screen
   after a good card. That's the moment people are glad to keep it, and on iOS it also keeps the save. The install
   prompt is already caught (`beforeinstallprompt`, `showHomeItem`).
6. **Count returns.** **Built 2026-10-12** (game.js `countEvent('meadow-back')`, when the away card opens). A GoatCounter event (`goatcounter.count({ path: 'meadow-back', event: true })`) when the away
   card opens. Then "do people come back?" has a number, before and after any of the above. It costs nothing and
   needs no cookies.
7. Later: something to keep from each visit (a journal page or a keepsake per named animal, Neko Atsume's mementos),
   and a small spoiler-free share line ("Spring in my meadow: 14 kits, the old oak fell"), Wordle's way.

---

## 2. Hacker News: posting more than once

### The rules as of October 2026 (checked today)

- **Show HN:** it must be your own work, something people can try (no signup), and you must be around to answer.
  "Please don't ask friends to upvote or comment." ([showhn](https://news.ycombinator.com/showhn.html))
- **Reposts:** "a small number of reposts is ok" if the story got no real attention. Don't delete and repost.
  ([FAQ](https://news.ycombinator.com/newsfaq.html))
- **New: no generated text.** The guidelines now say "Please don't put generated text in HN posts. Write your text
  yourself", and for comments "Don't post generated text or AI-edited text"
  ([guidelines](https://news.ycombinator.com/newsguidelines.html)). **So the post, the first comment and the replies
  have to be Axel's own words.** I can gather facts for it, but I shouldn't write or polish it.
- **New: Show HN is restricted.** HN is "temporarily restricting Show HNs because of a massive influx, mostly by
  users who aren't yet familiar with the site or its culture". The way in is to "become a good contributor"
  ([showlim](https://news.ycombinator.com/showlim)). dang said on 2026-10-02 that this hits new accounts. **An HN
  account with some real commenting history is needed first.**
- **Second chances:** moderators pick overlooked posts and put them back, low on the front page. You can nominate a
  post by email to hn@ycombinator.com, and "it's fine if it's your own article"
  ([dang](https://news.ycombinator.com/item?id=26998308)). As of a March 2026 edit to his tips, though, they "can't
  respond to emails about this any more". So send one and don't count on it.
- **dang's launch tips** ([item 22336638](https://news.ycombinator.com/item?id=22336638)): tell the backstory and
  what's different in the post text or the first comment, with no marketing language. Post from a person's account,
  not the project's. A real new version can be posted again "once or twice a year", linking the old one.

### Reposting that worked (the author, days apart, a plainer title)

| First try | Points | Second try | Points |
|---|---|---|---|
| "Created this simple game to kill my boredom in quarantine" (2020) | 2 | "Show HN: Looptap – A minimal game to waste your time" (2022) | **1241** |
| "Show HN: Interactive intro to 4 color theorem, P vs NP, zero knowledge" | 2 | two days later: "Show HN: I made a puzzle game that gently introduces my favorite math mysteries" | **1054** |
| "Show HN: Lend Me Your Ears – A Simon-style ear training game with MIDI" (2026-01-07) | 2 | two days later: "Show HN: I made a memory game to teach you to play piano by ear" | **565** |

- Sandspiel didn't flop: it got 1323 the first time. Its write-up "Making Sandspiel" was a second launch, with 160
  points in 2019 and 74 in 2023. It was an article, not a Show HN, so the dupe rule didn't touch it.
- **Odds:** of 46,784 Show HNs in the last 12 months, 8.1% reached 10 points, 1.6% reached 100 and 0.37% reached 300
  (the research agent's own count from the Algolia API). The day barely matters. The hour does: **noon to 2pm US
  Eastern** reached 100+ at 2.4%, against under 1% late at night.
- **Comparable posts:** WebGL rainy autumn day (393), "I made a pretty relaxing puzzle game" (633), virtual pet for a
  daughter (256), "A sealed garden watered once in 53 years" (412).

### What the Orb Farm thread wanted

From the 783-point thread:
- About 12 comments called it calm, mesmerizing or addictive.
- About 8 swapped tactics for keeping the orb alive.
- About 8 complained that it collapsed without them knowing why ("One of my fish died and I don't know why").
- About 5 asked for a goal, such as "days in the green", and others pushed back that a sandbox needs none.
- People also complained about a laptop fan and, for one, a black screen.
- On Lobsters, Orb.Farm got 104 points, and people asked for a time slider
  ([lobste.rs](https://lobste.rs/s/8d3bfo/orb_farm_virtual_aquatic_ecosystem)).

### A plan *(inference)*

1. Start commenting on HN now, from Axel's own account. The Show HN restriction makes this step one.
2. Get ready before posting: no console errors, a phone works, a weak laptop doesn't roar, and losses can be
   explained (Orb Farm's biggest complaint).
3. Post "Show HN: I made …" in plain words about what it is, between noon and 2pm Eastern. Write a first comment by
   hand: the backstory (from the AEON lab), how it's built (2000 ticks a frame, painted animals with no sprite files,
   trees painted in code), and that it runs while you're away.
4. If it gets under ~10 points, try once more within days with a different, warmer title (the three pairs above),
   or email hn@ for the second-chance pool.
5. Months later, post the making-of write-up on its own as an article, Sandspiel's way. After that, a Show HN of a
   real new version, linking the first.
6. Post to Lobsters (`show`, `games`) too, if Axel can get an invite. Orb.Farm did 104 there.

Tag every posted link with `?ref=hn` (or `lobsters`, `reddit`) so GoatCounter tells them apart.

---

## 3. Pitching `?keep` as "keep this ecosystem alive"

- **What spread was a feeling or a format, not stakes.**
  - HN titles were bare names ("Orb Farm", "Sandspiel – A falling sand game built in Rust and WebGL").
  - Press led with a feeling or the format. On Orb.farm: "so relaxing" (Destructoid), "Play this fun web-based
    biosphere simulator" (Boing Boing), and "watch it evolve even when you're not there" (Genbeta). On Townscaper,
    "The most pleasant game of 2021 is now playable in your browser" (PC Gamer).
  - Terra Nil got "reverse city builder", and Rusty's Retirement "sits at the bottom of your screen".
  - I found no case of a survival hook spreading, and no evidence either way that stakes beat ambience.
- **But the stakes engaged people when they found them.** Orb Farm's commenters made "keep it alive" their own game
  unasked, and asked for a "days in the green" count. `?keep`'s Dry Year and its GREEN number answer that wish.
- *(inference)* **Feeling and format first, stakes second.** For example: "A painted meadow that lives in your
  browser, even while you're away. A Dry Year is coming: can you keep everyone alive?" The first half is what gets
  shared; the second is what gets played.
- **The stakes need to feel fair.** People forgive a collapse they understand. The `#lost` card's one line of why
  helps; the Dry Year happening offscreen (section 1) doesn't.
- **The page's own words still describe the old game.**
  - `index.html`'s description and `og:description` are all ambience ("whether you're watching or not"), but `?keep`
    is now the default.
  - `assets/itch/README.md` still sells right-click "play god" (releasing animals, lightning), and `?keep` hides those.
  - The OG image is the pocket-watch logo. *(inference)* A still of the meadow itself, with an animal large in frame,
    may get more clicks.

---

## 4. Other places, by likely payoff *(inference, from the sources found)*

1. **HN plus Lobsters:** the audience Orb.farm and Sandspiel found.
2. **Short vertical clips of one named animal's life** (born, chased by a fox, through the Dry Year) on TikTok,
   Shorts and Bluesky, posted again and again. The Hive got 10k wishlists in 10 days from small accounts this way,
   and the clips that worked showed the fantasy at once
   ([devlog](https://skydome.itch.io/thehive/devlog/1164902/10000-wishlists-in-10-days-what-changed-for-the-hive)).
   Hook in the first second, 15 to 40 s long.
3. **Reddit: r/CozyGamers and r/IndieGaming,** a GIF with a personal title, US morning. Reddit blocked the research
   fetches, so read each sidebar's rules first. r/WebGames is small (one dev got 3,000 views and one comment). Skip
   r/incremental_games: this isn't an idle game.
4. **Pitch emails with a GIF** to the outlets that covered Orb.farm and Townscaper's browser version: Boing Boing,
   Destructoid, PC Gamer, Genbeta.
5. **The long tail:** an itch.io page (tags ecosystem, cozy, simulation), Warp Door, and Samuel Arbesman's
   Microcosm Industries list of simulation toys ([substack](https://arbesman.substack.com/p/microcosm-industries)).

**What to have ready:**
- A 15 to 20 s loop that opens mid-action (a fox after a rabbit in the painted grass), with the first frame
  readable small.
- A thumbnail with one big animal and plenty of green.
- The stakes line in `og:description`.
- `?seed=` share links ("my meadow came through the Dry Year").

---

## 5. Suggested order

Code, each to be discussed first:
1. ~~Don't play the Dry Year offscreen.~~ Built.
2. ~~Count returns with a GoatCounter event.~~ Built. It shows in GoatCounter as the event `meadow-back`.
3. Call `persist()`, and offer Add to Home Screen after a good card.
4. Give the away card a headline, a picture, and a reward that grows with the time away.

Words and assets (no code risk):
5. Update `og:description` and `assets/itch/README.md` for `?keep`.
6. Make a short clip, and try a meadow still as the OG image.

Axel's own:
7. Build up HN standing.
8. Write the Show HN post and first comment by hand.
9. Post at noon to 2pm Eastern, and repost once with a new title if it sinks.

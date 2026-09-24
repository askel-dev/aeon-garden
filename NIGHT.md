# Night list

Night: 2026-09-23

<!--
Write this before bed. Put tonight's date on the "Night:" line above; that line is what switches
the night shift on. No date for tonight = nothing runs.

Most interesting first. One item per "##". A line or two is enough; say what "done" looks like
if it isn't obvious. Add "(think only)" to an item to get a written proposal instead of code.

Before bed: commit your work. The night branch starts from main's last commit.
-->

## 1.
Lets expand on the behaviour of bees. 
## 2.
Audio overhaul, for example slow generative music layer on top, for example wind-chime notes that get busier as the rabbit population grows?
## 3.
Seasonal water: w.level rises in spring and sinks in late summer (refreshWater already
supports it). Shallow edges dry out into fords animals can cross, ponds can split in two
in a dry year. News feed reports it ("The Long Pond is shrinking"). Done = visible over a
year in the game, balance.js still boom-and-bust.

## 4.
A small coat-colour chart in the corner: share of each of the four rabbit coats over the
years, so you can watch camouflage selection happen. Drawing only (game.js), no sim changes.
Done = the chart updates live and you can see a coat win or lose over a few years.

## 5.
Bees defend the hive: a fox that comes within ~3 tiles of a hive while bees are out gets
frightened and runs off (report idea "Bees vs foxes"). A news line when it happens. Done =
visible in the game, foxes still boom-and-bust in balance.js.

## 6.
Audio: a low fox note next to the rabbit chime, busier as the foxes grow (report pick), so
you hear rabbits and foxes as two lines taking turns. Same scale, one voice per species.
Add a "Foxes" slider in sound-lab.html.

## 7.
Bees swarm: a crowded hive with lots of honey in late spring sends half its bees off to start
a new hive in another dead tree. Keep it simple: cap the number of hives by w.room, pick a
tree not too close to other hives, a news line when a swarm leaves. Done = more hives appear
over a few years in balance.js and bees don't explode.
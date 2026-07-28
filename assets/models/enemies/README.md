# Enemy models

Put the skitter creature GLB in this folder using this exact filename:

`skitter_creature.glb`

Full repository path:

`assets/models/enemies/skitter_creature.glb`

After the file is uploaded, refresh the game. The enemy loader will automatically:

- load the model and all embedded animation clips
- print the animation names to the browser console
- try to identify idle, movement, attack, hit and death clips by name
- fall back to animation order 1–5 when names are unclear
- resize the model to a small hallway creature
- spawn it toward the dark right-hand end of the extended corridor
- keep it behind the apartment entrance boundary

The first-pass expected fallback animation order is:

1. Idle
2. Walk, run, crawl or skitter
3. Attack or lunge
4. Hit or hurt
5. Death

If the model faces backward or the fallback order is wrong, the loader constants can be adjusted after checking the animation names in the console.

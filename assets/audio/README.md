# Audio

Keep audio split by purpose:

- `music/` — soundtrack and story score
- `narration/` — spoken internal thoughts and voice-over
- `sfx/` — short world, interaction and interface sounds

For the opening sequence, place the soundtrack at:

`assets/audio/music/wake_sequence.ogg`

OGG is preferred for the game build. MP3 is fine for temporary testing.

The playback and mixer code will live separately under `src/audio/`.

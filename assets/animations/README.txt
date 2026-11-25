Put the Mixamo animation files here, with these exact names:
  Walking.fbx
  Idle.fbx
  Waving.fbx
Download them as FBX, "Without Skin", 30 fps (see PHASE1-NOTES.md).

What the film downloads: clips.bin (about 300 KB, 185 KB compressed), all eleven clips in one
small binary file. It is made from clips.json (the same clips baked from these FBX files and
fitted to the character; 2.4 MB, kept as the source, never downloaded) by:
  node assets/animations/make-clips.mjs
Run that again whenever clips.json changes. The FBX files are only read by the style frames.

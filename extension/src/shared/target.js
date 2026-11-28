// Which browser this build is for, and what it can do there. The files of the extension are the same for every browser; this one is not: tools/build.mjs writes
// another version of it into the build of Firefox and of Safari (the copy committed here is the one for Chrome, Edge and Brave).
//   kev:  the local model Kev-0.6B can be downloaded and run. Off in Safari: it has not been tried on an iPhone, where a process that grows by a few hundred
//         megabytes may be ended by the system, and a model that is half downloaded is a poor first experience.
//   nano: the browser may have Chrome's own model (Gemini Nano). Only Google Chrome has; the setup checklist is shown only where this is true.
export const TARGET = Object.freeze({ name: 'chrome', kev: true, nano: true });

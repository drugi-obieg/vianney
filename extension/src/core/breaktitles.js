// The words of the break reminder when it is drawn as a video: satirised clickbait titles, and the short captions that go on its thumbnail.
//
// Everything here is a CHOICE of the writer (nothing is measured): the owner asked for "random-ish titles like 'You wouldn't BELIEVE what happens if
// you take a BREAK NOW!', basically satirized clickbait titles". The rules that the titles follow (and tests/breaktitles.test.js checks):
//   - at most 100 characters once {time} is filled in (YouTube's own limit for a video title);
//   - ALL-CAPS words, "!" and brackets, as real clickbait has them;
//   - wholesome and funny, no swearing, nothing about the faith or about saints (the joke is clickbait itself), no insult to the viewer.
// {time} stands for how long the user has been watching ("1 hour 7 minutes"); it is filled in once, when the title is picked.

import { formatDuration } from './breaktimer.js';

export const TITLES = Object.freeze([
  "You wouldn't BELIEVE what happens if you take a BREAK NOW!",
  '{time} of videos?! Doctors HATE this one trick: standing up',
  'I stopped watching for 10 minutes and the results are SHOCKING',
  "The algorithm doesn't want you to know you can just STOP",
  'We asked your chair if you should get up. Its answer is SHOCKING',
  'Local man stands up after {time}, internet is STUNNED',
  'Nobody is talking about this: the sky is STILL THERE',
  'This ONE glass of water will CHANGE your afternoon (not clickbait)',
  'I left my screen for 5 minutes. What I found in the KITCHEN is INCREDIBLE',
  "{time} in, and you STILL won't believe what's next: a STRETCH",
  '10 reasons to look out of the window (number 7 will SURPRISE you)',
  'Your eyes have a SECRET message for you (it says BLINK)',
  'Is your sofa trying to tell you something? (YES: it says STAND UP)',
  'I tried walking to the next room. You will NOT believe what happened!',
  'SHOCKING: there is water in the kitchen, and it is FREE',
  'What your knees WISH you knew after {time} of sitting',
  'Scientists baffled: person takes a break and comes back REFRESHED',
  'Man discovers a WINDOW in his house! (You won\'t believe what is outside)',
  'Click here to NOT click anything for 5 minutes (it WORKS)',
  'I asked 100 people if you should take a break. The answer: YES (all 100!)',
  'Top 5 things you can do right now that are NOT this video (#1 is a WALK)',
  'EXPOSED: your tea has been getting cold for {time}',
  'Breaking news: the carpet is STILL there! Go and check (LIVE)',
  "How to watch 100% LESS video in 5 minutes (it's EASY)",
  'Your neck would like a word with you (it is a LONG one)',
  'The tutorial you never asked for: how to take a WALK (full guide)',
  'NASA hates this: going outside makes the day BIGGER',
  'TOP SECRET: the pause button is ALSO a break button',
  "Don't tell the algorithm, but a NAP is allowed (watch till the end)",
  "I've been watching for {time} and what happened next was a SANDWICH",
  'Your plants are watching you watch videos (they have OPINIONS)',
  'Day 1 of asking you to stand up. Will it work?! (SEE RESULTS)',
  'This video has 0 views and ONE piece of advice: DRINK WATER',
  "Breaking: it's STILL the same room. Let's go to a DIFFERENT one!",
  'How I escaped the sofa in 3 seconds (the ENDING is a door)',
  'RATED #1 by your spine: sitting up STRAIGHT for 3 whole seconds',
  'Experts agree: tea tastes BETTER when you drink it before it is cold',
  'The BIGGEST plot twist of the day: you stand up and stretch!',
  'Watch what happens when I do NOTHING for 3 minutes (shocking results)',
  'SNACK challenge gone RIGHT (nobody expected this ending)',
  'I tested 7 chairs so you do not have to. Every one said: STAND UP!',
  'After {time} of videos, THIS is what your ankles want to say (gentle)',
  'The WORLD record for looking at the horizon is waiting for you (easy)',
]);

// Short words for the picture of the video: big, in capitals, as on a clickbait thumbnail. They are kept short because they are drawn large.
export const CAPTIONS = Object.freeze([
  'BREAK?!', 'STAND UP!', 'WAIT...', 'GO OUTSIDE', 'WATER?!', 'NO WAY!', 'STRETCH!', 'SHOCKING', 'LOOK UP!', 'REALLY?!', 'SNACK TIME', 'BLINK!',
]);

const pick = (list, rand) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

/** One title, with {time} replaced by the watched time in words. @param {() => number} rand a function that gives a number in [0, 1) */
export function pickTitle(rand, seconds) {
  return pick(TITLES, rand).replace(/\{time\}/g, formatDuration(seconds));
}

/** One caption for the thumbnail. */
export function pickCaption(rand) {
  return pick(CAPTIONS, rand);
}

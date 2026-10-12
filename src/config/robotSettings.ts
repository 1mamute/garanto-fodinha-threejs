import { hotSettings, settingsChanged } from './hotSettings';

/** Proporções do robô em unidades da cena; alturas derivadas mantêm olhos e postura alinhados. */
export const ROBOT_DIMENSIONS = hotSettings(import.meta.hot, 'ROBOT_DIMENSIONS', {
  torsoHeight: 1.555,
  torsoLength: 1.15,
  headHeight: 2.23,
  shoulderHeight: 2.2,
  eyeOffset: 0.41,
  eyeForward: 0.56,
  thighLength: 0.52,
  seatedHipHeight: 0.9,
  get eyeHeight(): number {
    return this.headHeight + this.eyeOffset + this.thighLength;
  },
  get standingOffset(): number {
    return this.thighLength;
  },
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('robotSettings');
  });

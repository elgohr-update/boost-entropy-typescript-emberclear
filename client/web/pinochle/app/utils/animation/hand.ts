import { assert } from '@ember/debug';

import { circleFromThreePoints } from 'pinochle/utils/trig';
import { radiansToDegrees } from 'pinochle/utils/trig';

type ToggleOptions = {
  parentElement: HTMLElement;
  isOpen: boolean;
  animations: WeakMap<HTMLElement, CardAnimation>;
};

const SMALL_SCREEN = 1000;

export function toggleHand({ parentElement, isOpen, animations }: ToggleOptions) {
  let cards = parentElement.querySelectorAll('.playing-card');
  let points = getPoints(cards.length);

  let stackedFrames = stackedKeyframes(points);
  let fannedFrames = fannedKeyframes(points);
  let flatFrames = flatKeyframes(points);

  let isSmallScreen = points.path.viewportWidth < SMALL_SCREEN;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const stackFrame = stackedFrames[i];
    const fanFrame = fannedFrames[i];
    const flatFrame = flatFrames[i];

    assert(`expected to be an html element`, card instanceof HTMLElement);

    let existing = animations.get(card);

    if (!existing) {
      animations.set(card, new CardAnimation(card, stackFrame));

      existing = animations.get(card);
    }

    assert(`something went wrong creating the animation for card ${i}`, existing);

    if (existing.isAnimating) {
      existing.reverse();
      continue;
    }

    if (isOpen) {
      if (isSmallScreen) {
        existing.push(flatFrame);
      } else {
        existing.push(fanFrame);
      }
    } else {
      existing.push(stackFrame);
    }

    existing.animate({
      duration: 500,
      iterations: 1,
      fill: 'both',
      delay: i * 7,
    });
  }
}

export function adjustHand({ parentElement, isOpen, animations }: ToggleOptions) {
  let cards = parentElement.querySelectorAll('.playing-card');
  let points = getPoints(cards.length);

  let frames;

  if (!isOpen) {
    frames = stackedKeyframes(points);
  } else if (points.path.viewportWidth < SMALL_SCREEN) {
    frames = flatKeyframes(points);
  } else {
    frames = fannedKeyframes(points);
  }

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const frame = frames[i];

    assert(`expected to be an html element`, card instanceof HTMLElement);

    const existing = animations.get(card);

    if (!existing) {
      continue;
    }

    existing.adjust(frame, {
      duration: 500,
      iterations: 1,
      fill: 'both',
    });
  }
}

function stackedKeyframes({ path, positions }: ReturnType<typeof getPoints>) {
  return positions.map((_position, i) => {
    return {
      transform: `translate3d(${0 - 0.5 * i}%, ${0 - 0.5 * i}%, 0)`,
      transformOrigin: `50% ${path.y}px`,
    };
  });
}

function fannedKeyframes({ path, positions }: ReturnType<typeof getPoints>) {
  let { viewportWidth } = path;
  let numCards = positions.length;
  let widthOfCard = viewportWidth / numCards;

  return positions.map((position, i) => {
    return {
      transform: `
        rotate(${radiansToDegrees(position.rad)}deg)
        translate3d(calc(${0 - 0.5 * i}% - ${widthOfCard}px), ${0 - 0.5 * i}%, 0)
      `,
      transformOrigin: `50% ${path.y / 2}px`,
    };
  });
}

function flatKeyframes({ path, positions }: ReturnType<typeof getPoints>) {
  let { viewportWidth } = path;
  let numCards = positions.length;
  let widthOfCard = viewportWidth / numCards;

  return positions.map((_position, i) => {
    return {
      transform: `
        rotate(0deg)
        translate3d(${
          ((viewportWidth * 0.8) / numCards) * (i - numCards / 2) + widthOfCard
        }px, 0, 0)
      `,
      transformOrigin: `50% ${path.y / 2}px`,
    };
  });
}

/**
 * This is a two-element queue
 *
 */
export class CardAnimation {
  declare current: Keyframe;
  declare next: Keyframe;
  declare animation?: Animation;
  declare element: HTMLElement;

  constructor(element: HTMLElement, current: Keyframe) {
    this.element = element;
    this.next = current;
  }

  push(next: Keyframe) {
    this.current = this.next;
    this.next = next;
  }

  reverse() {
    if (!this.animation) return;

    this.animation.pause();
    this.animation.reverse();
    this.animation.play();

    // the current and next frames need to be swapped
    let current = this.next;

    this.next = this.current;
    this.current = current;
  }

  animate(options: KeyframeAnimationOptions) {
    this.animation = this.element.animate([this.current, this.next], options);

    this.animation.onfinish = () => (this.animation = undefined);

    return this.animation;
  }

  adjust(adjustment: Keyframe, options: KeyframeAnimationOptions) {
    this.push(adjustment);

    return this.animate(options);
  }

  get isAnimating() {
    return Boolean(this.animation);
  }
}

/**
 *
 * Returns points along the arc of a circle clipped by the viewport where
 * the outside points have a reasonable amount of padding from the window
 * edge
 *
 * The circle is initally defined by 3 points:
 *  - midpoint along X + some percent height for Y / top of the circle
 *  - bottom-left corner
 *  - bottom-right corner
 *
 * NOTES:
 *   rad = Math.atan2(y - cy, x - cx)
 *
 *   when a is radians:
 *     x = cx + r * cos(a)
 *     y = cy + r * sin(a)
 *
 * It's been a long while since I've done trig. :D
 */
export function getPoints(num: number) {
  let viewportWidth = window.innerWidth;
  let left = 0;
  let right = viewportWidth;
  let bottom = window.innerHeight;

  let { x: circleX, y: circleY, r: circleRadius } = circleFromThreePoints(
    { x: left, y: bottom * 0.8 },
    { x: viewportWidth * 0.6, y: bottom * 0.7 },
    { x: right, y: bottom + 0.8 }
  );

  // given the bottom of the window as an "ok" Y, find the two X values for the circle at that Y
  let leftAngle = Math.atan2(bottom - circleY, left - circleX);
  let rightAngle = Math.atan2(bottom - circleY, right - circleX);

  // divide the angle by num + 2 to account for some padding
  let totalAngle = rightAngle - leftAngle; // leftAngle - rightAngle;
  let arcWidth = totalAngle / (num + 6);

  let positions = Array(num)
    .fill(undefined)
    .map((_, i) => {
      // let angle = rightAngle + i * arcWidth;

      return {
        // x: circleX + circleRadius * Math.cos(angle),
        // y: circleY + circleRadius + Math.sin(angle),
        // rad: rightAngle - (i * arcWidth),
        rad: (i - num / 2) * arcWidth,
      };
    });

  return {
    path: {
      x: circleY,
      y: circleY,
      radius: circleRadius,
      viewportWidth,
    },
    positions,
  };
}
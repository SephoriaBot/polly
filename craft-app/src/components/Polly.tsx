import React from 'react';
import './Polly.css';

import pollyNeutral from '../../assets/pollyhamster/polly_0.PNG';
import pollyConfused from '../../assets/pollyhamster/polly_1.JPG';
import pollyDisappointed from '../../assets/pollyhamster/polly_2.JPG';
import pollySearching from '../../assets/pollyhamster/polly_3.JPG';
import pollyMad from '../../assets/pollyhamster/polly_4.JPG';
import pollyCheering from '../../assets/pollyhamster/polly_5.JPG';
import pollyYawning from '../../assets/pollyhamster/polly_6.JPG';
import pollyHappy from '../../assets/pollyhamster/polly_7.JPG';
import pollySad from '../../assets/pollyhamster/polly_8.JPG';
import pollySurprised from '../../assets/pollyhamster/polly_9.JPG';
import pollyLove from '../../assets/pollyhamster/polly_10.JPG';

export type PollyMood =
  | 'neutral'
  | 'confused'
  | 'disappointed'
  | 'searching'
  | 'mad'
  | 'cheering'
  | 'yawning'
  | 'happy'
  | 'sad'
  | 'surprised'
  | 'love';

const POLLY_IMAGES: Record<PollyMood, string> = {
  neutral: pollyNeutral,
  confused: pollyConfused,
  disappointed: pollyDisappointed,
  searching: pollySearching,
  mad: pollyMad,
  cheering: pollyCheering,
  yawning: pollyYawning,
  happy: pollyHappy,
  sad: pollySad,
  surprised: pollySurprised,
  love: pollyLove,
};

interface PollyProps {
  mood?: PollyMood;
  size?: 'tiny' | 'small' | 'medium' | 'large';
  className?: string;
  alt?: string;
  animate?: boolean;
}

export default function Polly({
  mood = 'neutral',
  size = 'medium',
  className = '',
  alt = 'Polly',
  animate = true,
}: PollyProps) {
  return (
    <div
      className={`polly polly-${size} ${
        animate ? 'polly-animate' : ''
      } ${className}`}
    >
      <img
        src={POLLY_IMAGES[mood]}
        alt={alt}
        className="polly-image"
      />
    </div>
  );
}
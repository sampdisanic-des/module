import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText, Line } from 'react-native-svg';
import { APP_FONT } from '../theme/fonts';
import { ON_ACCENT } from '../theme/colorTransform';
import { createThemedStyles, useTheme, useThemedStyles } from '../theme/ThemeContext';

interface AdsrGraphProps {
  attack: number; // 0..100
  decay: number;
  sustain: number;
  release: number;
}

const PAD = 14;

/** Gráfica de la envolvente, dibujada en el tamaño real del recuadro (sin deformar) */
export const AdsrGraph: React.FC<AdsrGraphProps> = ({ attack, decay, sustain, release }) => {
  const styles = useThemedStyles(themed);
  const { c } = useTheme();
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 240, h: 140 });

  const { w, h } = size;
  const baseY = h - PAD;
  const peakY = PAD + 6;
  const usable = w - PAD * 2;
  // Reparto horizontal: A y D hasta 22% cada uno, meseta fija 20%, R hasta 22%
  const startX = PAD;
  const attackX = startX + usable * 0.04 + (attack / 100) * usable * 0.22;
  const decayX = attackX + usable * 0.06 + (decay / 100) * usable * 0.22;
  const sustainY = baseY - (sustain / 100) * (baseY - peakY);
  const sustainX = decayX + usable * 0.2;
  const releaseX = Math.min(sustainX + usable * 0.04 + (release / 100) * usable * 0.22, w - PAD - 12);

  const points = `M ${startX} ${baseY} L ${attackX} ${peakY} L ${decayX} ${sustainY} L ${sustainX} ${sustainY} L ${releaseX} ${baseY}`;
  // Etiqueta arriba del punto, o abajo si no cabe
  const labelY = (y: number) => (y - 9 < 8 ? y + 16 : y - 9);
  const nodes = [
    { key: 'A', x: attackX, y: peakY, lx: attackX, ly: labelY(peakY) },
    { key: 'D', x: decayX, y: sustainY, lx: decayX, ly: labelY(sustainY) },
    { key: 'S', x: sustainX, y: sustainY, lx: sustainX, ly: labelY(sustainY) },
    { key: 'R', x: releaseX, y: baseY, lx: releaseX + 12, ly: baseY - 2 },
  ];

  const orange = c('#FF9100');

  return (
    <View
      style={styles.editGraphBox}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) setSize({ w: width, h: height });
      }}
    >
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id="adsrGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={orange} stopOpacity="0.6" />
            <Stop offset="1" stopColor={orange} stopOpacity="0.05" />
          </LinearGradient>
        </Defs>
        <Line x1="0" y1={(baseY + peakY) / 2} x2={w} y2={(baseY + peakY) / 2} stroke={c('#121C2B')} strokeWidth="1" strokeDasharray="4 4" />
        <Path d={`${points} Z`} fill="url(#adsrGrad)" />
        <Path d={points} stroke={orange} strokeWidth="2.5" fill="none" />
        {nodes.map((n) => (
          <React.Fragment key={n.key}>
            <Circle cx={n.x} cy={n.y} r="5" fill={ON_ACCENT} stroke={orange} strokeWidth="2" />
            <SvgText x={n.lx} y={n.ly} fill={c('#8A9EB8')} fontSize="11" fontWeight="bold" fontFamily={APP_FONT} textAnchor="middle">
              {n.key}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
};

const themed = createThemedStyles({
  editGraphBox: {
    flex: 1,
    marginVertical: 8,
    backgroundColor: '#05080D',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#121C2B',
    overflow: 'hidden',
  },
});

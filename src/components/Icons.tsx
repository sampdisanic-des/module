import React from 'react';
import Svg, { Path, Circle, Line } from 'react-native-svg';

// ================= ICONOS VECTORIALES SVG =================
export const SearchIcon = ({ size = 13, color = '#7187A1' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2.5" />
    <Line x1="16.5" y1="16.5" x2="21.5" y2="21.5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </Svg>
);

export const BluetoothIcon = ({ size = 13, color = '#00E5FF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M7 7L17 17L12 22V2L17 7L7 17"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const UsbCableIcon = ({ size = 13, color = '#7187A1' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2V14M8 6H16V10C16 12.2091 14.2091 14 12 14C9.79086 14 8 12.2091 8 10V6ZM10 2V6M14 2V6M12 14V22"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="20" r="1.5" fill={color} />
  </Svg>
);

export const SignalBarsIcon = ({ rssi = -60, size = 12 }: { rssi?: number; size?: number }) => {
  // rssi: > -60 (4 bars), > -75 (3 bars), > -90 (2 bars), <= -90 (1 bar)
  const bars = rssi > -60 ? 4 : rssi > -75 ? 3 : rssi > -90 ? 2 : 1;
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Line x1="2" y1="13" x2="2" y2="10" stroke={bars >= 1 ? '#00E5FF' : '#23384D'} strokeWidth="2" strokeLinecap="round" />
      <Line x1="6" y1="13" x2="6" y2="7.5" stroke={bars >= 2 ? '#00E5FF' : '#23384D'} strokeWidth="2" strokeLinecap="round" />
      <Line x1="10" y1="13" x2="10" y2="5" stroke={bars >= 3 ? '#00E5FF' : '#23384D'} strokeWidth="2" strokeLinecap="round" />
      <Line x1="14" y1="13" x2="14" y2="2" stroke={bars >= 4 ? '#00E5FF' : '#23384D'} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
};

export const RefreshIcon = ({ size = 12, color = '#00E5FF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21 12A9 9 0 006 5.3L3 8M3 3V8H8M3 12A9 9 0 0018 18.7L21 16M21 21V16H16"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const BackArrowIcon = ({ size = 16, color = '#00E5FF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M5 12L12 19M5 12L12 5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const PlusIcon = ({ size = 15, color = '#000000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5V19M5 12H19" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
  </Svg>
);

export const EditIcon = ({ size = 13, color = '#8A9EB8' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M11 4H4C3.44772 4 3 4.44772 3 5V20C3 20.5523 3.44772 21 4 21H19C19.5523 21 20 20.5523 20 20V13" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M18.5 2.5C19.3284 1.67157 20.6716 1.67157 21.5 2.5C22.3284 3.32843 22.3284 4.67157 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const TrashIcon = ({ size = 13, color = '#FF5252' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 6H21M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M10 11V17M14 11V17" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const CloseIcon = ({ size = 10, color = '#8A9EB8' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const AssignIcon = ({ size = 14, color = '#00E5FF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M20 6L9 17L4 12" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);


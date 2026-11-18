import { useEffect, useState } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Battery from 'expo-battery';

const formatTime = (now: Date) => {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${minutes < 10 ? `0${minutes}` : minutes} ${ampm}`;
};

/** Bloquea la orientación horizontal y expone la hora y la batería del teléfono */
export const useDeviceStatus = () => {
  const [timeStr, setTimeStr] = useState<string>(() => formatTime(new Date()));
  const [batteryPercent, setBatteryPercent] = useState<number>(100);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch((e) =>
      console.warn('ScreenOrientation error:', e)
    );

    const timeInterval = setInterval(() => setTimeStr(formatTime(new Date())), 30000);

    Battery.getBatteryLevelAsync()
      .then((level) => {
        if (level >= 0) setBatteryPercent(Math.round(level * 100));
      })
      .catch((e) => console.warn('Battery error:', e));

    return () => clearInterval(timeInterval);
  }, []);

  return { timeStr, batteryPercent };
};

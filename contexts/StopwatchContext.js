import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { LayoutAnimation } from "react-native";

const StopwatchContext = createContext();

export function StopwatchProvider({ children }) {
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [laps, setLaps] = useState([]);

  const timerRef = useRef(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now() - time;
      timerRef.current = setInterval(() => {
        setTime(Date.now() - startTimeRef.current);
      }, 50);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const handleStartPause = useCallback(() => {
    if (time === 0 && !isRunning) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setIsRunning((prev) => !prev);
  }, [time, isRunning]);

  const handleReset = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsRunning(false);
    setTime(0);
    setLaps([]);
  }, []);

  const handleLap = useCallback(() => {
    if (time === 0) return;
    if (laps.length === 0) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setLaps((prev) => [
      {
        id: prev.length + 1,
        time,
        splitTime: prev.length > 0 ? time - prev[0].time : time,
      },
      ...prev,
    ]);
  }, [time, laps.length]);

  return (
    <StopwatchContext.Provider
      value={{
        isRunning,
        time,
        laps,
        handleStartPause,
        handleReset,
        handleLap,
      }}
    >
      {children}
    </StopwatchContext.Provider>
  );
}

export function useStopwatch() {
  return useContext(StopwatchContext);
}
